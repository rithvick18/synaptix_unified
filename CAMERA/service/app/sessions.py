"""In-memory session store.

Sessions live in this process only: run a single worker (``--workers 1``) and expect every
session to be lost on restart. Clients must create a new session after a restart; the
TypeScript adapter reports this as ``session_not_found``.
"""

from __future__ import annotations

import asyncio
import hmac
import logging
import secrets
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from pydantic import BaseModel

from .config import PolicyConfig, Settings
from .engine import SessionEngine
from .schemas import HeartbeatMessage, StateMessage, SuggestedActionMessage, GestureEventMessage

log = logging.getLogger("observation.sessions")


class TokenBucket:
    def __init__(self, rate_per_s: float, burst: int) -> None:
        self.rate = rate_per_s
        self.capacity = float(burst)
        self.tokens = float(burst)
        self.updated: float | None = None

    def take(self, now: float) -> bool:
        if self.updated is not None:
            self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False


class Connection:
    """One WebSocket client. Outgoing messages go through a bounded queue so a slow
    consumer can never block ingestion; if the queue fills, the connection is dropped
    and the client reconnects and replays buffered events."""

    def __init__(self, role: str, client_id: str, send: Callable[[str], Any], max_queue: int):
        self.role = role
        self.client_id = client_id
        self._send = send
        self.queue: asyncio.Queue[str | None] = asyncio.Queue(maxsize=max_queue)
        self.overflowed = False
        self.closed = asyncio.Event()

    def enqueue(self, payload: str) -> None:
        if self.closed.is_set():
            return
        try:
            self.queue.put_nowait(payload)
        except asyncio.QueueFull:
            self.overflowed = True
            self.close()

    def close(self) -> None:
        if not self.closed.is_set():
            self.closed.set()
            try:
                self.queue.put_nowait(None)
            except asyncio.QueueFull:
                pass

    async def writer(self) -> None:
        while True:
            payload = await self.queue.get()
            if payload is None:
                return
            await self._send(payload)


@dataclass
class Session:
    session_id: str
    producer_token: str
    consumer_token: str
    engine: SessionEngine
    created_at: float
    last_activity: float
    observation_bucket: TokenBucket
    game_event_bucket: TokenBucket
    consumers: set[Connection] = field(default_factory=set)
    producers: set[Connection] = field(default_factory=set)
    last_state_push: float = 0.0
    last_heartbeat: float = 0.0
    pending_state: bool = False
    closed: bool = False

    def role_for_token(self, token: str | None) -> str | None:
        if not token:
            return None
        if hmac.compare_digest(token, self.producer_token):
            return "producer"
        if hmac.compare_digest(token, self.consumer_token):
            return "consumer"
        return None

    # --- Fan-out -------------------------------------------------------------------------

    def broadcast(self, message: BaseModel) -> None:
        payload = message.model_dump_json()
        for conn in list(self.consumers):
            conn.enqueue(payload)

    def refresh(self, now: float, wall_ms: float, min_interval_s: float, force: bool = False):
        """Run the engine, push state (throttled) and any new actions to consumers."""
        state, changed, actions = self.engine.evaluate(now)
        for action in actions:
            log.info(
                "session=%s action=%s source=%s", self.session_id, action.action, action.source
            )
            self.broadcast(action)
        # A change that falls inside the throttle window stays pending until the next
        # refresh (ingest or tick), so no state transition is ever silently dropped.
        self.pending_state = self.pending_state or changed
        if force or (self.pending_state and now - self.last_state_push >= min_interval_s):
            self.pending_state = False
            self.last_state_push = now
            self.broadcast(self.state_message(state, wall_ms))
        return state

    def state_message(self, state, wall_ms: float) -> StateMessage:
        return StateMessage(
            session_id=self.session_id,
            state_seq=self.engine.state_seq,
            server_ts_ms=wall_ms,
            state=state,
        )

    def publish_gestures(self, gestures: list[GestureEventMessage]) -> None:
        for gesture in gestures:
            self.broadcast(gesture)

    def heartbeat(self, now: float, wall_ms: float, interval_s: float) -> None:
        if now - self.last_heartbeat >= interval_s:
            self.last_heartbeat = now
            payload = HeartbeatMessage(server_ts_ms=wall_ms).model_dump_json()
            for conn in list(self.consumers | self.producers):
                conn.enqueue(payload)

    def close_all(self) -> None:
        self.closed = True
        for conn in list(self.consumers | self.producers):
            conn.close()


class SessionStore:
    def __init__(
        self,
        settings: Settings,
        clock: Callable[[], float] = time.monotonic,
        wall_ms: Callable[[], float] = lambda: time.time() * 1000,
    ) -> None:
        self.settings = settings
        self.clock = clock
        self.wall_ms = wall_ms
        self._sessions: dict[str, Session] = {}

    def __len__(self) -> int:
        return len(self._sessions)

    def create(self, policy: PolicyConfig) -> Session:
        if len(self._sessions) >= self.settings.max_sessions:
            self.expire()
            if len(self._sessions) >= self.settings.max_sessions:
                raise OverflowError("max_sessions reached")
        now = self.clock()
        session_id = "s_" + secrets.token_urlsafe(12)
        session = Session(
            session_id=session_id,
            producer_token=secrets.token_urlsafe(32),
            consumer_token=secrets.token_urlsafe(32),
            engine=SessionEngine(session_id, policy, self.wall_ms),
            created_at=now,
            last_activity=now,
            observation_bucket=TokenBucket(
                self.settings.observation_rate_per_s, self.settings.observation_burst
            ),
            game_event_bucket=TokenBucket(
                self.settings.game_event_rate_per_s, self.settings.game_event_burst
            ),
        )
        self._sessions[session_id] = session
        log.info("session=%s created", session_id)
        return session

    def get(self, session_id: str) -> Session | None:
        session = self._sessions.get(session_id)
        if session is not None and self._expired(session, self.clock()):
            self.delete(session_id, reason="expired")
            return None
        return session

    def delete(self, session_id: str, reason: str = "deleted") -> bool:
        session = self._sessions.pop(session_id, None)
        if session is None:
            return False
        session.close_all()
        log.info("session=%s closed reason=%s", session_id, reason)
        return True

    def _expired(self, session: Session, now: float) -> bool:
        # A session with live sockets is not idle even if no data is flowing.
        idle = now - session.last_activity > self.settings.session_idle_ttl_s and not (
            session.consumers or session.producers
        )
        too_old = now - session.created_at > self.settings.session_max_age_s
        return idle or too_old

    def expire(self) -> int:
        now = self.clock()
        stale = [sid for sid, s in self._sessions.items() if self._expired(s, now)]
        for sid in stale:
            self.delete(sid, reason="expired")
        return len(stale)

    def all(self) -> list[Session]:
        return list(self._sessions.values())

    def tick(self) -> None:
        """Periodic work: expiry, staleness re-evaluation, heartbeats."""
        self.expire()
        now, wall = self.clock(), self.wall_ms()
        for session in self.all():
            session.refresh(now, wall, self.settings.state_min_interval_s)
            session.heartbeat(now, wall, self.settings.heartbeat_interval_s)


__all__ = [
    "Connection",
    "Session",
    "SessionStore",
    "TokenBucket",
    "SuggestedActionMessage",
]
