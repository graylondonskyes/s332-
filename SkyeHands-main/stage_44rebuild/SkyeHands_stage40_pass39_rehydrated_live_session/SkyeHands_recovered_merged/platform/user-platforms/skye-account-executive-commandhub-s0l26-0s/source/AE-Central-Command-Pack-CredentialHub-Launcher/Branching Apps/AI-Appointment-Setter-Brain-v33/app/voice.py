from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from . import db
from . import provider_mock
from .logic import build_reply, compute_qualification_status, extract_updates_from_message



def _request_voice_provider(payload: dict[str, Any]) -> dict[str, Any]:
    if provider_mock.mock_mode():
        return provider_mock.voice_call(payload)
    webhook_url = os.getenv("VOICE_WEBHOOK_URL", "").strip()
    if not webhook_url:
        raise ValueError("Voice calling is not configured. Set VOICE_WEBHOOK_URL.")
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8") or "{}"
        raw = json.loads(body)
    return {
        "provider": str(raw.get("provider") or "voice-webhook"),
        "status": str(raw.get("status") or "in-progress"),
        "provider_call_id": str(raw.get("id") or raw.get("call_id") or ""),
        "transcript": str(raw.get("transcript") or ""),
        "outcome": str(raw.get("outcome") or ""),
        "duration_seconds": int(raw.get("duration_seconds") or 0),
    }



def build_voice_script(lead: dict[str, Any], purpose: str = "qualification", appointment: dict[str, Any] | None = None) -> str:
    lead_name = lead.get("name") or "there"
    owner = lead.get("assigned_owner") or "our scheduling desk"
    if purpose == "reminder" and appointment:
        return (
            f"Hi {lead_name}, this is {owner}. This is your automated appointment reminder. "
            f"Your booking is scheduled for {appointment.get('start_ts')}. "
            f"Reply with a better time if you need to move it."
        )
    if purpose == "followup":
        return (
            f"Hi {lead_name}, this is {owner}. I am following up to lock a time for your "
            f"{lead.get('service_interest') or 'consultation'} request. Tell me your best day and time window."
        )
    return (
        f"Hi {lead_name}, this is {owner}. I am the AI appointment setter for your "
        f"{lead.get('service_interest') or 'consultation'} request. I can confirm contact details, urgency, and preferred schedule, "
        "then hand you straight into booking."
    )



def _append_voice_to_session(lead_id: int, text: str, metadata: dict[str, Any]) -> int:
    session = db.get_latest_session_for_lead(lead_id)
    if not session:
        lead = db.get_lead(lead_id) or {}
        session = db.create_session(lead_id, int(lead.get("org_id") or db.get_default_org_id()))
    session_id = int(session["id"])
    db.add_message(session_id, "assistant" if metadata.get("direction") == "outbound" else "user", text, metadata)
    return session_id



def start_voice_call(lead_id: int, purpose: str = "qualification", appointment_id: int | None = None, initiated_by: str = "") -> dict[str, Any]:
    if not provider_mock.mock_mode() and not os.getenv("VOICE_WEBHOOK_URL", "").strip():
        raise ValueError("Voice calling is not configured. Set VOICE_WEBHOOK_URL.")
    lead = db.get_lead(lead_id)
    if not lead:
        raise ValueError("Lead not found.")
    if not lead.get("phone"):
        raise ValueError("Lead has no phone number.")
    appointment = db.get_appointment(appointment_id) if appointment_id else None
    script = build_voice_script(lead, purpose, appointment)
    session_id = _append_voice_to_session(int(lead["id"]), script, {"kind": "voice_script", "purpose": purpose, "direction": "outbound"})
    call = db.create_voice_call(
        {
            "org_id": int(lead.get("org_id") or db.get_default_org_id()),
            "lead_id": int(lead["id"]),
            "appointment_id": appointment_id,
            "session_id": session_id,
            "direction": "outbound",
            "purpose": purpose,
            "from_number": os.getenv("VOICE_FROM_NUMBER", "(555) 010-3000"),
            "to_number": str(lead.get("phone") or ""),
            "provider": "voice-webhook",
            "status": "queued",
            "metadata": {"initiated_by": initiated_by, "script": script},
        }
    )
    payload = {
        "call_id": call["id"],
        "lead_id": lead["id"],
        "appointment_id": appointment_id,
        "to": lead.get("phone"),
        "from": os.getenv("VOICE_FROM_NUMBER", "(555) 010-3000"),
        "purpose": purpose,
        "script": script,
        "lead": {"name": lead.get("name"), "email": lead.get("email"), "service_interest": lead.get("service_interest")},
    }
    try:
        outcome = _request_voice_provider(payload)
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        updated = db.update_voice_call(int(call["id"]), {"status": "failed", "outcome": str(exc)})
        raise ValueError(f"Voice provider failed: {exc}") from exc
    updated = db.update_voice_call(
        int(call["id"]),
        {
            "provider": outcome.get("provider"),
            "provider_call_id": outcome.get("provider_call_id"),
            "status": outcome.get("status"),
            "outcome": outcome.get("outcome"),
            "duration_seconds": outcome.get("duration_seconds"),
            "transcript": outcome.get("transcript"),
        },
    )
    if outcome.get("transcript"):
        db.add_message(session_id, "assistant", str(outcome["transcript"]), {"kind": "voice_transcript", "call_id": call["id"], "purpose": purpose})
    return updated or call



