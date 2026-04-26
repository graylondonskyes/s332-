from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from typing import Any

from . import db
from . import provider_mock



def _request_json(method: str, url: str, token: str, payload: dict[str, Any] | None = None) -> Any:
    if provider_mock.mock_mode():
        return provider_mock.request_json(method, url, payload)
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw = resp.read().decode("utf-8") or "{}"
        if not raw:
            return {}
        return json.loads(raw)



def configured_providers() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    google_token = os.getenv("GOOGLE_CALENDAR_ACCESS_TOKEN", "").strip()
    if google_token:
        items.append(
            {
                "provider": "google",
                "token": google_token,
                "calendar_id": os.getenv("GOOGLE_CALENDAR_ID", "primary").strip() or "primary",
                "account_email": os.getenv("GOOGLE_CALENDAR_ACCOUNT_EMAIL", "").strip(),
                "api_base": os.getenv("GOOGLE_CALENDAR_API_BASE", "https://www.googleapis.com/calendar/v3").rstrip("/"),
            }
        )
    ms_token = os.getenv("MICROSOFT_CALENDAR_ACCESS_TOKEN", "").strip()
    if ms_token:
        items.append(
            {
                "provider": "microsoft",
                "token": ms_token,
                "calendar_id": os.getenv("MICROSOFT_CALENDAR_ID", "primary").strip() or "primary",
                "account_email": os.getenv("MICROSOFT_CALENDAR_ACCOUNT_EMAIL", "").strip(),
                "api_base": os.getenv("MICROSOFT_GRAPH_BASE", "https://graph.microsoft.com/v1.0").rstrip("/"),
            }
        )
    return items



def provider_status(org_id: int | None = None) -> list[dict[str, Any]]:
    statuses: list[dict[str, Any]] = []
    links = db.list_calendar_event_links(org_id, limit=500)
    logs = db.list_calendar_sync_logs(org_id, limit=200)
    for cfg in configured_providers():
        provider = cfg["provider"]
        provider_links = [item for item in links if item.get("provider") == provider]
        provider_logs = [item for item in logs if item.get("provider") == provider]
        statuses.append(
            {
                "provider": provider,
                "configured": True,
                "calendar_id": cfg["calendar_id"],
                "account_email": cfg.get("account_email") or "",
                "synced_event_count": len(provider_links),
                "last_activity": provider_logs[0]["created_at"] if provider_logs else "",
            }
        )
    configured_names = {cfg["provider"] for cfg in configured_providers()}
    for provider in ["google", "microsoft"]:
        if provider not in configured_names:
            statuses.append(
                {
                    "provider": provider,
                    "configured": False,
                    "calendar_id": "",
                    "account_email": "",
                    "synced_event_count": 0,
                    "last_activity": "",
                }
            )
    return statuses



def _google_event_url(cfg: dict[str, Any], event_id: str | None = None) -> str:
    calendar_id = urllib.parse.quote(cfg["calendar_id"], safe="")
    base = f"{cfg['api_base']}/calendars/{calendar_id}/events"
    return f"{base}/{urllib.parse.quote(event_id, safe='')}" if event_id else base



def _microsoft_event_base(cfg: dict[str, Any]) -> str:
    if cfg["calendar_id"] == "primary":
        return f"{cfg['api_base']}/me/calendar/events"
    return f"{cfg['api_base']}/me/calendars/{urllib.parse.quote(cfg['calendar_id'], safe='')}/events"



def _microsoft_view_url(cfg: dict[str, Any], start_ts: str, end_ts: str) -> str:
    if cfg["calendar_id"] == "primary":
        base = f"{cfg['api_base']}/me/calendarView"
    else:
        base = f"{cfg['api_base']}/me/calendars/{urllib.parse.quote(cfg['calendar_id'], safe='')}/calendarView"
    query = urllib.parse.urlencode({"startDateTime": start_ts, "endDateTime": end_ts})
    return f"{base}?{query}"



