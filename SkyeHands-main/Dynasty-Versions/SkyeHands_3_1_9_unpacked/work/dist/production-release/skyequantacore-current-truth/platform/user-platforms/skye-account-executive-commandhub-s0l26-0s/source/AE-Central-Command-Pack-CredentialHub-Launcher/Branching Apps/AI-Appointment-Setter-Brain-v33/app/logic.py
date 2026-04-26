from __future__ import annotations

import json
import os
import re
import smtplib
import urllib.error
import urllib.request
import uuid
from email.message import EmailMessage
from datetime import datetime, timedelta, time
from typing import Any
from zoneinfo import ZoneInfo

from . import db
from . import provider_mock
from .ai import polish_response
from .calendar_sync import external_busy_ranges, has_external_conflict

BUSINESS_TZ = "America/Phoenix"
BUSINESS_OPEN_HOUR = 9
BUSINESS_CLOSE_HOUR = 17
APPOINTMENT_MINUTES = 30
APPOINTMENT_BUFFER_MINUTES = 15

DAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

SERVICE_KEYWORDS = [
    "consulting",
    "demo",
    "strategy",
    "web design",
    "automation",
    "ai",
    "marketing",
    "onboarding",
    "sales",
    "support",
]



def get_org_runtime_settings(org_id: int | None = None) -> dict[str, Any]:
    org = db.get_org(org_id or db.get_default_org_id()) or {}
    try:
        operating_days = json.loads(str(org.get('operating_days_json') or '[1,2,3,4,5]'))
    except json.JSONDecodeError:
        operating_days = [1, 2, 3, 4, 5]
    operating_days = [int(day) for day in operating_days if str(day).strip().isdigit() and 0 <= int(day) <= 6]
    if not operating_days:
        operating_days = [1, 2, 3, 4, 5]
    open_hour = int(org.get('open_hour') or BUSINESS_OPEN_HOUR)
    close_hour = int(org.get('close_hour') or BUSINESS_CLOSE_HOUR)
    if close_hour <= open_hour:
        close_hour = min(open_hour + 1, 23)
    slot_minutes = int(org.get('slot_minutes') or APPOINTMENT_MINUTES)
    buffer_minutes = int(org.get('buffer_minutes') or APPOINTMENT_BUFFER_MINUTES)
    reminder_lead_hours = int(org.get('reminder_lead_hours') or 24)
    return {
        'org': org,
        'timezone': str(org.get('timezone') or BUSINESS_TZ),
        'operating_days': operating_days,
        'open_hour': max(0, min(open_hour, 23)),
        'close_hour': max(1, min(close_hour, 23)),
        'slot_minutes': max(15, min(slot_minutes, 240)),
        'buffer_minutes': max(0, min(buffer_minutes, 180)),
        'reminder_lead_hours': max(1, min(reminder_lead_hours, 168)),
        'autonomy_enabled': bool(int(org.get('autonomy_enabled') or 0)),
        'auto_followup_hours': max(1, min(int(org.get('auto_followup_hours') or 24), 720)),
        'auto_noshow_minutes': max(15, min(int(org.get('auto_noshow_minutes') or 90), 1440)),
        'auto_invoice_followup_hours': max(1, min(int(org.get('auto_invoice_followup_hours') or 48), 720)),
        'auto_intake_followup_hours': max(1, min(int(org.get('auto_intake_followup_hours') or 24), 720)),
        'booking_notice': str(org.get('booking_notice') or '').strip(),
        'default_deposit_cents': max(0, int(org.get('default_deposit_cents') or 0)),
        'default_service_price_cents': max(0, int(org.get('default_service_price_cents') or 0)),
        'currency': str(org.get('currency') or 'USD').strip() or 'USD',
        'payment_instructions': str(org.get('payment_instructions') or '').strip(),
    }



def weekday_label(day: int) -> str:
    names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return names[int(day)] if 0 <= int(day) < len(names) else 'Day'



def format_operating_hours(org_id: int | None = None) -> str:
    settings = get_org_runtime_settings(org_id)
    days = settings['operating_days']
    if days == [0, 1, 2, 3, 4, 5, 6]:
        day_label = 'Every day'
    elif days == [0, 1, 2, 3, 4]:
        day_label = 'Monday–Friday'
    elif days == [5, 6]:
        day_label = 'Saturday–Sunday'
    else:
        day_label = ', '.join(weekday_label(day) for day in days)
    start = datetime(2000, 1, 1, settings['open_hour'], 0).strftime('%I:%M %p').lstrip('0')
    end = datetime(2000, 1, 1, settings['close_hour'], 0).strftime('%I:%M %p').lstrip('0')
    return f"{day_label} · {start}–{end}"



def now_in_tz(tz_name: str = BUSINESS_TZ) -> datetime:
    return datetime.now(ZoneInfo(tz_name))



def parse_iso_any(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=ZoneInfo(BUSINESS_TZ))
    return dt



def to_iso(dt: datetime) -> str:
    return dt.isoformat()



def infer_day_preference(text: str) -> dict[str, Any]:
    lower = (text or "").lower()
    result: dict[str, Any] = {}
    for name, weekday in DAY_MAP.items():
        if name in lower:
            result["weekday"] = weekday
            result["weekday_name"] = name
            break
    if "morning" in lower:
        result["window"] = "morning"
    elif "afternoon" in lower:
        result["window"] = "afternoon"
    elif "evening" in lower:
        result["window"] = "evening"
    return result