def complete_voice_call(call_id: int, transcript: str = "", status: str = "completed", outcome: str = "", duration_seconds: int = 0, provider_call_id: str = "") -> dict[str, Any]:
    call = db.get_voice_call(call_id)
    if not call:
        raise ValueError("Voice call not found.")
    lead_id = int(call.get("lead_id") or 0)
    session_id = int(call.get("session_id") or 0)
    updated = db.update_voice_call(
        call_id,
        {
            "status": status,
            "outcome": outcome,
            "duration_seconds": duration_seconds,
            "provider_call_id": provider_call_id or call.get("provider_call_id"),
            "transcript": transcript or call.get("transcript") or "",
        },
    )
    if transcript and session_id:
        db.add_message(session_id, "user" if call.get("direction") == "inbound" else "assistant", transcript, {"kind": "voice_completion", "call_id": call_id})
    if lead_id and transcript:
        updates = extract_updates_from_message(transcript)
        lead = db.update_lead(lead_id, updates) or db.get_lead(lead_id) or {}
        db.update_lead(lead_id, {"qualification_status": compute_qualification_status(lead)})
    return updated or call



def ingest_inbound_call(from_number: str, transcript: str, org_id: int | None = None, purpose: str = "inbound") -> dict[str, Any]:
    org_id = org_id or db.get_default_org_id()
    lead = db.get_lead_by_phone(from_number)
    if not lead:
        lead = db.create_lead({"phone": from_number, "name": "Voice Lead", "source": "voice", "org_id": org_id})
    updates = extract_updates_from_message(transcript)
    updates.setdefault("phone", from_number)
    updates.setdefault("source", "voice")
    lead = db.update_lead(int(lead["id"]), updates) or db.get_lead(int(lead["id"])) or lead
    if lead.get("qualification_status") != compute_qualification_status(lead):
        lead = db.update_lead(int(lead["id"]), {"qualification_status": compute_qualification_status(lead)}) or lead
    session = db.get_latest_session_for_lead(int(lead["id"])) or db.create_session(int(lead["id"]), int(lead.get("org_id") or org_id))
    session_id = int(session["id"])
    db.add_message(session_id, "user", transcript, {"kind": "voice_inbound", "from_number": from_number})
    reply = build_reply(lead, transcript)
    db.add_message(session_id, "assistant", reply["text"], {"kind": "voice_followup", "suggested_slots": reply.get("suggested_slots", [])})
    call = db.create_voice_call(
        {
            "org_id": int(lead.get("org_id") or org_id),
            "lead_id": int(lead["id"]),
            "session_id": session_id,
            "direction": "inbound",
            "purpose": purpose,
            "from_number": from_number,
            "to_number": os.getenv("VOICE_FROM_NUMBER", "(555) 010-3000"),
            "provider": "voice-webhook",
            "status": "completed",
            "outcome": "captured",
            "duration_seconds": 35,
            "transcript": transcript,
            "metadata": {"reply_text": reply["text"]},
        }
    )
    return {"call": call, "lead": lead, "session": session, "assistant": reply}