def _build_common_text(appointment: dict[str, Any], lead: dict[str, Any]) -> tuple[str, str]:
    title = f"Appointment · {lead.get('name') or 'Lead'}"
    description = (
        f"Service: {lead.get('service_interest') or 'General'}\n"
        f"Owner: {lead.get('assigned_owner') or 'Scheduling Desk'}\n"
        f"Email: {lead.get('email') or ''}\n"
        f"Phone: {lead.get('phone') or ''}\n"
        f"Confirmation: {appointment.get('confirmation_code') or ''}\n"
        f"Notes: {appointment.get('notes') or lead.get('notes') or ''}"
    )
    return title, description



def _build_google_payload(appointment: dict[str, Any], lead: dict[str, Any]) -> dict[str, Any]:
    title, description = _build_common_text(appointment, lead)
    payload = {
        "summary": title,
        "description": description,
        "start": {"dateTime": appointment["start_ts"]},
        "end": {"dateTime": appointment["end_ts"]},
        "status": "confirmed" if appointment.get("status") in {"booked", "confirmed"} else "cancelled",
    }
    attendees = []
    if lead.get("email"):
        attendees.append({"email": lead["email"], "displayName": lead.get("name") or "Lead"})
    if attendees:
        payload["attendees"] = attendees
    return payload



def _build_microsoft_payload(appointment: dict[str, Any], lead: dict[str, Any]) -> dict[str, Any]:
    title, description = _build_common_text(appointment, lead)
    payload = {
        "subject": title,
        "body": {"contentType": "text", "content": description},
        "start": {"dateTime": appointment["start_ts"], "timeZone": appointment.get("timezone") or "UTC"},
        "end": {"dateTime": appointment["end_ts"], "timeZone": appointment.get("timezone") or "UTC"},
    }
    attendees = []
    if lead.get("email"):
        attendees.append(
            {
                "emailAddress": {"address": lead["email"], "name": lead.get("name") or "Lead"},
                "type": "required",
            }
        )
    if attendees:
        payload["attendees"] = attendees
    return payload



def _extract_google_busy(cfg: dict[str, Any], start_ts: str, end_ts: str) -> list[tuple[str, str]]:
    body = {
        "timeMin": start_ts,
        "timeMax": end_ts,
        "items": [{"id": cfg["calendar_id"]}],
    }
    raw = _request_json("POST", f"{cfg['api_base']}/freeBusy", cfg["token"], body)
    entries = raw.get("calendars", {}).get(cfg["calendar_id"], {}).get("busy", [])
    return [(item["start"], item["end"]) for item in entries if item.get("start") and item.get("end")]



def _extract_microsoft_busy(cfg: dict[str, Any], start_ts: str, end_ts: str) -> list[tuple[str, str]]:
    raw = _request_json("GET", _microsoft_view_url(cfg, start_ts, end_ts), cfg["token"])
    events = raw.get("value", [])
    busy: list[tuple[str, str]] = []
    for item in events:
        if item.get("isCancelled"):
            continue
        start = item.get("start", {}).get("dateTime")
        end = item.get("end", {}).get("dateTime")
        if start and end:
            busy.append((start, end))
    return busy



def external_busy_ranges(start_ts: str, end_ts: str) -> list[tuple[str, str, str]]:
    ranges: list[tuple[str, str, str]] = []
    for cfg in configured_providers():
        try:
            if cfg["provider"] == "google":
                for start, end in _extract_google_busy(cfg, start_ts, end_ts):
                    ranges.append((cfg["provider"], start, end))
            elif cfg["provider"] == "microsoft":
                for start, end in _extract_microsoft_busy(cfg, start_ts, end_ts):
                    ranges.append((cfg["provider"], start, end))
        except Exception:
            continue
    return ranges