def extract_updates_from_message(message: str) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    lower = (message or "").lower()

    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", message)
    if email_match:
        updates["email"] = email_match.group(0)

    phone_match = re.search(r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", message)
    if phone_match:
        updates["phone"] = phone_match.group(0)

    for keyword in SERVICE_KEYWORDS:
        if keyword in lower:
            updates["service_interest"] = keyword.title()
            break

    if any(token in lower for token in ["asap", "urgent", "today"]):
        updates["urgency"] = "urgent"
    elif any(token in lower for token in ["this week", "soon"]):
        updates["urgency"] = "high"
    elif "this month" in lower:
        updates["urgency"] = "medium"
    elif "exploring" in lower:
        updates["urgency"] = "low"

    day_pref = infer_day_preference(message)
    if day_pref:
        parts = []
        if day_pref.get("weekday_name"):
            parts.append(day_pref["weekday_name"].title())
        if day_pref.get("window"):
            parts.append(day_pref["window"].title())
        updates["preferred_schedule"] = " ".join(parts)

    return updates



def compute_qualification_status(lead: dict[str, Any]) -> str:
    required = [lead.get("name"), lead.get("service_interest"), lead.get("urgency")]
    if required[0] and required[1] and required[2] and (lead.get("email") or lead.get("phone")):
        return "qualified"
    return "new"



def build_suggested_slots(days: int = 7, preferred_text: str = "", output_timezone: str = BUSINESS_TZ, org_id: int | None = None) -> list[dict[str, Any]]:
    settings = get_org_runtime_settings(org_id)
    org_tz = str(settings['timezone'] or BUSINESS_TZ)
    slot_minutes = int(settings['slot_minutes'])
    buffer_minutes = int(settings['buffer_minutes'])
    now_local = now_in_tz(org_tz)
    preference = infer_day_preference(preferred_text)
    slots: list[dict[str, Any]] = []
    cutoff = now_local + timedelta(days=days)
    cursor_day = now_local.date()
    external_busy = external_busy_ranges(to_iso(now_local), to_iso(cutoff + timedelta(days=1)))

    while datetime.combine(cursor_day, time(0, 0), tzinfo=ZoneInfo(org_tz)) <= cutoff and len(slots) < 8:
        weekday = cursor_day.weekday()
        if weekday in settings['operating_days']:
            if preference.get("weekday") is not None and preference["weekday"] != weekday:
                cursor_day += timedelta(days=1)
                continue

            block_start = int(settings['open_hour'])
            block_end = int(settings['close_hour'])
            if preference.get("window") == "morning":
                block_end = 12
            elif preference.get("window") == "afternoon":
                block_start = 12
            elif preference.get("window") == "evening":
                block_start = 16
                block_end = 17

            current = datetime.combine(cursor_day, time(block_start, 0), tzinfo=ZoneInfo(org_tz))
            end_boundary = datetime.combine(cursor_day, time(block_end, 0), tzinfo=ZoneInfo(org_tz))
            while current + timedelta(minutes=slot_minutes) <= end_boundary and len(slots) < 8:
                if current >= now_local + timedelta(hours=1):
                    appt_end = current + timedelta(minutes=slot_minutes)
                    conflicts = db.list_active_appointments_between(to_iso(current), to_iso(appt_end), org_id=org_id)
                    external_conflict = False
                    for _, busy_start, busy_end in external_busy:
                        busy_start_dt = parse_iso_any(busy_start)
                        busy_end_dt = parse_iso_any(busy_end)
                        if busy_start_dt < appt_end and busy_end_dt > current:
                            external_conflict = True
                            break
                    if not conflicts and not external_conflict:
                        out_tz = ZoneInfo(output_timezone or BUSINESS_TZ)
                        start_out = current.astimezone(out_tz)
                        end_out = appt_end.astimezone(out_tz)
                        slots.append(
                            {
                                "start": to_iso(start_out),
                                "end": to_iso(end_out),
                                "display": start_out.strftime("%a %b %d · %I:%M %p"),
                                "timezone": output_timezone or org_tz,
                            }
                        )
                current += timedelta(minutes=slot_minutes + buffer_minutes)
        cursor_day += timedelta(days=1)
    return slots



def make_confirmation_code() -> str:
    return uuid.uuid4().hex[:8].upper()



def book_appointment(lead_id: int, session_id: int | None, start_ts: str, timezone: str, notes: str = "") -> dict[str, Any]:
    lead = db.get_lead(lead_id)
    if not lead:
        raise ValueError("Lead not found.")
    org_id = int(lead.get("org_id") or db.get_default_org_id())
    settings = get_org_runtime_settings(org_id)
    org_tz = str(settings['timezone'] or BUSINESS_TZ)
    slot_minutes = int(settings['slot_minutes'])
    start_dt = parse_iso_any(start_ts)
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=ZoneInfo(timezone or org_tz))
    start_business = start_dt.astimezone(ZoneInfo(org_tz))
    end_business = start_business + timedelta(minutes=slot_minutes)
    conflicts = db.list_active_appointments_between(to_iso(start_business), to_iso(end_business), org_id=org_id)
    if conflicts:
        raise ValueError("That slot is no longer available.")
    if has_external_conflict(to_iso(start_business), to_iso(end_business)):
        raise ValueError("That slot conflicts with a connected calendar event.")

    created = db.create_appointment(
        {
            "org_id": org_id,
            "lead_id": lead_id,
            "session_id": session_id,
            "start_ts": to_iso(start_business),
            "end_ts": to_iso(end_business),
            "timezone": timezone or BUSINESS_TZ,
            "status": "booked",
            "notes": notes,
            "confirmation_code": make_confirmation_code(),
        }
    )
    db.update_lead(lead_id, {"qualification_status": "booked"})
    return created or {}



def reschedule_appointment(appointment_id: int, new_start_ts: str, timezone: str) -> dict[str, Any]:
    appt = db.get_appointment(appointment_id)
    if not appt:
        raise ValueError("Appointment not found.")
    org_id = int(appt.get("org_id") or db.get_default_org_id())
    settings = get_org_runtime_settings(org_id)
    org_tz = str(settings['timezone'] or BUSINESS_TZ)
    slot_minutes = int(settings['slot_minutes'])
    start_dt = parse_iso_any(new_start_ts)
    start_business = start_dt.astimezone(ZoneInfo(org_tz))
    end_business = start_business + timedelta(minutes=slot_minutes)
    conflicts = [
        row for row in db.list_active_appointments_between(to_iso(start_business), to_iso(end_business), org_id=org_id)
        if int(row["id"]) != appointment_id
    ]
    if conflicts:
        raise ValueError("That new slot is not available.")
    if has_external_conflict(to_iso(start_business), to_iso(end_business)):
        raise ValueError("That new slot conflicts with a connected calendar event.")
    updated = db.update_appointment(
        appointment_id,
        {
            "start_ts": to_iso(start_business),
            "end_ts": to_iso(end_business),
            "timezone": timezone or BUSINESS_TZ,
            "status": "booked",
        },
    )
    return updated or {}



def cancel_appointment(appointment_id: int) -> dict[str, Any]:
    appt = db.get_appointment(appointment_id)
    if not appt:
        raise ValueError("Appointment not found.")
    updated = db.update_appointment(appointment_id, {"status": "cancelled"})
    return updated or {}



def list_commercial_catalog(org_id: int | None = None) -> dict[str, Any]:
    return {
        'services': db.list_services(org_id, active_only=True),
        'packages': db.list_packages(org_id, active_only=True),
    }


def recommend_commercial_items(lead: dict[str, Any], latest_user_message: str = '') -> dict[str, Any]:
    org_id = int(lead.get('org_id') or db.get_default_org_id())
    catalog = list_commercial_catalog(org_id)
    text = f"{lead.get('service_interest') or ''} {latest_user_message}".lower()
    services = catalog['services']
    packages = catalog['packages']
    ranked_services = []
    for service in services:
        score = 0
        metadata = service.get('metadata') or {}
        keywords = metadata.get('keywords') or []
        for keyword in keywords:
            if str(keyword).lower() in text:
                score += 3
        if str(service.get('name') or '').lower() in text:
            score += 4
        if str(service.get('slug') or '').replace('-', ' ') in text:
            score += 2
        ranked_services.append((score, service))
    ranked_services.sort(key=lambda item: (item[0], int(item[1].get('base_price_cents') or 0)), reverse=True)
    ranked_packages = sorted(packages, key=lambda item: int(item.get('total_price_cents') or 0))
    service = ranked_services[0][1] if ranked_services else (services[0] if services else None)
    package = ranked_packages[0] if ranked_packages else None
    return {'service': service, 'package': package, 'catalog': catalog}


