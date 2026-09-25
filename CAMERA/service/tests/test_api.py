"""HTTP and WebSocket tests through the real ASGI app."""

from __future__ import annotations

import contextlib
import json

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.config import PolicyConfig, Settings
from app.main import create_app
from app.sessions import SessionStore
from helpers import FakeClock, game_event, gesture, observation

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def env():
    clock = FakeClock()
    settings = Settings(
        tick_interval_s=5,  # ticker effectively idle; tests drive refresh explicitly
        observation_burst=1000,
        game_event_burst=1000,
        policy=PolicyConfig(delay_instruction_after_ms=500),
    )
    store = SessionStore(settings, clock=clock, wall_ms=lambda: 1.7e12)
    app = create_app(settings, store)
    with TestClient(app) as client:
        yield client, clock, store, settings


def create(client: TestClient, **body):
    r = client.post("/v1/sessions", json=body or {}, headers={"Origin": ORIGIN})
    assert r.status_code == 201, r.text
    return r.json()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Origin": ORIGIN}


@contextlib.contextmanager
def ws_connect(client: TestClient, sid: str, role: str, token: str, client_id: str, **extra):
    with client.websocket_connect(f"/v1/sessions/{sid}/stream", headers={"Origin": ORIGIN}) as conn:
        conn.send_json(
            {"type": "hello", "schema_version": "1.0", "role": role, "client_id": client_id,
             "token": token, **extra}
        )
        welcome = conn.receive_json()
        assert welcome["type"] == "welcome", welcome
        yield conn


def receive_until(conn, kind: str, limit: int = 50):
    for _ in range(limit):
        msg = conn.receive_json()
        if msg["type"] == kind:
            return msg
    raise AssertionError(f"no {kind} message")


# --- HTTP ------------------------------------------------------------------------------


def test_health(env):
    client, *_ = env
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["storage"] == "in_memory_single_worker"


def test_create_session_returns_connection_details(env):
    client, *_ = env
    s = create(client)
    assert s["session_id"].startswith("s_")
    assert s["producer_token"] != s["consumer_token"]
    assert s["endpoints"]["stream"] == f"/v1/sessions/{s['session_id']}/stream"
    assert "delay_instruction_after_ms" in s["policy"]


def test_policy_overrides_validated(env):
    client, *_ = env
    s = create(client, policy_overrides={"cue_inactivity_ms": 2000})
    assert s["policy"]["cue_inactivity_ms"] == 2000
    r = client.post(
        "/v1/sessions", json={"policy_overrides": {"cue_inactivity_ms": -5}},
        headers={"Origin": ORIGIN},
    )
    assert r.status_code == 422
    r = client.post(
        "/v1/sessions", json={"policy_overrides": {"no_such_threshold": 1}},
        headers={"Origin": ORIGIN},
    )
    assert r.status_code == 422