def has_external_conflict(start_ts: str, end_ts: str) -> bool:
    start_dt = datetime.fromisoformat(start_ts.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(end_ts.replace("Z", "+00:00"))
    for _, busy_start, busy_end in external_busy_ranges(start_ts, end_ts):
        busy_start_dt = datetime.fromisoformat(str(busy_start).replace("Z", "+00:00"))
        busy_end_dt = datetime.fromisoformat(str(busy_end).replace("Z", "+00:00"))
        if busy_start_dt < end_dt and busy_end_dt > start_dt:
            return True
    return False



def _sync_google(cfg: dict[str, Any], appointment: dict[str, Any], lead: dict[str, Any], existing: dict[str, Any] | None) -> dict[str, Any]:
    payload = _build_google_payload(appointment, lead)
    if appointment.get("status") == "cancelled":
        if existing and existing.get("external_event_id"):
            _request_json("DELETE", _google_event_url(cfg, str(existing["external_event_id"])), cfg["token"])
        return {"external_event_id": str(existing.get("external_event_id") if existing else ""), "external_url": str(existing.get("external_url") if existing else ""), "status": "cancelled", "payload": payload}
    if existing and existing.get("external_event_id"):
        raw = _request_json("PUT", _google_event_url(cfg, str(existing["external_event_id"])), cfg["token"], payload)
    else:
        raw = _request_json("POST", _google_event_url(cfg), cfg["token"], payload)
    return {
        "external_event_id": str(raw.get("id") or existing.get("external_event_id") if existing else raw.get("id") or ""),
        "external_url": str(raw.get("htmlLink") or existing.get("external_url") if existing else raw.get("htmlLink") or ""),
        "status": "synced",
        "payload": raw or payload,
    }



def _sync_microsoft(cfg: dict[str, Any], appointment: dict[str, Any], lead: dict[str, Any], existing: dict[str, Any] | None) -> dict[str, Any]:
    payload = _build_microsoft_payload(appointment, lead)
    base = _microsoft_event_base(cfg)
    if appointment.get("status") == "cancelled":
        if existing and existing.get("external_event_id"):
            event_id = urllib.parse.quote(str(existing["external_event_id"]), safe="")
            _request_json("DELETE", f"{base}/{event_id}", cfg["token"])
        return {"external_event_id": str(existing.get("external_event_id") if existing else ""), "external_url": str(existing.get("external_url") if existing else ""), "status": "cancelled", "payload": payload}
    if existing and existing.get("external_event_id"):
        event_id = urllib.parse.quote(str(existing["external_event_id"]), safe="")
        raw = _request_json("PATCH", f"{base}/{event_id}", cfg["token"], payload)
    else:
        raw = _request_json("POST", base, cfg["token"], payload)
    web_link = raw.get("webLink") if isinstance(raw, dict) else ""
    return {
        "external_event_id": str(raw.get("id") or existing.get("external_event_id") if existing else raw.get("id") or ""),
        "external_url": str(web_link or existing.get("external_url") if existing else web_link or ""),
        "status": "synced",
        "payload": raw or payload,
    }



def sync_appointment(appointment_id: int) -> list[dict[str, Any]]:
    appointment = db.get_appointment(appointment_id)
    if not appointment:
        raise ValueError("Appointment not found.")
    lead = db.get_lead(int(appointment["lead_id"])) or {}
    org_id = int(appointment.get("org_id") or db.get_default_org_id())
    results: list[dict[str, Any]] = []
    for cfg in configured_providers():
        provider = str(cfg["provider"])
        existing = db.get_calendar_event_link(provider, appointment_id)
        try:
            if provider == "google":
                outcome = _sync_google(cfg, appointment, lead, existing)
            else:
                outcome = _sync_microsoft(cfg, appointment, lead, existing)
            link = db.upsert_calendar_event_link(
                org_id,
                provider,
                appointment_id,
                str(cfg["calendar_id"]),
                str(outcome.get("external_event_id") or ""),
                str(outcome.get("external_url") or ""),
                str(outcome.get("status") or "synced"),
                outcome.get("payload") if isinstance(outcome.get("payload"), dict) else {"raw": outcome.get("payload")},
            )
            db.log_calendar_sync(org_id, provider, "sync", "ok", "synced appointment", appointment_id=appointment_id)
            results.append({"provider": provider, "ok": True, "link": link})
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, ValueError, json.JSONDecodeError) as exc:
            db.log_calendar_sync(org_id, provider, "sync", "error", str(exc), appointment_id=appointment_id)
            results.append({"provider": provider, "ok": False, "error": str(exc)})
    return results



def sync_all_active(org_id: int | None = None) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for appt in db.list_appointments(org_id):
        if appt.get("status") not in {"booked", "confirmed", "cancelled"}:
            continue
        results.append({"appointment_id": appt["id"], "results": sync_appointment(int(appt["id"]))})
    return results