def detect_sales_objection(message: str) -> dict[str, str]:
    lower = (message or '').lower()
    if any(token in lower for token in ['refund', 'angry', 'upset', 'lawyer', 'complaint']):
        return {'type': 'risk', 'label': 'sensitive escalation language'}
    if any(token in lower for token in ['human', 'person', 'call me', 'speak to someone']):
        return {'type': 'human', 'label': 'human handoff requested'}
    if any(token in lower for token in ['too expensive', 'price', 'budget', 'cost']):
        return {'type': 'price', 'label': 'price concern'}
    if any(token in lower for token in ['not sure', 'maybe later', 'later', 'need to think']):
        return {'type': 'timing', 'label': 'timing hesitation'}
    return {'type': '', 'label': ''}


def escalation_from_message(lead: dict[str, Any], session_id: int | None, latest_user_message: str, appointment_id: int | None = None, source: str = 'chat') -> dict[str, Any] | None:
    reason = detect_sales_objection(latest_user_message)
    if reason['type'] not in {'human', 'risk'}:
        return None
    priority = 'urgent' if reason['type'] == 'risk' else 'high'
    summary = f"Lead {lead.get('name') or 'Lead'} triggered {reason['label']} with message: {latest_user_message.strip()[:220]}"
    suggested_reply = 'A team member will take over this thread and follow up directly.'
    return db.create_escalation({
        'org_id': int(lead.get('org_id') or db.get_default_org_id()),
        'lead_id': int(lead.get('id') or 0),
        'session_id': session_id,
        'appointment_id': appointment_id,
        'priority': priority,
        'status': 'open',
        'reason': reason['label'],
        'summary': summary,
        'suggested_reply': suggested_reply,
        'source': source,
    })


def compose_sales_guidance(lead: dict[str, Any], latest_user_message: str = '') -> dict[str, Any]:
    recommendation = recommend_commercial_items(lead, latest_user_message)
    service = recommendation.get('service')
    package = recommendation.get('package')
    objection = detect_sales_objection(latest_user_message)
    guidance = ''
    if objection['type'] == 'price' and service:
        guidance = (
            f"The fastest way to keep this moving is the {service.get('name')} lane at "
            f"USD {db.cents_to_currency_value(int(service.get('base_price_cents') or 0)):,.2f}. "
            f"If you want to lock the lane first, the working deposit is USD {db.cents_to_currency_value(int(service.get('deposit_cents') or 0)):,.2f}."
        )
    elif objection['type'] == 'timing' and service:
        guidance = f"You do not have to decide the whole project right now. The {service.get('name')} call is the smallest truthful next step and gets the details scoped cleanly."
    elif objection['type'] == 'human':
        guidance = 'A human closer can take over this thread. I am placing this into the escalation queue now.'
    elif service:
        guidance = f"Best fit right now looks like {service.get('name')}."
        if package:
            guidance += f" If you want the broader lane, the {package.get('name')} package is also available."
    return {'objection': objection, 'service': service, 'package': package, 'guidance': guidance}


def build_reply(lead: dict[str, Any], latest_user_message: str = "") -> dict[str, Any]:
    status = compute_qualification_status(lead)
    if lead.get("qualification_status") != status and lead.get("id"):
        db.update_lead(int(lead["id"]), {"qualification_status": status})
        lead = db.get_lead(int(lead["id"])) or lead

    missing: list[str] = []
    if not lead.get("name"):
        missing.append("name")
    if not (lead.get("email") or lead.get("phone")):
        missing.append("contact method")
    if not lead.get("service_interest"):
        missing.append("service interest")
    if not lead.get("urgency"):
        missing.append("urgency")

    suggested_slots: list[dict[str, Any]] = []
    org_id = int(lead.get("org_id") or db.get_default_org_id())
    owner = str(lead.get("assigned_owner") or "Scheduling Desk")
    sales = compose_sales_guidance(lead, latest_user_message)
    memory = db.refresh_lead_memory(int(lead.get('id') or 0)) if lead.get('id') else None

    if missing:
        if len(missing) == 1:
            base = f"I can lock this in fast. I still need your {missing[0]} before I place you into the booking lane."
        else:
            base = "I can qualify this and move straight to booking. I still need " + ", ".join(missing[:-1]) + f", and {missing[-1]}."
    else:
        preferred = lead.get("preferred_schedule") or latest_user_message
        suggested_slots = build_suggested_slots(
            preferred_text=preferred,
            output_timezone=lead.get("timezone") or BUSINESS_TZ,
            org_id=org_id,
        )
        if suggested_slots:
            base = (
                f"{owner} has your lane. You are qualified for a {lead.get('service_interest')} call. "
                "Pick one of the openings below and I will confirm it instantly."
            )
        else:
            base = (
                f"{owner} has your lane. You are qualified and I am searching for space on the calendar. "
                "Send your preferred day and whether you want morning or afternoon."
            )
        if sales.get('guidance'):
            base += " " + str(sales.get('guidance') or '')
        if memory and memory.get('summary'):
            base += f" Memory check: {memory.get('summary')}"

    text = polish_response(
        base,
        {
            "lead": lead,
            "latest_user_message": latest_user_message,
            "suggested_slots": suggested_slots,
        },
    )
    return {
        "text": text,
        "suggested_slots": suggested_slots,
        "qualification_status": status,
        "recommended_service": sales.get('service') or {},
        "recommended_package": sales.get('package') or {},
        "objection": sales.get('objection') or {},
    }


def build_reminder_candidates(org_id: int | None = None) -> list[dict[str, Any]]:
    scope_org_id = org_id or None
    settings = get_org_runtime_settings(scope_org_id)
    now = now_in_tz(str(settings['timezone'] or BUSINESS_TZ))
    reminders: list[dict[str, Any]] = []
    for appt in db.list_appointments(scope_org_id):
        if appt.get("status") not in {"booked", "confirmed"}:
            continue
        lead = db.get_lead(int(appt["lead_id"])) or {}
        start_dt = parse_iso_any(appt["start_ts"])
        delta = start_dt - now
        if delta.total_seconds() <= 0:
            continue
        reminder_window = timedelta(hours=int(settings['reminder_lead_hours']))
        if delta <= reminder_window:
            reminder_type = f"{int(settings['reminder_lead_hours'])}h" if delta > timedelta(hours=2) else "2h"
            available_channels = configured_outbound_channels()
            channel = ""
            recipient = ""
            if "sms" in available_channels and lead.get("phone"):
                channel = "sms"
                recipient = str(lead.get("phone") or "").strip()
            elif "email" in available_channels and lead.get("email"):
                channel = "email"
                recipient = str(lead.get("email") or "").strip()
            if not channel or not recipient:
                continue
            text = (
                f"Reminder from {lead.get('assigned_owner') or 'the scheduling desk'}: "
                f"you are booked for {start_dt.astimezone(ZoneInfo(lead.get('timezone') or BUSINESS_TZ)).strftime('%a %b %d at %I:%M %p')} "
                f"({lead.get('timezone') or BUSINESS_TZ}). Confirmation {appt.get('confirmation_code')}."
            )
            reminders.append(
                {
                    "appointment_id": appt["id"],
                    "lead_id": lead.get("id"),
                    "org_id": appt.get("org_id"),
                    "lead_name": lead.get("name", "Lead"),
                    "channel": channel,
                    "recipient": recipient,
                    "type": reminder_type,
                    "scheduled_for": appt["start_ts"],
                    "body": text,
                    "already_queued": bool(appt.get("reminder_last_queued_at")),
                    "already_sent": bool(appt.get("reminder_last_sent_at")),
                }
            )
    return reminders



