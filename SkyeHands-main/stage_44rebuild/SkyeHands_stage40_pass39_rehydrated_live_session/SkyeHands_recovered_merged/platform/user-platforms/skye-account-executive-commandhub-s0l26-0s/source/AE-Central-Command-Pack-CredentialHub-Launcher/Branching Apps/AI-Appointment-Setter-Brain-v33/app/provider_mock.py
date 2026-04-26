from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = Path(os.getenv("APPT_SETTER_MOCK_STATE_PATH", str(ROOT / "data" / "mock-provider-state.json")))


def mock_mode() -> bool:
    raw = str(os.getenv("APPT_SETTER_PROVIDER_MODE", "")).strip().lower()
    return raw in {"mock", "local-mock", "1", "true", "yes", "on"}


def _default_state() -> dict[str, Any]:
    return {
        "google_events": {},
        "microsoft_events": {},
        "voice_calls": [],
        "messages": [],
        "next_google": 1,
        "next_microsoft": 1,
        "next_voice": 1,
        "next_message": 1,
        "updated_at": "",
    }


def _ensure_dir() -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)


def read_state() -> dict[str, Any]:
    _ensure_dir()
    if not STATE_PATH.exists():
        state = _default_state()
        STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
        return state
    try:
        raw = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raw = _default_state()
    state = _default_state()
    state.update(raw if isinstance(raw, dict) else {})
    return state


def write_state(state: dict[str, Any]) -> dict[str, Any]:
    _ensure_dir()
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
    return state


def _google_event_url(event_id: str) -> str:
    return f"mock://google/events/{event_id}"


def _microsoft_event_url(event_id: str) -> str:
    return f"mock://microsoft/events/{event_id}"


def request_json(method: str, url: str, payload: dict[str, Any] | None = None) -> Any:
    state = read_state()
    payload = payload or {}
    if "freeBusy" in url and "google" in url:
        busy = []
        for event in state["google_events"].values():
            if event.get("status") == "cancelled":
                continue
            start = (event.get("start") or {}).get("dateTime")
            end = (event.get("end") or {}).get("dateTime")
            if start and end:
                busy.append({"start": start, "end": end})
        return {"calendars": {"primary": {"busy": busy}}}
    if "google" in url and "/events" in url:
        if method == "POST":
            event_id = f"g{int(state['next_google'])}"
            state["next_google"] = int(state["next_google"]) + 1
            row = dict(payload)
            row["id"] = event_id
            row["htmlLink"] = _google_event_url(event_id)
            state["google_events"][event_id] = row
            write_state(state)
            return row
        if method == "PUT":
            event_id = url.rstrip("/").rsplit("/", 1)[-1]
            row = dict(payload)
            row["id"] = event_id
            row["htmlLink"] = _google_event_url(event_id)
            state["google_events"][event_id] = row
            write_state(state)
            return row
        if method == "DELETE":
            event_id = url.rstrip("/").rsplit("/", 1)[-1]
            if event_id in state["google_events"]:
                state["google_events"][event_id]["status"] = "cancelled"
                write_state(state)
            return {}
    if "calendarView" in url and "microsoft" in url:
        return {"value": [event for event in state["microsoft_events"].values() if not event.get("isCancelled")]}
    if "microsoft" in url and ("/calendar/events" in url or "/calendars/" in url):
        if method == "POST":
            event_id = f"m{int(state['next_microsoft'])}"
            state["next_microsoft"] = int(state["next_microsoft"]) + 1
            row = dict(payload)
            row["id"] = event_id
            row["webLink"] = _microsoft_event_url(event_id)
            state["microsoft_events"][event_id] = row
            write_state(state)
            return row
        if method == "PATCH":
            event_id = url.rstrip("/").rsplit("/", 1)[-1]
            current = dict(state["microsoft_events"].get(event_id) or {})
            current.update(payload)
            current["id"] = event_id
            current.setdefault("webLink", _microsoft_event_url(event_id))
            state["microsoft_events"][event_id] = current
            write_state(state)
            return current
        if method == "DELETE":
            event_id = url.rstrip("/").rsplit("/", 1)[-1]
            if event_id in state["microsoft_events"]:
                state["microsoft_events"][event_id]["isCancelled"] = True
                write_state(state)
            return {}
    raise ValueError(f"Unsupported mock provider request: {method} {url}")


def voice_call(payload: dict[str, Any]) -> dict[str, Any]:
    state = read_state()
    call_id = f"voice-{int(state['next_voice'])}"
    state["next_voice"] = int(state["next_voice"]) + 1
    state["voice_calls"].append({"id": call_id, **payload})
    write_state(state)
    return {
        "provider": "voice-mock",
        "status": "completed",
        "provider_call_id": call_id,
        "transcript": f"Voice mock completed for {payload.get('to')}",
        "outcome": "connected",
        "duration_seconds": 47,
    }


def outbound_message(channel: str, payload: dict[str, Any]) -> tuple[str, str, str]:
    state = read_state()
    message_id = f"{channel}-msg-{int(state['next_message'])}"
    state["next_message"] = int(state["next_message"]) + 1
    state["messages"].append({"id": message_id, "channel": channel, **payload})
    write_state(state)
    return (f"{channel}-mock", "sent", message_id)