def test_foreign_origin_rejected(env):
    client, *_ = env
    r = client.post("/v1/sessions", json={}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "origin_not_allowed"


def test_auth_required_and_role_scoped(env):
    client, *_ = env
    s = create(client)
    sid = s["session_id"]
    obs = observation(sid, 1, 10.0)
    assert client.post(f"/v1/sessions/{sid}/observations", json=obs).status_code == 401
    r = client.post(f"/v1/sessions/{sid}/observations", json=obs, headers=auth(s["consumer_token"]))
    assert r.status_code == 403
    r = client.post(f"/v1/sessions/{sid}/observations", json=obs, headers=auth(s["producer_token"]))
    assert r.status_code == 200 and r.json()["status"] == "accepted"
    ev = game_event(sid, 1, "task_started", 1.0, task_id="t1")
    r = client.post(f"/v1/sessions/{sid}/game-events", json=ev, headers=auth(s["producer_token"]))
    assert r.status_code == 403


def test_http_observation_dedup_and_ordering(env):
    client, *_ = env
    s = create(client)
    sid, h = s["session_id"], auth(s["producer_token"])
    url = f"/v1/sessions/{sid}/observations"
    assert client.post(url, json=observation(sid, 3, 10.0), headers=h).json()["status"] == "accepted"
    assert client.post(url, json=observation(sid, 3, 10.0), headers=h).json()["status"] == "duplicate"
    r = client.post(url, json=observation(sid, 2, 11.0), headers=h)
    assert r.status_code == 409 and r.json()["error"]["code"] == "out_of_order"


@pytest.mark.parametrize(
    "mutate, code",
    [
        (lambda o: o["measurements"]["head_yaw_deg"].update(value=1e9, reason=None), 422),
        (lambda o: o["measurements"]["head_yaw_deg"].update(value=None, reason=None), 422),
        (lambda o: o["measurements"]["head_yaw_deg"].update(value=1.0, reason="x"), 422),
        (lambda o: o.update(extra_field=1), 422),
        (lambda o: o.update(schema_version="2.0"), 422),
        (lambda o: o["tracking"].update(valid=True, status="no_face"), 422),
        (lambda o: o.update(gestures=[gesture("nod", 5, 1)]), 422),
        (lambda o: o.update(seq=-1), 422),
        (lambda o: o.update(session_id="s_someone_else"), 400),
    ],
)
def test_invalid_observations_rejected(env, mutate, code):
    client, *_ = env
    s = create(client)
    sid = s["session_id"]
    obs = observation(sid, 1, 10.0)
    mutate(obs)
    r = client.post(f"/v1/sessions/{sid}/observations", json=obs, headers=auth(s["producer_token"]))
    assert r.status_code == code, r.text


@pytest.mark.parametrize("token", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_numbers_rejected(env, token):
    client, *_ = env
    s = create(client)
    sid = s["session_id"]
    raw = json.dumps(observation(sid, 1, 10.0)).replace('"capture_ts_ms": 10.0', f'"capture_ts_ms": {token}')
    assert token in raw
    r = client.post(
        f"/v1/sessions/{sid}/observations", content=raw,
        headers={**auth(s["producer_token"]), "Content-Type": "application/json"},
    )
    assert r.status_code == 422


def test_oversized_payload_rejected(env):
    client, _, _, settings = env
    s = create(client)
    sid = s["session_id"]
    obs = observation(sid, 1, 10.0)
    obs["padding"] = "x" * (settings.max_body_bytes + 1)
    r = client.post(f"/v1/sessions/{sid}/observations", json=obs, headers=auth(s["producer_token"]))
    assert r.status_code == 413


def test_game_event_validation(env):
    client, *_ = env
    s = create(client)
    sid, h = s["session_id"], auth(s["consumer_token"])
    url = f"/v1/sessions/{sid}/game-events"
    assert client.post(url, json=game_event(sid, 1, "answer_submitted", 1, task_id="t"), headers=h).status_code == 422
    assert client.post(url, json=game_event(sid, 1, "task_started", 1), headers=h).status_code == 422
    assert client.post(url, json=game_event(sid, 1, "bogus", 1), headers=h).status_code == 422
    ev = game_event(sid, 1, "task_started", 1, task_id="t1", event_id="ev-1")
    assert client.post(url, json=ev, headers=h).json()["status"] == "accepted"
    assert client.post(url, json=ev, headers=h).json()["status"] == "duplicate"


def test_rate_limit(env):
    client, clock, store, settings = env
    s = create(client)
    sid = s["session_id"]
    store.get(sid).game_event_bucket.tokens = 2
    store.get(sid).game_event_bucket.rate = 0.001
    url, h = f"/v1/sessions/{sid}/game-events", auth(s["consumer_token"])
    codes = [
        client.post(url, json=game_event(sid, i, "player_activity", i), headers=h).status_code
        for i in range(1, 5)
    ]
    assert codes == [200, 200, 429, 429]


def test_session_isolation(env):
    client, *_ = env
    a, b = create(client), create(client)
    obs_a = observation(a["session_id"], 1, 10.0, orientation="away", head_away_ms=9000, episode=1)
    # Session A's token cannot write to session B, even with B's id in the body.
    obs_b = observation(b["session_id"], 1, 10.0)
    r = client.post(f"/v1/sessions/{b['session_id']}/observations", json=obs_b, headers=auth(a["producer_token"]))
    assert r.status_code == 403
    r = client.post(f"/v1/sessions/{a['session_id']}/observations", json=obs_a, headers=auth(a["producer_token"]))
    assert r.status_code == 200
    state_a = client.get(f"/v1/sessions/{a['session_id']}/state", headers=auth(a["consumer_token"])).json()
    state_b = client.get(f"/v1/sessions/{b['session_id']}/state", headers=auth(b["consumer_token"])).json()
    assert state_a["state"]["attention_state"] == "HEAD_AWAY"
    assert state_b["state"]["attention_state"] == "UNKNOWN"
    assert state_b["state"]["attention_reason"] == "no_observations"


def test_delete_and_expiry(env):
    client, clock, store, settings = env
    s = create(client)
    sid = s["session_id"]
    assert client.delete(f"/v1/sessions/{sid}", headers=auth(s["consumer_token"])).status_code == 204
    r = client.get(f"/v1/sessions/{sid}/state", headers=auth(s["consumer_token"]))
    assert r.status_code == 404 and r.json()["error"]["code"] == "session_not_found"

    s2 = create(client)
    clock.advance(settings.session_idle_ttl_s + 1)
    store.expire()
    assert store.get(s2["session_id"]) is None


# --- WebSocket -------------------------------------------------------------------------


def test_ws_rejects_foreign_or_missing_origin(env):
    client, *_ = env
    s = create(client)
    for headers in ({"Origin": "https://evil.example"}, {}):
        with pytest.raises(WebSocketDisconnect) as err:
            with client.websocket_connect(f"/v1/sessions/{s['session_id']}/stream", headers=headers) as ws:
                ws.receive_json()
        assert err.value.code == 4403


def test_ws_rejects_wrong_token_and_role(env):
    client, *_ = env
    s = create(client)
    with client.websocket_connect(f"/v1/sessions/{s['session_id']}/stream", headers={"Origin": ORIGIN}) as ws:
        ws.send_json({"type": "hello", "schema_version": "1.0", "role": "consumer",
                      "client_id": "g", "token": s["producer_token"]})
        assert ws.receive_json()["code"] == "unauthorized"
        with pytest.raises(WebSocketDisconnect) as err:
            ws.receive_json()
        assert err.value.code == 4401


def test_ws_unknown_session(env):
    client, *_ = env
    with client.websocket_connect("/v1/sessions/s_nope/stream", headers={"Origin": ORIGIN}) as ws:
        assert ws.receive_json()["code"] == "session_not_found"


def test_ws_producer_to_consumer_flow_without_echo(env):
    client, clock, store, _ = env
    s = create(client)
    sid = s["session_id"]
    with ws_connect(client, sid, "producer", s["producer_token"], "cam-1") as producer, \
            ws_connect(client, sid, "consumer", s["consumer_token"], "game-1") as consumer:
        initial = receive_until(consumer, "state")
        assert initial["state"]["attention_state"] == "UNKNOWN"

        g = gesture("nod", 9.0, 9.5, gesture_id="nod-1")
        clock.advance(0.5)  # outside the state push throttle window
        producer.send_json(observation(sid, 1, 10.0, gestures=[g]))
        ack = producer.receive_json()
        assert ack == {"type": "ack", "kind": "observation", "seq": 1, "status": "accepted", "id": None}
        got = receive_until(consumer, "gesture")
        assert got["gesture"]["gesture_id"] == "nod-1"
        state = receive_until(consumer, "state")
        assert state["state"]["attention_state"] == "HEAD_TOWARD_SCREEN"

        # Game events on the consumer socket are acked but never echoed back as events.
        consumer.send_json(game_event(sid, 1, "task_started", 5.0, task_id="t1", event_id="e-1"))
        ack = receive_until(consumer, "ack")
        assert ack["kind"] == "game_event" and ack["id"] == "e-1"

        # Role separation: producers cannot send game events, consumers cannot send
        # observations, and the producer never receives state/gesture broadcasts.
        producer.send_json(game_event(sid, 2, "player_activity", 6.0))
        assert producer.receive_json()["code"] == "unexpected_message"
        consumer.send_json(observation(sid, 2, 11.0))
        assert receive_until(consumer, "error")["code"] == "unexpected_message"

        # Producer id must match the hello.
        producer.send_json(observation(sid, 3, 12.0, producer_id="cam-evil"))
        assert producer.receive_json()["code"] == "producer_mismatch"


def test_ws_invalid_messages_get_errors_not_disconnects(env):
    client, *_ = env
    s = create(client)
    sid = s["session_id"]
    with ws_connect(client, sid, "producer", s["producer_token"], "cam-1") as producer:
        producer.send_text("not json")
        assert producer.receive_json()["code"] == "invalid_json"
        bad = observation(sid, 1, 10.0)
        bad["measurements"]["head_pitch_deg"] = {"value": None, "reason": None}
        producer.send_json(bad)
        err = producer.receive_json()
        assert err["code"] == "invalid_message" and err["seq"] == 1
        producer.send_json({"type": "ping", "nonce": "n1"})
        assert producer.receive_json() == {"type": "pong", "nonce": "n1"}


def test_ws_oversized_message_closes(env):
    client, _, _, settings = env
    s = create(client)
    with ws_connect(client, s["session_id"], "producer", s["producer_token"], "cam-1") as producer:
        producer.send_text("x" * (settings.max_ws_message_bytes + 10))
        assert producer.receive_json()["code"] == "payload_too_large"
        with pytest.raises(WebSocketDisconnect) as err:
            producer.receive_json()
        assert err.value.code == 1009


def test_ws_consumer_reconnect_replays_unconsumed_actions(env):
    client, clock, store, _ = env
    s = create(client)
    sid = s["session_id"]
    h = auth(s["consumer_token"])
    client.post(f"/v1/sessions/{sid}/game-events",
                json=game_event(sid, 1, "task_started", 1.0, task_id="t1"), headers=h)

    with ws_connect(client, sid, "consumer", s["consumer_token"], "game-1") as consumer:
        receive_until(consumer, "state")
        ph = auth(s["producer_token"])
        for i in range(1, 11):
            clock.advance(0.1)
            client.post(f"/v1/sessions/{sid}/observations",
                        json=observation(sid, i, 10.0 + i * 100, orientation="away",
                                         head_away_ms=i * 100, episode=1), headers=ph)
        action = receive_until(consumer, "suggested_action")
        assert action["action"] == "delay_instruction"

    # Reconnect having consumed the action: nothing is replayed before our pong.
    with ws_connect(client, sid, "consumer", s["consumer_token"], "game-1",
                    resume_after_event_seq=action["event_seq"]) as consumer:
        consumer.send_json({"type": "ping", "nonce": "p"})
        seen = []
        while True:
            msg = consumer.receive_json()
            seen.append(msg["type"])
            if msg["type"] == "pong":
                break
        assert "suggested_action" not in seen

    # Reconnect without having consumed it: replayed with the same action_id.
    with ws_connect(client, sid, "consumer", s["consumer_token"], "game-2",
                    resume_after_event_seq=0) as consumer:
        replayed = receive_until(consumer, "suggested_action")
        assert replayed["action_id"] == action["action_id"]


def test_delete_closes_open_sockets(env):
    client, *_ = env
    s = create(client)
    sid = s["session_id"]
    with ws_connect(client, sid, "consumer", s["consumer_token"], "game-1") as consumer:
        receive_until(consumer, "state")
        assert client.delete(f"/v1/sessions/{sid}", headers=auth(s["producer_token"])).status_code == 204
        with pytest.raises(WebSocketDisconnect) as err:
            for _ in range(10):
                consumer.receive_json()
        assert err.value.code == 4000