def preview_reminders(org_id: int | None = None) -> list[dict[str, Any]]:
    return build_reminder_candidates(org_id)



def queue_reminders(org_id: int | None = None) -> list[dict[str, Any]]:
    queued: list[dict[str, Any]] = []
    now = db.utcnow_iso()
    for reminder in build_reminder_candidates(org_id):
        appt = db.get_appointment(int(reminder["appointment_id"])) or {}
        if appt.get("reminder_last_queued_at"):
            continue
        if not outbound_channel_ready(str(reminder["channel"])):
            continue
        msg = db.enqueue_outbound_message(
            int(reminder["org_id"]),
            int(reminder["lead_id"]),
            int(reminder["appointment_id"]),
            str(reminder["channel"]),
            str(reminder["recipient"]),
            str(reminder["body"]),
            subject="Appointment reminder",
            transport=("sms-webhook" if reminder["channel"] == "sms" else ("smtp-direct" if os.getenv('SMTP_HOST', '').strip() else "email-webhook")),
            metadata={"type": reminder["type"], "scheduled_for": reminder["scheduled_for"]},
        )
        db.update_appointment(int(reminder["appointment_id"]), {"reminder_last_queued_at": now})
        if msg:
            queued.append(msg)
    return queued


def _best_lead_contact_channel(lead: dict[str, Any]) -> tuple[str, str]:
    available_channels = configured_outbound_channels()
    phone = str(lead.get('phone') or '').strip()
    email = str(lead.get('email') or '').strip()
    if 'sms' in available_channels and phone:
        return 'sms', phone
    if 'email' in available_channels and email:
        return 'email', email
    return '', ''


def _recent_outbound_exists(
    lead_id: int,
    kind: str,
    within_hours: int,
    *,
    appointment_id: int | None = None,
    invoice_id: int | None = None,
) -> bool:
    cutoff = datetime.now(ZoneInfo('UTC')) - timedelta(hours=max(1, within_hours))
    for item in db.list_outbound_messages_for_lead(lead_id, limit=80):
        metadata = item.get('metadata') or {}
        if str(metadata.get('kind') or '') != kind:
            continue
        if appointment_id and int(metadata.get('appointment_id') or 0) not in {0, appointment_id}:
            continue
        if invoice_id and int(metadata.get('invoice_id') or 0) not in {0, invoice_id}:
            continue
        stamp = str(item.get('dispatched_at') or item.get('created_at') or '').strip()
        if not stamp:
            continue
        try:
            seen_at = parse_iso_any(stamp).astimezone(ZoneInfo('UTC'))
        except Exception:
            continue
        if seen_at >= cutoff:
            return True
    return False


