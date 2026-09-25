"""FastAPI application: HTTP endpoints, the WebSocket stream and the background ticker."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from . import SCHEMA_VERSION
from .config import PolicyOverrides, Settings
from .engine import IngestError
from .schemas import (
    AckMessage,
    CreateSessionRequest,
    CreateSessionResponse,
    ErrorMessage,
    GameEventMessage,
    GestureEventMessage,
    HelloMessage,
    IngestResponse,
    ObservationMessage,
    PingMessage,
    PongMessage,
    SessionEndpoints,
    StateMessage,
    SuggestedActionMessage,
    WelcomeMessage,
)
from .sessions import Connection, Session, SessionStore

log = logging.getLogger("observation.api")

# WebSocket close codes (4000-4999 are application-defined).
WS_SESSION_CLOSED = 4000
WS_UNAUTHORIZED = 4401
WS_FORBIDDEN_ORIGIN = 4403
WS_SESSION_NOT_FOUND = 4404
WS_HELLO_TIMEOUT = 4408
WS_TOO_SLOW = 4409
WS_POLICY = 1008
WS_TOO_BIG = 1009
MAX_RATE_VIOLATIONS = 50


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status, self.code, self.message = status, code, message


def _validation_summary(exc: ValidationError) -> list[dict[str, Any]]:
    # Locations and messages only: never echo input values back.
    return [
        {"loc": [str(p) for p in err.get("loc", ())], "msg": err.get("msg", "")}
        for err in exc.errors()[:10]
    ]


def create_app(settings: Settings | None = None, store: SessionStore | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    store = store if store is not None else SessionStore(settings)
    allowed_origins = set(settings.allowed_origins)

    async def ticker() -> None:
        while True:
            await asyncio.sleep(settings.tick_interval_s)
            try:
                store.tick()
            except Exception:  # pragma: no cover - keep the ticker alive
                log.exception("ticker failed")

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI):
        task = asyncio.create_task(ticker())
        log.info(
            "in-memory store: run exactly one worker; sessions are lost on restart"
        )
        try:
            yield
        finally:
            task.cancel()
            for session in store.all():
                store.delete(session.session_id, reason="shutdown")

    app = FastAPI(
        title="Player observation service",
        version=SCHEMA_VERSION,
        lifespan=lifespan,
        description=(
            "Ingests numerical webcam-derived observations and gameplay events. "
            "No camera frames are accepted or stored. Vision measurements are heuristics; "
            "they do not establish engagement, emotion, fatigue or cognitive state."
        ),
    )
    app.state.store = store
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(allowed_origins),
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Session-Create-Key"],
        max_age=600,
    )

    @app.middleware("http")
    async def reject_foreign_origins(request: Request, call_next):
        origin = request.headers.get("origin")
        if origin is not None and origin not in allowed_origins:
            return JSONResponse(
                {"error": {"code": "origin_not_allowed", "message": "origin not allowed"}},
                status_code=403,
            )
        return await call_next(request)

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse(
            {"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status
        )

    @app.exception_handler(ValidationError)
    async def _validation_error(_: Request, exc: ValidationError):
        return JSONResponse(
            {
                "error": {
                    "code": "invalid_message",
                    "message": "message failed validation",
                    "details": _validation_summary(exc),
                }
            },
            status_code=422,
        )

    # ---------------------------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------------------------

    async def read_body(request: Request) -> bytes:
        limit = settings.max_body_bytes
        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > limit:
            raise ApiError(413, "payload_too_large", f"body exceeds {limit} bytes")
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > limit:
                raise ApiError(413, "payload_too_large", f"body exceeds {limit} bytes")
        return bytes(body)

    def bearer(request: Request) -> str | None:
        header = request.headers.get("authorization", "")
        scheme, _, token = header.partition(" ")
        return token.strip() if scheme.lower() == "bearer" and token.strip() else None

    def authorize(request: Request, session_id: str, roles: set[str]) -> Session:
        session = store.get(session_id)
        if session is None:
            raise ApiError(404, "session_not_found", "unknown or expired session")
        token = bearer(request)
        if token is None:
            raise ApiError(401, "unauthorized", "missing bearer token")
        role = session.role_for_token(token)
        if role is None or role not in roles:
            raise ApiError(403, "forbidden", "token not valid for this operation")
        return session

    def ingest_observation(session: Session, obs: ObservationMessage) -> str:
        now = store.clock()
        if not session.observation_bucket.take(now):
            raise ApiError(429, "rate_limited", "observation rate limit exceeded")
        try:
            status, gestures = session.engine.ingest_observation(obs, now)
        except IngestError as exc:
            raise ApiError(exc.http_status, exc.code, exc.message) from exc
        session.last_activity = now
        session.publish_gestures(gestures)
        session.refresh(now, store.wall_ms(), settings.state_min_interval_s)
        return status

    def ingest_game_event(session: Session, ev: GameEventMessage) -> str:
        now = store.clock()
        if not session.game_event_bucket.take(now):
            raise ApiError(429, "rate_limited", "game event rate limit exceeded")
        try:
            status = session.engine.ingest_game_event(ev, now)
        except IngestError as exc:
            raise ApiError(exc.http_status, exc.code, exc.message) from exc
        session.last_activity = now
        # Game events can change policy immediately (e.g. an answer triggers a hint).
        session.refresh(now, store.wall_ms(), 0.0)
        return status

    # ---------------------------------------------------------------------------------
    # HTTP
    # ---------------------------------------------------------------------------------

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "schema_version": SCHEMA_VERSION,
            "sessions": len(store),
            "storage": "in_memory_single_worker",
        }

    @app.get("/v1/schema")
    async def schema() -> dict[str, Any]:
        models = {
            "ObservationMessage": ObservationMessage,
            "GameEventMessage": GameEventMessage,
            "HelloMessage": HelloMessage,
            "StateMessage": StateMessage,
            "GestureEventMessage": GestureEventMessage,
            "SuggestedActionMessage": SuggestedActionMessage,
            "AckMessage": AckMessage,
            "ErrorMessage": ErrorMessage,
            "WelcomeMessage": WelcomeMessage,
        }
        return {
            "schema_version": SCHEMA_VERSION,
            "models": {name: m.model_json_schema() for name, m in models.items()},
        }

    @app.post("/v1/sessions", status_code=201, response_model=CreateSessionResponse)
    async def create_session(request: Request) -> CreateSessionResponse:
        if settings.session_create_key is not None:
            import hmac

            supplied = request.headers.get("x-session-create-key", "")
            if not hmac.compare_digest(supplied, settings.session_create_key):
                raise ApiError(403, "forbidden", "invalid session create key")
        raw = await read_body(request)
        body = CreateSessionRequest.model_validate_json(raw or b"{}")
        policy = settings.policy
        if body.policy_overrides:
            policy = PolicyOverrides.model_validate(body.policy_overrides).apply(policy)
        try:
            session = store.create(policy)
        except OverflowError as exc:
            raise ApiError(503, "capacity", "too many active sessions") from exc
        base = f"/v1/sessions/{session.session_id}"
        return CreateSessionResponse(
            session_id=session.session_id,
            producer_token=session.producer_token,
            consumer_token=session.consumer_token,
            endpoints=SessionEndpoints(
                observations=f"{base}/observations",
                game_events=f"{base}/game-events",
                state=f"{base}/state",
                stream=f"{base}/stream",
            ),
            idle_ttl_s=settings.session_idle_ttl_s,
            limits={
                "max_body_bytes": settings.max_body_bytes,
                "max_ws_message_bytes": settings.max_ws_message_bytes,
                "observation_rate_per_s": settings.observation_rate_per_s,
                "game_event_rate_per_s": settings.game_event_rate_per_s,
                "heartbeat_interval_ms": settings.heartbeat_interval_s * 1000,
            },
            policy=policy.model_dump(),
        )

    @app.post("/v1/sessions/{session_id}/observations", response_model=IngestResponse)
    async def post_observation(session_id: str, request: Request) -> IngestResponse:
        session = authorize(request, session_id, {"producer"})
        obs = ObservationMessage.model_validate_json(await read_body(request))
        if obs.session_id != session_id:
            raise ApiError(400, "session_mismatch", "session_id does not match the path")
        status = ingest_observation(session, obs)
        return IngestResponse(status=status, seq=obs.seq, state_seq=session.engine.state_seq)  # type: ignore[arg-type]

    @app.post("/v1/sessions/{session_id}/game-events", response_model=IngestResponse)
    async def post_game_event(session_id: str, request: Request) -> IngestResponse:
        session = authorize(request, session_id, {"consumer"})
        ev = GameEventMessage.model_validate_json(await read_body(request))
        if ev.session_id != session_id:
            raise ApiError(400, "session_mismatch", "session_id does not match the path")
        status = ingest_game_event(session, ev)
        return IngestResponse(status=status, seq=ev.seq, state_seq=session.engine.state_seq)  # type: ignore[arg-type]

    @app.get("/v1/sessions/{session_id}/state", response_model=StateMessage)
    async def get_state(session_id: str, request: Request) -> StateMessage:
        session = authorize(request, session_id, {"producer", "consumer"})
        state = session.refresh(store.clock(), store.wall_ms(), settings.state_min_interval_s)
        return session.state_message(state, store.wall_ms())

    @app.delete("/v1/sessions/{session_id}", status_code=204)
    async def delete_session(session_id: str, request: Request) -> None:
        authorize(request, session_id, {"producer", "consumer"})
        store.delete(session_id)

    # ---------------------------------------------------------------------------------
    # WebSocket
    # ---------------------------------------------------------------------------------

    @app.websocket("/v1/sessions/{session_id}/stream")
    async def stream(ws: WebSocket, session_id: str) -> None:
        origin = ws.headers.get("origin")
        if (origin is None and not settings.allow_missing_origin) or (
            origin is not None and origin not in allowed_origins
        ):
            # Accept only to deliver a close code: a pre-handshake refusal surfaces in
            # browsers as an anonymous 1006, which clients would keep retrying. Nothing is
            # read from or sent to this socket besides the close frame.
            await ws.accept()
            await ws.close(code=WS_FORBIDDEN_ORIGIN, reason="origin_not_allowed")
            return
        await ws.accept()

        async def fail(code: str, message: str, close_code: int) -> None:
            with contextlib.suppress(Exception):
                await ws.send_text(ErrorMessage(code=code, message=message).model_dump_json())
                await ws.close(code=close_code)

        session = store.get(session_id)
        if session is None:
            await fail("session_not_found", "unknown or expired session", WS_SESSION_NOT_FOUND)
            return

        # First message must be `hello`, carrying the role-scoped token. Tokens are never
        # accepted in the URL, so they cannot leak through access logs or history.
        try:
            raw = await asyncio.wait_for(ws.receive_text(), settings.hello_timeout_s)
            if len(raw) > settings.max_ws_message_bytes:
                raise ValueError("hello too large")
            hello = HelloMessage.model_validate_json(raw)
        except asyncio.TimeoutError:
            await fail("hello_timeout", "no hello received", WS_HELLO_TIMEOUT)
            return
        except (ValidationError, ValueError, KeyError, WebSocketDisconnect):
            await fail("invalid_hello", "first message must be a valid hello", WS_UNAUTHORIZED)
            return
        if session.role_for_token(hello.token) != hello.role:
            await fail("unauthorized", "token not valid for this role", WS_UNAUTHORIZED)
            return

        conn = Connection(hello.role, hello.client_id, ws.send_text, settings.consumer_queue_max)
        group = session.consumers if hello.role == "consumer" else session.producers
        group.add(conn)
        writer = asyncio.create_task(conn.writer())
        now = store.clock()
        session.last_activity = now
        conn.enqueue(
            WelcomeMessage(
                session_id=session_id,
                role=hello.role,
                heartbeat_interval_ms=settings.heartbeat_interval_s * 1000,
                last_event_seq=session.engine.last_event_seq,
            ).model_dump_json()
        )
        if hello.role == "consumer":
            # Snapshot for this connection only; other consumers are not re-sent state.
            state = session.refresh(now, store.wall_ms(), settings.state_min_interval_s)
            conn.enqueue(session.state_message(state, store.wall_ms()).model_dump_json())
            if hello.resume_after_event_seq is not None:
                for event in session.engine.replay_after(hello.resume_after_event_seq, now):
                    conn.enqueue(event.model_dump_json())
        log.info("session=%s ws connected role=%s", session_id, hello.role)

        def send_error(code: str, message: str, seq: int | None = None) -> None:
            conn.enqueue(ErrorMessage(code=code, message=message, seq=seq).model_dump_json())

        async def reader() -> int:
            violations = 0
            while True:
                message = await ws.receive()
                if message["type"] == "websocket.disconnect":
                    return 1000
                text = message.get("text")
                if text is None:
                    send_error("binary_not_supported", "send JSON text frames")
                    continue
                if len(text.encode()) > settings.max_ws_message_bytes:
                    send_error("payload_too_large", "message too large")
                    return WS_TOO_BIG
                try:
                    parsed = json.loads(text)
                    kind = parsed.get("type")
                except (ValueError, AttributeError):
                    send_error("invalid_json", "message is not a JSON object")
                    continue
                # Echo the client's seq on errors when it is at least an integer, so the
                # client can correlate the rejection with what it sent.
                raw_seq = parsed.get("seq")
                seq: int | None = raw_seq if type(raw_seq) is int else None
                try:
                    if kind == "ping":
                        ping = PingMessage.model_validate_json(text)
                        conn.enqueue(PongMessage(nonce=ping.nonce).model_dump_json())
                    elif kind == "observation" and hello.role == "producer":
                        obs = ObservationMessage.model_validate_json(text)
                        seq = obs.seq
                        if obs.session_id != session_id:
                            raise ApiError(400, "session_mismatch", "session_id mismatch")
                        if obs.producer_id != hello.client_id:
                            raise ApiError(400, "producer_mismatch", "producer_id != hello")
                        status = ingest_observation(session, obs)
                        conn.enqueue(
                            AckMessage(kind="observation", seq=obs.seq, status=status).model_dump_json()  # type: ignore[arg-type]
                        )
                    elif kind == "game_event" and hello.role == "consumer":
                        ev = GameEventMessage.model_validate_json(text)
                        seq = ev.seq
                        if ev.session_id != session_id:
                            raise ApiError(400, "session_mismatch", "session_id mismatch")
                        status = ingest_game_event(session, ev)
                        conn.enqueue(
                            AckMessage(
                                kind="game_event", seq=ev.seq, status=status, id=ev.event_id  # type: ignore[arg-type]
                            ).model_dump_json()
                        )
                    else:
                        send_error("unexpected_message", f"{kind!r} not accepted from {hello.role}")
                except ValidationError as exc:
                    detail = "; ".join(
                        f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in _validation_summary(exc)
                    )
                    send_error("invalid_message", detail[:500], seq)
                except ApiError as exc:
                    send_error(exc.code, exc.message, seq)
                    if exc.code == "rate_limited":
                        violations += 1
                        if violations > MAX_RATE_VIOLATIONS:
                            return WS_POLICY

        reader_task = asyncio.create_task(reader())
        closed_task = asyncio.create_task(conn.closed.wait())
        close_code = WS_SESSION_CLOSED
        try:
            done, _ = await asyncio.wait(
                {reader_task, closed_task}, return_when=asyncio.FIRST_COMPLETED
            )
            if reader_task in done and not reader_task.cancelled():
                exc = reader_task.exception()
                close_code = 1000 if exc is not None else reader_task.result()
            elif conn.overflowed:
                close_code = WS_TOO_SLOW
        finally:
            group.discard(conn)
            conn.close()
            for task in (reader_task, closed_task):
                task.cancel()
            with contextlib.suppress(Exception):
                await asyncio.wait_for(writer, timeout=1.0)
            writer.cancel()
            with contextlib.suppress(Exception):
                await ws.close(code=close_code)
            log.info("session=%s ws closed role=%s code=%s", session_id, hello.role, close_code)

    return app


app = create_app()
