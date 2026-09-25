"""Builders for well-formed messages, so each test only states what it cares about."""

from __future__ import annotations

import itertools
import uuid
from typing import Any

_seq = itertools.count()


def m(value: Any = None, reason: str | None = None) -> dict[str, Any]:
    if value is None and reason is None:
        reason = "not_available"
    return {"value": value, "reason": reason}


def observation(
    session_id: str,
    seq: int,
    capture_ts_ms: float,
    *,
    producer_id: str = "cam-1",
    orientation: str | None = "toward",
    head_away_ms: float = 0.0,
    episode: int | None = 0,
    valid: bool = True,
    status: str | None = None,
    calibration: str = "calibrated",
    gestures: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    status = status or ("tracking" if valid else "no_face")
    tracked = valid
    return {
        "type": "observation",
        "schema_version": "1.0",
        "session_id": session_id,
        "producer_id": producer_id,
        "seq": seq,
        "capture_ts_ms": capture_ts_ms,
        "tracking": {
            "status": status,
            "valid": valid,
            "reason": None if valid else status,
            "face_count": 1 if tracked else 0,
            "multiple_faces_visible": False,
            "quality": m(0.9) if tracked else m(reason=status),
        },
        "calibration": {"status": calibration, "reason": None, "progress": None},
        "measurements": {
            "head_yaw_deg": m(0.0 if orientation == "toward" else 40.0) if tracked else m(reason=status),
            "head_pitch_deg": m(0.0) if tracked else m(reason=status),
            "head_roll_deg": m(0.0) if tracked else m(reason=status),
            "head_facing_score": m(0.95 if orientation == "toward" else 0.1) if tracked else m(reason=status),
            "head_orientation": m(orientation) if tracked and orientation else m(reason="no_orientation"),
            "head_away_ms": m(head_away_ms) if tracked else m(reason=status),
            "head_away_episode": episode,
            "eye_openness_left": m(1.0) if tracked else m(reason=status),
            "eye_openness_right": m(1.0) if tracked else m(reason=status),
            "eye_blink_coefficient_left": m(0.05) if tracked else m(reason=status),
            "eye_blink_coefficient_right": m(0.05) if tracked else m(reason=status),
            "eyes_closed": m(False) if tracked else m(reason=status),
            "eyes_closed_ms": m(0.0) if tracked else m(reason=status),
        },
        "gestures": gestures or [],
        "perf": {
            "backend": "worker",
            "delegate": "GPU",
            "inference_ms": 12.0,
            "processed_fps": 15.0,
            "dropped_frames": 0,
        },
    }


def gesture(kind: str, start: float, end: float, gesture_id: str | None = None) -> dict[str, Any]:
    return {
        "gesture_id": gesture_id or uuid.uuid4().hex,
        "type": kind,
        "start_ts_ms": start,
        "end_ts_ms": end,
        "amplitude_deg": 12.0 if kind != "blink" else None,
        "swings": 2 if kind != "blink" else None,
    }


def game_event(
    session_id: str,
    seq: int,
    event_type: str,
    client_ts_ms: float,
    *,
    task_id: str | None = None,
    source_id: str = "game-1",
    event_id: str | None = None,
    **data: Any,
) -> dict[str, Any]:
    return {
        "type": "game_event",
        "schema_version": "1.0",
        "session_id": session_id,
        "source_id": source_id,
        "seq": seq,
        "event_id": event_id or uuid.uuid4().hex,
        "client_ts_ms": client_ts_ms,
        "event_type": event_type,
        "task_id": task_id,
        "data": data,
    }


class FakeClock:
    def __init__(self, start: float = 1000.0) -> None:
        self.t = start

    def __call__(self) -> float:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += seconds