def _enqueue_automation_message(
    lead: dict[str, Any],
    *,
    kind: str,
    subject: str,
    body: str,
    appointment_id: int | None = None,
    invoice_id: int | None = None,
    channel_override: str = '',
    recipient_override: str = '',
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    channel, recipient = _best_lead_contact_channel(lead)
    if channel_override and recipient_override:
        channel, recipient = channel_override, recipient_override
    if not channel or not recipient:
        return None
    if not outbound_channel_ready(channel):
        return None
    lead_id = int(lead.get('id') or 0)
    org_id = int(lead.get('org_id') or db.get_default_org_id())
    session = db.get_latest_session_for_lead(lead_id) or db.create_session(lead_id, org_id) or {}
    merged_metadata = {
        'kind': kind,
        'automation': True,
        'appointment_id': appointment_id or 0,
        'invoice_id': invoice_id or 0,
        **(metadata or {}),
    }
    if session.get('id'):
        db.add_message(int(session['id']), 'assistant', body, {
            'origin': 'automation',
            'kind': kind,
            'channel': channel,
            'appointment_id': appointment_id or 0,
            'invoice_id': invoice_id or 0,
        })
    transport = 'sms-webhook' if channel == 'sms' else ('smtp-direct' if os.getenv('SMTP_HOST', '').strip() else 'email-webhook')
    return db.enqueue_outbound_message(
        org_id,
        lead_id,
        appointment_id,
        channel,
        recipient,
        body,
        subject=subject,
        transport=transport,
        metadata=merged_metadata,
    )


def _slot_lines(slots: list[dict[str, Any]]) -> str:
    if not slots:
        return ''
    lines = []
    for slot in slots[:3]:
        lines.append(f"- {slot.get('label') or slot.get('start')}")
    return '\n'.join(lines)


def run_autonomy_cycle(org_id: int | None = None) -> dict[str, Any]:
    settings = get_org_runtime_settings(org_id)
    resolved_org_id = int((settings.get('org') or {}).get('id') or org_id or db.get_default_org_id())
    result: dict[str, Any] = {
        'enabled': bool(settings.get('autonomy_enabled')),
        'org_id': resolved_org_id,
        'queued_count': 0,
        'dispatched_count': 0,
        'auto_followups': 0,
        'intake_reminders': 0,
        'invoice_reminders': 0,
        'no_show_recoveries': 0,
        'message_ids': [],
    }
    if not settings.get('autonomy_enabled'):
        return result

    now_utc = datetime.now(ZoneInfo('UTC'))
    followup_cutoff = now_utc - timedelta(hours=int(settings.get('auto_followup_hours') or 24))
    intake_window = now_utc + timedelta(hours=int(settings.get('auto_intake_followup_hours') or 24))
    no_show_cutoff = now_utc - timedelta(minutes=int(settings.get('auto_noshow_minutes') or 90))
    queued_ids: list[int] = []

    for lead in db.list_leads(resolved_org_id):
        lead_id = int(lead.get('id') or 0)
        if not lead_id:
            continue
        active_appointment = db.get_next_active_appointment_for_lead(lead_id)
        latest_touch_raw = str(lead.get('last_contacted_at') or lead.get('updated_at') or lead.get('created_at') or '').strip()
        try:
            latest_touch = parse_iso_any(latest_touch_raw).astimezone(ZoneInfo('UTC')) if latest_touch_raw else now_utc
        except Exception:
            latest_touch = now_utc

        if not active_appointment and latest_touch <= followup_cutoff and not _recent_outbound_exists(lead_id, 'auto_followup', int(settings.get('auto_followup_hours') or 24)):
            reply = build_reply(lead, 'Follow up and help them book the next best slot.')
            slots = build_suggested_slots(4, str(lead.get('preferred_schedule') or ''), str(lead.get('timezone') or BUSINESS_TZ), org_id=resolved_org_id)[:3]
            body = reply.get('text') or 'Checking back in to help you lock a time.'
            if slots:
                body += f"\n\nOpenings right now:\n{_slot_lines(slots)}"
            body += f"\n\nReply with the opening you want and I will keep the process moving."
            queued = _enqueue_automation_message(
                lead,
                kind='auto_followup',
                subject='Checking back on your appointment request',
                body=body,
                metadata={'slot_count': len(slots)},
            )
            if queued and queued.get('id'):
                queued_ids.append(int(queued['id']))
                result['auto_followups'] += 1

        if active_appointment:
            appointment_id = int(active_appointment.get('id') or 0)
            try:
                appointment_start = parse_iso_any(str(active_appointment.get('start_ts') or '')).astimezone(ZoneInfo('UTC'))
            except Exception:
                appointment_start = now_utc
            intake_packet = db.get_intake_packet_for_lead(lead_id)
            if intake_packet and int(intake_packet.get('waiver_accepted') or 0) != 1 and now_utc <= appointment_start <= intake_window:
                if not _recent_outbound_exists(lead_id, 'auto_intake_followup', int(settings.get('auto_intake_followup_hours') or 24), appointment_id=appointment_id):
                    body = (
                        f"This is a reminder to complete your intake and waiver before your appointment on "
                        f"{appointment_start.astimezone(ZoneInfo(str(lead.get('timezone') or BUSINESS_TZ))).strftime('%a %b %d at %I:%M %p')} .\n\n"
                        f"Use your manage link to finish the intake before the meeting starts.\n{appointment_manage_url(active_appointment)}"
                    )
                    queued = _enqueue_automation_message(
                        lead,
                        kind='auto_intake_followup',
                        subject='Complete your intake before the appointment',
                        body=body,
                        appointment_id=appointment_id,
                    )
                    if queued and queued.get('id'):
                        queued_ids.append(int(queued['id']))
                        result['intake_reminders'] += 1

            if appointment_start <= no_show_cutoff and str(active_appointment.get('status') or '') in {'booked', 'confirmed'}:
                if not _recent_outbound_exists(lead_id, 'auto_no_show_recovery', 24, appointment_id=appointment_id):
                    updated = db.update_appointment(appointment_id, {'status': 'no_show'}) or active_appointment
                    recovery_slots = build_suggested_slots(4, str(lead.get('preferred_schedule') or ''), str(lead.get('timezone') or BUSINESS_TZ), org_id=resolved_org_id)[:3]
                    body = (
                        f"We missed you for the scheduled appointment. If you still want the meeting, you can reschedule right away here:\n"
                        f"{appointment_manage_url(updated)}"
                    )
                    if recovery_slots:
                        body += f"\n\nNext open spots:\n{_slot_lines(recovery_slots)}"
                    queued = _enqueue_automation_message(
                        lead,
                        kind='auto_no_show_recovery',
                        subject='We missed you — reschedule here',
                        body=body,
                        appointment_id=appointment_id,
                        metadata={'status': 'no_show'},
                    )
                    if queued and queued.get('id'):
                        queued_ids.append(int(queued['id']))
                        result['no_show_recoveries'] += 1

        billing = db.get_billing_snapshot_for_lead(lead_id)
        open_invoices = [item for item in billing.get('invoices', []) if int(item.get('balance_cents') or 0) > 0 and str(item.get('status') or '') != 'void']
        if open_invoices:
            invoice = open_invoices[0]
            due_raw = str(invoice.get('due_ts') or '').strip()
            due_ready = True
            if due_raw:
                try:
                    due_ready = parse_iso_any(due_raw).astimezone(ZoneInfo('UTC')) <= now_utc + timedelta(hours=int(settings.get('auto_invoice_followup_hours') or 48))
                except Exception:
                    due_ready = True
            if due_ready and not _recent_outbound_exists(lead_id, 'auto_invoice_followup', int(settings.get('auto_invoice_followup_hours') or 48), invoice_id=int(invoice.get('id') or 0)):
                outstanding = db.cents_to_currency_value(int(invoice.get('balance_cents') or 0))
                body = (
                    f"There is an outstanding balance of {invoice.get('currency') or 'USD'} {outstanding:,.2f} on invoice {invoice.get('invoice_code')}."
                )
                instructions = str(settings.get('payment_instructions') or '').strip()
                if instructions:
                    body += f"\n\nPayment instructions:\n{instructions}"
                queued = _enqueue_automation_message(
                    lead,
                    kind='auto_invoice_followup',
                    subject='Outstanding balance reminder',
                    body=body,
                    invoice_id=int(invoice.get('id') or 0),
                )
                if queued and queued.get('id'):
                    queued_ids.append(int(queued['id']))
                    result['invoice_reminders'] += 1

    dispatched = dispatch_outbound(resolved_org_id, queued_ids) if queued_ids else []
    result['queued_count'] = len(queued_ids)
    result['dispatched_count'] = len(dispatched)
    result['message_ids'] = queued_ids
    return result



def public_base_url() -> str:
    return str(os.getenv("APP_BASE_URL", "http://127.0.0.1:8018")).rstrip("/")


def build_ics_content(appointment: dict[str, Any], lead: dict[str, Any]) -> str:
    brand = str(os.getenv("APP_BRAND", "Appointment Setter"))
    start = parse_iso_any(str(appointment["start_ts"]))
    end = parse_iso_any(str(appointment["end_ts"]))
    uid = f"appt-{appointment.get('id')}-{appointment.get('confirmation_code') or uuid.uuid4().hex}@local"
    summary = f"{brand} · {lead.get('service_interest') or 'Appointment'}"
    description = (
        f"Lead: {lead.get('name') or 'Lead'}\n"
        f"Email: {lead.get('email') or ''}\n"
        f"Phone: {lead.get('phone') or ''}\n"
        f"Confirmation: {appointment.get('confirmation_code') or ''}\n"
        f"Notes: {appointment.get('notes') or lead.get('notes') or ''}"
    )
    location = str(os.getenv("APPOINTMENT_LOCATION", "Booked through the appointment setter"))

    def fmt(dt: datetime) -> str:
        return dt.astimezone(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ")

    def esc(value: str) -> str:
        return value.replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', '\\n')
    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Appointment Setter//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        f'UID:{uid}',
        f'DTSTAMP:{fmt(datetime.now(ZoneInfo("UTC")))}',
        f'DTSTART:{fmt(start)}',
        f'DTEND:{fmt(end)}',
        f'SUMMARY:{esc(summary)}',
        f'DESCRIPTION:{esc(description)}',
        f'LOCATION:{esc(location)}',
        'STATUS:CONFIRMED' if appointment.get('status') != 'cancelled' else 'STATUS:CANCELLED',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
    ]
    return '\r\n'.join(lines)


def appointment_ics_url(appointment: dict[str, Any]) -> str:
    return f"{public_base_url()}/api/appointments/{appointment.get('id')}/ics?code={appointment.get('confirmation_code') or ''}"



def appointment_manage_url(appointment: dict[str, Any]) -> str:
    return f"{public_base_url()}/manage/index.html?code={appointment.get('confirmation_code') or ''}"



def get_public_appointment_by_code(code: str) -> dict[str, Any] | None:
    if not code:
        return None
    return db.get_appointment_by_confirmation_code(code)



def serialize_public_appointment(appointment: dict[str, Any]) -> dict[str, Any]:
    lead = db.get_lead(int(appointment.get('lead_id') or 0)) or {}
    org_id = int(appointment.get('org_id') or db.get_default_org_id())
    settings = get_org_runtime_settings(org_id)
    intake = db.get_or_create_intake_packet(int(lead.get('id') or 0), int(appointment.get('id') or 0), org_id) if lead else None
    billing = db.get_billing_snapshot_for_lead(int(lead.get('id') or 0)) if lead else {'invoices': [], 'payments': [], 'payment_commitments': [], 'totals': {}}
    memory = db.refresh_lead_memory(int(lead.get('id') or 0)) if lead else None
    documents = db.get_or_create_portal_documents_for_lead(int(lead.get('id') or 0), int(appointment.get('id') or 0), org_id) if lead else []
    quotes = db.list_quotes(org_id, int(lead.get('id') or 0)) if lead else []
    artifacts = db.list_artifacts_for_lead(int(lead.get('id') or 0), visible_to_client=True) if lead else []
    return {
        'appointment': appointment,
        'lead': {
            'id': lead.get('id'),
            'name': lead.get('name') or 'Lead',
            'email': lead.get('email') or '',
            'phone': lead.get('phone') or '',
            'service_interest': lead.get('service_interest') or '',
            'timezone': lead.get('timezone') or settings['timezone'],
        },
        'intake': intake or {},
        'billing': billing,
        'memory': memory or {},
        'documents': documents,
        'quotes': quotes,
        'artifacts': artifacts,
        'settings': {
            'currency': settings.get('currency') or 'USD',
            'payment_instructions': settings.get('payment_instructions') or '',
        },
        'ics_url': appointment_ics_url(appointment),
        'manage_url': appointment_manage_url(appointment),
        'suggested_slots': build_suggested_slots(preferred_text=str(lead.get('preferred_schedule') or ''), output_timezone=str(lead.get('timezone') or settings['timezone']), org_id=org_id),
    }


def enqueue_appointment_notice(appointment_id: int, kind: str = 'confirmation') -> list[dict[str, Any]]:
    appointment = db.get_appointment(appointment_id) or {}
    if not appointment:
        return []
    lead = db.get_lead(int(appointment.get('lead_id') or 0)) or {}
    queued: list[dict[str, Any]] = []
    when = parse_iso_any(str(appointment.get('start_ts') or '')).astimezone(ZoneInfo(lead.get('timezone') or BUSINESS_TZ)).strftime('%a %b %d at %I:%M %p') if appointment.get('start_ts') else ''
    if kind == 'rescheduled':
        subject = 'Appointment moved'
        opener = 'Your appointment was moved.'
    elif kind == 'cancelled':
        subject = 'Appointment cancelled'
        opener = 'Your appointment was cancelled.'
    elif kind == 'confirmed_by_reply':
        subject = 'Appointment confirmed'
        opener = 'Your appointment reply was received and your booking is now confirmed.'
    elif kind == 'reschedule_request':
        subject = 'Choose a new appointment time'
        opener = 'We received your request to move the appointment.'
    else:
        subject = 'Appointment confirmed'
        opener = 'Your appointment is confirmed.'
    settings = get_org_runtime_settings(int(appointment.get('org_id') or db.get_default_org_id()))
    booking_notice = str(settings.get('booking_notice') or '').strip()
    manage_url = appointment_manage_url(appointment)
    ics_url = appointment_ics_url(appointment)
    body = (
        f"{opener}\n\n"
        f"When: {when} ({lead.get('timezone') or settings.get('timezone') or BUSINESS_TZ})\n"
        f"Confirmation: {appointment.get('confirmation_code') or ''}\n"
        f"Manage this appointment: {manage_url}\n"
        f"Download calendar file: {ics_url}\n"
        + (f"\nNote: {booking_notice}\n" if booking_notice else "")
        + "\nReply to this message if you need to change the time."
    )
    sms_body = (
        f"{opener} When: {when}. Code: {appointment.get('confirmation_code') or ''}. "
        f"Manage: {manage_url}"
    )
    if lead.get('email') and outbound_channel_ready('email'):
        msg = db.enqueue_outbound_message(
            int(appointment.get('org_id') or db.get_default_org_id()),
            int(lead.get('id') or 0),
            int(appointment.get('id') or 0),
            'email',
            str(lead.get('email') or ''),
            body,
            subject=subject,
            transport='smtp-direct' if os.getenv('SMTP_HOST', '').strip() else ('email-webhook' if os.getenv('EMAIL_WEBHOOK_URL', '').strip() else 'queued-email'),
            metadata={'notice_kind': kind, 'ics_url': ics_url},
        )
        if msg:
            queued.append(msg)
    if lead.get('phone') and outbound_channel_ready('sms'):
        msg = db.enqueue_outbound_message(
            int(appointment.get('org_id') or db.get_default_org_id()),
            int(lead.get('id') or 0),
            int(appointment.get('id') or 0),
            'sms',
            str(lead.get('phone') or ''),
            sms_body,
            subject='',
            transport='sms-webhook',
            metadata={'notice_kind': kind, 'manage_url': manage_url},
        )
        if msg:
            queued.append(msg)
    return queued


def send_via_smtp(payload: dict[str, Any]) -> tuple[str, str, str]:
    smtp_host = os.getenv('SMTP_HOST', '').strip()
    if not smtp_host:
        raise ValueError('SMTP_HOST is not configured.')
    smtp_port = int(os.getenv('SMTP_PORT', '587').strip() or '587')
    smtp_username = os.getenv('SMTP_USERNAME', '').strip()
    smtp_password = os.getenv('SMTP_PASSWORD', '')
    smtp_from = os.getenv('SMTP_FROM_EMAIL', smtp_username or os.getenv('APP_SUPPORT_EMAIL', 'support@example.com')).strip()
    smtp_from_name = os.getenv('SMTP_FROM_NAME', os.getenv('APP_BRAND', 'Appointment Setter')).strip()
    use_tls = str(os.getenv('SMTP_USE_TLS', 'true')).strip().lower() not in {'0', 'false', 'no', 'off'}

    message = EmailMessage()
    message['From'] = f'{smtp_from_name} <{smtp_from}>' if smtp_from_name else smtp_from
    message['To'] = str(payload.get('recipient') or '')
    subject = str(payload.get('subject') or 'Appointment update')
    message['Subject'] = subject
    message.set_content(str(payload.get('body') or ''))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.ehlo()
        if use_tls:
            server.starttls()
            server.ehlo()
        if smtp_username:
            server.login(smtp_username, smtp_password)
        server.send_message(message)
    return ('smtp-direct', 'sent', '')


def send_via_webhook(channel: str, payload: dict[str, Any]) -> tuple[str, str, str]:
    if channel == "email" and os.getenv("SMTP_HOST", "").strip():
        return send_via_smtp(payload)

    if provider_mock.mock_mode():
        return provider_mock.outbound_message(channel, payload)

    env_key = "SMS_WEBHOOK_URL" if channel == "sms" else "EMAIL_WEBHOOK_URL"
    webhook_url = os.getenv(env_key, "").strip()
    if not webhook_url:
        raise ValueError(f"{env_key} is not configured.")

    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body_text = resp.read().decode("utf-8") or "{}"
        try:
            body = json.loads(body_text)
        except json.JSONDecodeError:
            body = {"raw": body_text}
        provider_id = str(body.get("id") or body.get("message_id") or "")
        return (f"{channel}-webhook", "sent", provider_id)
    except urllib.error.URLError as exc:
        raise ValueError(f"Webhook delivery failed: {exc}") from exc



def dispatch_outbound(org_id: int | None = None, message_ids: list[int] | None = None) -> list[dict[str, Any]]:
    dispatched: list[dict[str, Any]] = []
    allowed = set(message_ids or [])
    for msg in db.list_pending_outbound_messages(org_id):
        if allowed and int(msg["id"]) not in allowed:
            continue
        payload = {
            "message_id": msg["id"],
            "channel": msg["channel"],
            "recipient": msg["recipient"],
            "subject": msg.get("subject", ""),
            "body": msg["body"],
            "metadata": msg.get("metadata", {}),
        }
        try:
            transport, status, provider_id = send_via_webhook(str(msg["channel"]), payload)
            updated = db.update_outbound_message(
                int(msg["id"]),
                {
                    "transport": transport,
                    "status": status,
                    "provider_message_id": provider_id,
                    "error_text": "",
                    "dispatched_at": db.utcnow_iso(),
                },
            )
            if msg.get("appointment_id"):
                db.update_appointment(int(msg["appointment_id"]), {"reminder_last_sent_at": db.utcnow_iso()})
            if updated:
                dispatched.append(updated)
        except ValueError as exc:
            updated = db.update_outbound_message(
                int(msg["id"]),
                {
                    "status": "failed",
                    "error_text": str(exc),
                    "transport": str(msg.get("transport") or "unconfigured"),
                },
            )
            if updated:
                dispatched.append(updated)
    return dispatched





def configured_inbound_channels() -> set[str]:
    channels: set[str] = set()
    if os.getenv("SMS_INBOUND_SECRET", "").strip():
        channels.add("sms")
    if os.getenv("EMAIL_INBOUND_SECRET", "").strip():
        channels.add("email")
    return channels



def inbound_channel_ready(channel: str) -> bool:
    return channel in configured_inbound_channels()



def _ensure_lead_for_inbound(channel: str, payload: dict[str, Any]) -> dict[str, Any]:
    org_id = db.resolve_org_id(payload.get('org_id'), payload.get('org_slug'))
    lead = None
    lead_id = int(payload.get('lead_id') or 0)
    if lead_id:
        lead = db.get_lead(lead_id)
    sender = str(payload.get('from') or payload.get('sender') or '').strip()
    sender_name = str(payload.get('sender_name') or '').strip()
    if not lead and channel == 'sms' and sender:
        lead = db.get_lead_by_phone(sender)
    if not lead and channel == 'email' and sender:
        for item in db.list_leads(org_id):
            if str(item.get('email') or '').strip().lower() == sender.lower():
                lead = item
                break
    if lead:
        updates: dict[str, Any] = {}
        if channel == 'sms' and sender and not str(lead.get('phone') or '').strip():
            updates['phone'] = sender
        if channel == 'email' and sender and not str(lead.get('email') or '').strip():
            updates['email'] = sender
        if sender_name and not str(lead.get('name') or '').strip():
            updates['name'] = sender_name
        if updates:
            lead = db.update_lead(int(lead['id']), updates) or lead
        return lead
    name_guess = sender_name or (sender.split('@', 1)[0].replace('.', ' ').replace('_', ' ').title() if channel == 'email' and '@' in sender else f'{channel.upper()} Lead')
    lead = db.create_lead({
        'org_id': org_id,
        'name': name_guess,
        'email': sender if channel == 'email' else '',
        'phone': sender if channel == 'sms' else '',
        'service_interest': str(payload.get('service_interest') or ''),
        'source': f'inbound-{channel}',
        'notes': f'Lead created from inbound {channel}.',
        'qualification_status': 'new',
    })
    return lead



def _ensure_session_for_lead(lead_id: int, org_id: int) -> dict[str, Any]:
    session = db.get_latest_session_for_lead(lead_id)
    if session:
        return session
    return db.create_session(lead_id, org_id) or {}



def handle_inbound_message(channel: str, payload: dict[str, Any]) -> dict[str, Any]:
    if channel not in {'sms', 'email'}:
        raise ValueError('Unsupported inbound channel.')
    body = str(payload.get('body') or payload.get('text') or payload.get('message') or '').strip()
    sender = str(payload.get('from') or payload.get('sender') or '').strip()
    recipient = str(payload.get('to') or payload.get('recipient') or '').strip()
    subject = str(payload.get('subject') or '').strip()
    if not body or not sender:
        raise ValueError('Inbound message requires sender and body.')
    lead = _ensure_lead_for_inbound(channel, payload)
    org_id = int(lead.get('org_id') or db.get_default_org_id())
    session = _ensure_session_for_lead(int(lead['id']), org_id)
    db.add_message(int(session['id']), 'user', body, {
        'origin': 'inbound',
        'channel': channel,
        'sender': sender,
        'recipient': recipient,
        'subject': subject,
        'provider_message_id': str(payload.get('provider_message_id') or payload.get('message_id') or ''),
    })
    updates = extract_updates_from_message(body)
    if channel == 'sms' and sender and not updates.get('phone'):
        updates['phone'] = sender
    if channel == 'email' and sender and not updates.get('email'):
        updates['email'] = sender
    lead = db.update_lead(int(lead['id']), updates) or lead
    appointment = db.get_next_active_appointment_for_lead(int(lead['id']))
    action_taken = ''
    dispatched: list[dict[str, Any]] = []
    auto_reply: dict[str, Any] | None = None
    escalation: dict[str, Any] | None = None
    if appointment and re.search(r'\bconfirm(ed|ation)?\b', body, re.I):
        if str(appointment.get('status') or '') != 'confirmed':
            appointment = db.update_appointment(int(appointment['id']), {'status': 'confirmed'}) or appointment
            action_taken = 'appointment_confirmed'
            queued = enqueue_appointment_notice(int(appointment['id']), 'confirmed_by_reply')
            dispatched = dispatch_outbound(org_id, [int(item['id']) for item in queued]) if queued else []
    elif appointment and re.search(r'\bcancel(l?ed|ation)?\b', body, re.I):
        appointment = cancel_appointment(int(appointment['id']))
        action_taken = 'appointment_cancelled'
        queued = enqueue_appointment_notice(int(appointment['id']), 'cancelled')
        dispatched = dispatch_outbound(org_id, [int(item['id']) for item in queued]) if queued else []
    elif appointment and re.search(r'\b(reschedul(e|ing)|move|different time|change time)\b', body, re.I):
        action_taken = 'reschedule_requested'
        queued = enqueue_appointment_notice(int(appointment['id']), 'reschedule_request')
        dispatched = dispatch_outbound(org_id, [int(item['id']) for item in queued]) if queued else []

    reply_channel = channel if outbound_channel_ready(channel) else _best_lead_contact_channel(lead)[0]
    if reply_channel and action_taken == 'reschedule_requested' and appointment:
        slot_suggestions = build_suggested_slots(4, str(lead.get('preferred_schedule') or ''), str(lead.get('timezone') or BUSINESS_TZ), org_id=org_id)[:3]
        reply_body = (
            f"I can help move this appointment. Use your manage link here:\n{appointment_manage_url(appointment)}"
        )
        if slot_suggestions:
            reply_body += f"\n\nNext open spots:\n{_slot_lines(slot_suggestions)}"
        auto_reply = _enqueue_automation_message(
            lead,
            kind='inbound_auto_reply',
            subject='Reschedule options',
            body=reply_body,
            appointment_id=int(appointment.get('id') or 0),
            channel_override=reply_channel,
            recipient_override=sender,
            metadata={'reply_channel': reply_channel, 'trigger': 'reschedule'},
        )
    elif reply_channel and not action_taken:
        reply = build_reply(lead, body)
        escalation = escalation_from_message(lead, int(session.get('id') or 0) or None, body, int(appointment.get('id') or 0) if appointment else None, 'inbound')
        slot_suggestions = reply.get('suggested_slots') or build_suggested_slots(4, str(lead.get('preferred_schedule') or ''), str(lead.get('timezone') or BUSINESS_TZ), org_id=org_id)[:3]
        reply_body = str(reply.get('text') or 'I can help you get booked.')
        if slot_suggestions:
            reply_body += f"\n\nOpenings right now:\n{_slot_lines(slot_suggestions[:3])}"
        if appointment:
            reply_body += f"\n\nManage your appointment here:\n{appointment_manage_url(appointment)}"
        auto_reply = _enqueue_automation_message(
            lead,
            kind='inbound_auto_reply',
            subject='Appointment follow-up',
            body=reply_body,
            appointment_id=int(appointment.get('id') or 0) if appointment else None,
            channel_override=reply_channel,
            recipient_override=sender,
            metadata={'reply_channel': reply_channel, 'trigger': 'conversation'},
        )
    if auto_reply and auto_reply.get('id'):
        dispatched.extend(dispatch_outbound(org_id, [int(auto_reply['id'])]))
    db.refresh_lead_memory(int(lead['id']))
    inbound = db.create_inbound_message({
        'org_id': org_id,
        'lead_id': int(lead['id']),
        'appointment_id': int(appointment['id']) if appointment else None,
        'session_id': int(session.get('id') or 0) or None,
        'channel': channel,
        'sender': sender,
        'recipient': recipient,
        'subject': subject,
        'body': body,
        'provider_message_id': str(payload.get('provider_message_id') or payload.get('message_id') or ''),
        'status': 'received',
        'action_taken': action_taken,
        'metadata': {'sender_name': str(payload.get('sender_name') or '').strip()},
    }) or {}
    return {
        'lead': lead,
        'session': session,
        'appointment': appointment,
        'inbound': inbound,
        'action_taken': action_taken,
        'auto_reply': auto_reply,
        'dispatched': dispatched,
        'escalation': escalation,
    }



def configured_outbound_channels() -> set[str]:
    channels: set[str] = set()
    if os.getenv("SMS_WEBHOOK_URL", "").strip():
        channels.add("sms")
    if os.getenv("SMTP_HOST", "").strip() or os.getenv("EMAIL_WEBHOOK_URL", "").strip():
        channels.add("email")
    return channels


def outbound_channel_ready(channel: str) -> bool:
    return channel in configured_outbound_channels()

def score_no_show_risk(lead: dict[str, Any], messages: list[dict[str, Any]], appointment: dict[str, Any] | None = None) -> dict[str, Any]:
    score = 0
    reasons: list[str] = []

    if not lead.get("phone"):
        score += 20
        reasons.append("No phone on record")
    if (lead.get("urgency") or "").lower() in {"low", "exploring", ""}:
        score += 18
        reasons.append("Low urgency signal")
    if len(messages) <= 2:
        score += 16
        reasons.append("Thin conversation depth")
    if not lead.get("preferred_schedule"):
        score += 10
        reasons.append("No stated scheduling preference")
    if appointment:
        try:
            start_dt = parse_iso_any(str(appointment["start_ts"]))
            delta_hours = (start_dt - now_in_tz(BUSINESS_TZ)).total_seconds() / 3600
            if delta_hours > 120:
                score += 18
                reasons.append("Appointment is far out")
            if delta_hours < 4:
                score += 8
                reasons.append("Tight turnaround before appointment")
        except Exception:
            pass
    if any((msg.get("text") or "").lower().find(token) >= 0 for msg in messages for token in ["maybe", "not sure", "reschedule"]):
        score += 14
        reasons.append("Message language shows uncertainty")

    score = min(score, 100)
    if score >= 65:
        label = "high"
    elif score >= 35:
        label = "medium"
    else:
        label = "low"
    return {"score": score, "label": label, "reasons": reasons[:4]}



def build_risk_board(org_id: int | None = None) -> list[dict[str, Any]]:
    board: list[dict[str, Any]] = []
    appointments_by_lead = {int(appt["lead_id"]): appt for appt in db.list_appointments(org_id) if appt.get("status") in {"booked", "confirmed"}}
    for lead in db.list_leads(org_id):
        lead_id = int(lead["id"])
        messages = db.get_conversation_for_lead(lead_id)
        appointment = appointments_by_lead.get(lead_id)
        risk = score_no_show_risk(lead, messages, appointment)
        board.append(
            {
                "lead_id": lead_id,
                "name": lead.get("name") or "Lead",
                "assigned_owner": lead.get("assigned_owner") or "Unassigned",
                "service_interest": lead.get("service_interest") or "—",
                "appointment_start": appointment.get("start_ts") if appointment else "",
                **risk,
            }
        )
    board.sort(key=lambda item: int(item["score"]), reverse=True)
    return board
