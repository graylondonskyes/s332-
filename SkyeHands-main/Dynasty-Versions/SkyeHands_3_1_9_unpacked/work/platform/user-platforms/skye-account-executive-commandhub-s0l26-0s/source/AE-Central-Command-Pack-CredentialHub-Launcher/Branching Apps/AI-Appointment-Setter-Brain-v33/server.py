from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import time
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).resolve().parent


def load_local_env(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ[key] = value


load_local_env(ROOT_DIR / ".env")

from app import db
from app.ai import ai_configured
from app.auth import (
    SESSION_COOKIE,
    hash_password,
    login_lockout_minutes,
    login_lockout_threshold,
    new_session_token,
    role_allows,
    session_ttl_hours,
    validate_password_policy,
    verify_password,
)
from app.calendar_sync import provider_status, sync_all_active, sync_appointment
from app.logic import (
    BUSINESS_TZ,
    appointment_ics_url,
    appointment_manage_url,
    book_appointment,
    build_ics_content,
    build_reply,
    build_risk_board,
    build_suggested_slots,
    cancel_appointment,
    compute_qualification_status,
    configured_inbound_channels,
    configured_outbound_channels,
    dispatch_outbound,
    enqueue_appointment_notice,
    escalation_from_message,
    handle_inbound_message,
    extract_updates_from_message,
    format_operating_hours,
    get_org_runtime_settings,
    get_public_appointment_by_code,
    preview_reminders,
    queue_reminders,
    run_autonomy_cycle,
    reschedule_appointment,
    serialize_public_appointment,
)
from app.runtime import WORKER
from app.security import csrf_token, is_production, secure_cookie_enabled, webhook_signature
from app.voice import complete_voice_call, ingest_inbound_call, start_voice_call

STATIC_DIR = ROOT_DIR / "static"
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8018"))
PUBLIC_BRAND = os.getenv("APP_BRAND", "Skyes Appointment Setter")
PUBLIC_SUPPORT_EMAIL = os.getenv("APP_SUPPORT_EMAIL", "support@example.com")
PUBLIC_SUPPORT_PHONE = os.getenv("APP_SUPPORT_PHONE", "(555) 010-2026")


def create_server(host: str = HOST, port: int = PORT) -> ThreadingHTTPServer:
    db.init_db()
    httpd = ThreadingHTTPServer((host, port), AppHandler)
    setattr(httpd, "background_worker", WORKER)
    WORKER.start()
    return httpd


def human_datetime(value: str, timezone_name: str) -> str:
    raw = str(value or '').strip()
    if not raw:
        return ''
    try:
        dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        return dt.astimezone(ZoneInfo(timezone_name or BUSINESS_TZ)).strftime('%A, %b %d at %-I:%M %p')
    except Exception:
        return raw


def format_playbook_template(template: str, context: dict[str, object]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        value = context.get(key, '')
        return str(value if value is not None else '')
    return re.sub(r'\{([a-z_]+)\}', repl, str(template or ''))


def build_playbook_context(lead: dict[str, object], appointment: dict[str, object] | None = None) -> dict[str, str]:
    lead_id = int(lead.get('id') or 0)
    org_id = int(lead.get('org_id') or db.get_default_org_id())
    appointment = appointment or db.get_next_active_appointment_for_lead(lead_id) or {}
    settings = get_org_runtime_settings(org_id)
    name = str(lead.get('name') or 'Client').strip() or 'Client'
    first_name = name.split()[0] if name else 'Client'
    manage_url = appointment_manage_url(appointment or {}) if appointment else ''
    ics_url = appointment_ics_url(appointment or {}) if appointment else ''
    billing = db.get_billing_snapshot_for_lead(lead_id) if lead_id else {'outstanding_cents': 0}
    outstanding_cents = int((billing or {}).get('outstanding_cents') or 0)
    quotes = db.list_quotes(org_id, lead_id) if lead_id else []
    latest_quote = quotes[0] if quotes else {}
    timezone_name = str(appointment.get('timezone') or lead.get('timezone') or settings.get('timezone') or BUSINESS_TZ)
    return {
        'lead_name': name,
        'first_name': first_name,
        'business_name': str(lead.get('business_name') or 'your business').strip() or 'your business',
        'service_interest': str(lead.get('service_interest') or 'appointment').strip() or 'appointment',
        'assigned_owner': str(lead.get('assigned_owner') or 'Founder Desk').strip() or 'Founder Desk',
        'support_email': str(settings.get('support_email') or PUBLIC_SUPPORT_EMAIL),
        'support_phone': str(settings.get('support_phone') or PUBLIC_SUPPORT_PHONE),
        'preferred_schedule': str(lead.get('preferred_schedule') or '').strip(),
        'manage_url': manage_url,
        'ics_url': ics_url,
        'appointment_time': human_datetime(str(appointment.get('start_ts') or ''), timezone_name),
        'appointment_timezone': timezone_name,
        'confirmation_code': str(appointment.get('confirmation_code') or ''),
        'quote_title': str(latest_quote.get('title') or ''),
        'quote_code': str(latest_quote.get('quote_code') or ''),
        'quote_total': f"{(int(latest_quote.get('amount_cents') or 0)/100):,.2f}",
        'outstanding_balance': f"${(outstanding_cents/100):,.2f}",
        'lead_email': str(lead.get('email') or '').strip(),
        'lead_phone': str(lead.get('phone') or '').strip(),
        'source': str(lead.get('source') or '').strip(),
    }




def _is_ae_bridge_lead(lead: dict[str, object]) -> bool:
    source = str(lead.get('source') or '').strip().lower()
    tags = [str(item).strip().lower() for item in list(lead.get('tags') or [])]
    notes = str(lead.get('notes') or '').lower()
    return source == 'ae-command' or 'ae-command' in tags or 'appointment brain' in notes or 'ae handoff' in notes


def _find_ae_bridge_match(org_id: int, item: dict[str, object]) -> dict[str, object] | None:
    email = str(item.get('email') or '').strip().lower()
    phone_norm = db.normalize_phone(str(item.get('phone') or ''))
    name = str(item.get('clientName') or item.get('name') or '').strip().lower()
    company = str(item.get('company') or item.get('business_name') or '').strip().lower()
    for lead in db.list_leads(org_id):
        if email and str(lead.get('email') or '').strip().lower() == email:
            return lead
        if phone_norm and str(lead.get('phone_normalized') or '').strip() == phone_norm:
            return lead
        if name and company and str(lead.get('name') or '').strip().lower() == name and str(lead.get('business_name') or '').strip().lower() == company:
            return lead
    return None


def _build_ae_bridge_summary(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    appointments = db.list_appointments(org_id)
    appointment_map: dict[int, list[dict[str, object]]] = {}
    for appt in appointments:
        lead_id = int(appt.get('lead_id') or 0)
        appointment_map.setdefault(lead_id, []).append(appt)
    returnable = 0
    booked_or_confirmed = 0
    unqualified = 0
    recent = []
    for lead in leads:
        lead_id = int(lead.get('id') or 0)
        lead_appointments = appointment_map.get(lead_id, [])
        if any(str(item.get('status') or '').lower() in {'booked', 'confirmed'} for item in lead_appointments):
            booked_or_confirmed += 1
            returnable += 1
        if str(lead.get('qualification_status') or 'new').lower() in {'new', 'watch', 'pending'}:
            unqualified += 1
        if len(recent) < 12:
            recent.append({
                'id': lead_id,
                'name': lead.get('name') or '',
                'business_name': lead.get('business_name') or '',
                'qualification_status': lead.get('qualification_status') or 'new',
                'source': lead.get('source') or '',
                'assigned_owner': lead.get('assigned_owner') or '',
                'tags': list(lead.get('tags') or []),
            })
    return {
        'summary': {
            'ae_source_leads': len(leads),
            'booked_or_confirmed': booked_or_confirmed,
            'returnable': returnable,
            'unqualified': unqualified,
        },
        'recent': recent,
    }


def _build_ae_bridge_export(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    appointments = db.list_appointments(org_id)
    payload_rows = []
    for lead in leads:
        lead_id = int(lead.get('id') or 0)
        lead_appointments = [appt for appt in appointments if int(appt.get('lead_id') or 0) == lead_id]
        latest_appointment = sorted(lead_appointments, key=lambda item: str(item.get('updated_at') or item.get('created_at') or ''), reverse=True)[0] if lead_appointments else {}
        payload_rows.append({
            'leadId': lead_id,
            'clientName': lead.get('name') or '',
            'company': lead.get('business_name') or '',
            'email': lead.get('email') or '',
            'phone': lead.get('phone') or '',
            'source': lead.get('source') or '',
            'assignedOwner': lead.get('assigned_owner') or '',
            'qualificationStatus': lead.get('qualification_status') or 'new',
            'tags': list(lead.get('tags') or []),
            'notes': lead.get('notes') or '',
            'latestAppointment': latest_appointment,
        })
    summary = _build_ae_bridge_summary(org_id).get('summary') or {}
    return {
        'ok': True,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'summary': summary,
        'leads': payload_rows,
    }




def _build_ae_bridge_ops_deck(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    appointments = [appt for appt in db.list_appointments(org_id) if int(appt.get('lead_id') or 0) in {int(lead.get('id') or 0) for lead in leads}]
    coverage: dict[str, dict[str, object]] = {}
    conflicts: list[dict[str, object]] = []
    sorted_appts = sorted(appointments, key=lambda item: str(item.get('start_at') or item.get('startAt') or ''))
    for idx, appt in enumerate(sorted_appts):
        raw_start = str(appt.get('start_at') or appt.get('startAt') or '').strip()
        status = str(appt.get('status') or '').lower()
        if raw_start:
            try:
                dt = datetime.fromisoformat(raw_start.replace('Z', '+00:00'))
                day_key = dt.date().isoformat()
                row = coverage.setdefault(day_key, {'day': day_key, 'count': 0, 'window': dt.strftime('%a')})
                row['count'] += 1
                if status in {'scheduled', 'booked', 'confirmed'}:
                    for other in sorted_appts[idx+1:]:
                        other_start = str(other.get('start_at') or other.get('startAt') or '').strip()
                        if not other_start:
                            continue
                        other_dt = datetime.fromisoformat(other_start.replace('Z', '+00:00'))
                        if abs((other_dt - dt).total_seconds()) < 55 * 60:
                            conflicts.append({
                                'client_name': str(appt.get('client_name') or appt.get('name') or appt.get('lead_name') or 'Lead'),
                                'reason': f"Conflict near {dt.isoformat()}"
                            })
                            break
            except Exception:
                conflicts.append({'client_name': str(appt.get('client_name') or appt.get('name') or 'Lead'), 'reason': 'Invalid scheduled time'})
        elif status in {'scheduled', 'booked', 'confirmed'}:
            conflicts.append({'client_name': str(appt.get('client_name') or appt.get('name') or 'Lead'), 'reason': 'Missing scheduled time'})
    summary = {
        'total_appointments': len(appointments),
        'scheduled': len([appt for appt in appointments if str(appt.get('status') or '').lower() in {'scheduled', 'booked', 'confirmed'}]),
        'no_show_pressure': len([appt for appt in appointments if str(appt.get('status') or '').lower() in {'no-show', 'cancelled'}]),
        'conflicts': len(conflicts),
    }
    return {'ok': True, 'generated_at': datetime.now(timezone.utc).isoformat(), 'summary': summary, 'coverage': list(coverage.values())[:14], 'conflicts': conflicts[:20]}



def _build_ae_bridge_revenue_deck(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    lead_ids = {int(lead.get('id') or 0) for lead in leads}
    appointments = [appt for appt in db.list_appointments(org_id) if int(appt.get('lead_id') or 0) in lead_ids]
    rows: list[dict[str, object]] = []
    deposit_requested = 0
    deposit_paid = 0
    deposit_collected_value = 0
    committed_value = 0
    lead_map = {int(lead.get('id') or 0): lead for lead in leads}
    for appt in appointments:
        lead = lead_map.get(int(appt.get('lead_id') or 0), {})
        est = int(lead.get('estimated_value_cents') or lead.get('estimated_value') or 0)
        if est <= 0:
            est = int(lead.get('package_value_cents') or 0)
        deposit = int(appt.get('deposit_amount_cents') or 0)
        if deposit <= 0 and est > 0:
            deposit = max(int(est * 0.15), 7500)
        deposit_status = str(appt.get('deposit_status') or ('requested' if deposit else 'none'))
        if deposit_status in {'requested', 'paid', 'refunded'}:
            deposit_requested += 1
        if deposit_status == 'paid':
            deposit_paid += 1
            deposit_collected_value += deposit
        committed_value += max(est, 0)
        rows.append({
            'appointment_id': int(appt.get('id') or 0),
            'lead_id': int(appt.get('lead_id') or 0),
            'client_name': str(lead.get('name') or appt.get('client_name') or 'Lead'),
            'assigned_owner': str(lead.get('assigned_owner') or ''),
            'status': str(appt.get('status') or 'scheduled'),
            'start_at': str(appt.get('start_at') or appt.get('startAt') or ''),
            'deposit_status': deposit_status,
            'deposit_amount': deposit,
            'estimated_value': est,
        })
    rows.sort(key=lambda item: (-int(item.get('estimated_value') or 0), str(item.get('start_at') or '')))
    return {
        'ok': True,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'summary': {
            'bookings': len(appointments),
            'deposits_requested': deposit_requested,
            'deposits_paid': deposit_paid,
            'deposit_collected_value': deposit_collected_value,
            'committed_value': committed_value,
        },
        'rows': rows[:20],
    }


def _build_ae_bridge_calendar_deck(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    lead_ids = {int(lead.get('id') or 0) for lead in leads}
    appointments = [appt for appt in db.list_appointments(org_id) if int(appt.get('lead_id') or 0) in lead_ids]
    rows: list[dict[str, object]] = []
    conflicts: list[dict[str, object]] = []
    for offset in range(7):
        day = datetime.now(timezone.utc).date() + timedelta(days=offset)
        iso_day = day.isoformat()
        weekday = day.strftime('%a')
        capacity = 4 if weekday != 'Sun' else 0
        scheduled = []
        for appt in appointments:
            start_at = str(appt.get('start_at') or appt.get('startAt') or '')
            if start_at[:10] == iso_day and str(appt.get('status') or '').lower() in {'scheduled', 'booked', 'confirmed'}:
                scheduled.append(appt)
        if len(scheduled) > capacity and capacity > 0:
            conflicts.append({'client_name': str((scheduled[0] or {}).get('client_name') or 'Lead'), 'reason': f'Over capacity on {iso_day}'})
        rows.append({
            'day': iso_day,
            'weekday': weekday,
            'capacity': capacity,
            'scheduled': len(scheduled),
            'open_slots': max(capacity - len(scheduled), 0),
            'watch': len([appt for appt in scheduled if str(appt.get('status') or '').lower() in {'cancelled', 'no-show'}])
        })
    return {
        'ok': True,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'summary': {
            'total_capacity': sum(int(row['capacity']) for row in rows),
            'total_scheduled': sum(int(row['scheduled']) for row in rows),
            'total_open_slots': sum(int(row['open_slots']) for row in rows),
            'conflicts': len(conflicts),
        },
        'rows': rows,
        'conflicts': conflicts[:10],
    }



def _build_ae_bridge_settlement_deck(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    lead_ids = {int(lead.get('id') or 0) for lead in leads}
    appointments = [appt for appt in db.list_appointments(org_id) if int(appt.get('lead_id') or 0) in lead_ids]
    rows: list[dict[str, object]] = []
    draft = 0
    sent = 0
    paid = 0
    writeoff = 0
    collected_value = 0
    lead_map = {int(lead.get('id') or 0): lead for lead in leads}
    for appt in appointments:
        lead = lead_map.get(int(appt.get('lead_id') or 0), {})
        est = int(lead.get('estimated_value_cents') or lead.get('estimated_value') or 0)
        if est <= 0:
            est = int(lead.get('package_value_cents') or 0)
        deposit = int(appt.get('deposit_amount_cents') or 0)
        settlement_amount = max(est - deposit, int(est * 0.65), 0)
        settlement_status = str(appt.get('invoice_status') or appt.get('settlement_status') or ('paid' if str(appt.get('status') or '').lower() in {'closed', 'won'} else 'draft'))
        if settlement_status == 'draft':
            draft += 1
        elif settlement_status == 'sent':
            sent += 1
        elif settlement_status == 'paid':
            paid += 1
            collected_value += settlement_amount
        elif settlement_status == 'writeoff':
            writeoff += 1
        rows.append({
            'appointment_id': int(appt.get('id') or 0),
            'lead_id': int(appt.get('lead_id') or 0),
            'client_name': str(lead.get('name') or appt.get('client_name') or 'Lead'),
            'assigned_owner': str(lead.get('assigned_owner') or ''),
            'status': settlement_status,
            'amount': settlement_amount,
            'appointment_status': str(appt.get('status') or 'scheduled'),
        })
    rows.sort(key=lambda item: (-int(item.get('amount') or 0), str(item.get('client_name') or '')))
    return {
        'ok': True,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'summary': {
            'draft': draft,
            'sent': sent,
            'paid': paid,
            'writeoff': writeoff,
            'collected_value': collected_value,
        },
        'rows': rows[:20],
    }


def _build_ae_bridge_funnel_deck(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    lead_ids = {int(lead.get('id') or 0) for lead in leads}
    appointments = [appt for appt in db.list_appointments(org_id) if int(appt.get('lead_id') or 0) in lead_ids]
    by_owner: dict[str, dict[str, object]] = {}
    for lead in leads:
        owner = str(lead.get('assigned_owner') or 'Founder Desk')
        row = by_owner.setdefault(owner, {'ae_name': owner, 'handoffs': 0, 'booked': 0, 'paid': 0})
        row['handoffs'] += 1
    for appt in appointments:
        lead = next((item for item in leads if int(item.get('id') or 0) == int(appt.get('lead_id') or 0)), {})
        owner = str((lead or {}).get('assigned_owner') or 'Founder Desk')
        row = by_owner.setdefault(owner, {'ae_name': owner, 'handoffs': 0, 'booked': 0, 'paid': 0})
        if str(appt.get('status') or '').lower() in {'scheduled', 'booked', 'confirmed', 'completed', 'closed', 'won'}:
            row['booked'] += 1
        if str(appt.get('invoice_status') or appt.get('settlement_status') or '').lower() == 'paid' or str(appt.get('status') or '').lower() in {'closed', 'won'}:
            row['paid'] += 1
    rows: list[dict[str, object]] = []
    for owner, row in by_owner.items():
        handoffs = int(row['handoffs'])
        paid = int(row['paid'])
        rows.append({
            'ae_name': owner,
            'handoffs': handoffs,
            'booked': int(row['booked']),
            'paid': paid,
            'paid_rate': round((paid / handoffs) * 100) if handoffs else 0,
        })
    rows.sort(key=lambda item: (-int(item.get('paid') or 0), -int(item.get('handoffs') or 0), str(item.get('ae_name') or '')))
    summary = {
        'handoffs': len(leads),
        'booked': len([appt for appt in appointments if str(appt.get('status') or '').lower() in {'scheduled', 'booked', 'confirmed', 'completed', 'closed', 'won'}]),
        'settlements_paid': len([appt for appt in appointments if str(appt.get('invoice_status') or appt.get('settlement_status') or '').lower() == 'paid' or str(appt.get('status') or '').lower() in {'closed', 'won'}]),
    }
    summary['paid_rate'] = round((summary['settlements_paid'] / summary['handoffs']) * 100) if summary['handoffs'] else 0
    return {'ok': True, 'generated_at': datetime.now(timezone.utc).isoformat(), 'summary': summary, 'rows': rows[:20]}



def _build_ae_bridge_sync_deck(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    lead_ids = {int(lead.get('id') or 0) for lead in leads}
    appointments = [appt for appt in db.list_appointments(org_id) if int(appt.get('lead_id') or 0) in lead_ids]
    rows: list[dict[str, object]] = []
    for lead in leads:
        lead_id = int(lead.get('id') or 0)
        related = [appt for appt in appointments if int(appt.get('lead_id') or 0) == lead_id]
        latest = sorted(related, key=lambda item: str(item.get('updated_at') or item.get('created_at') or ''), reverse=True)[0] if related else {}
        if latest:
            status = str(latest.get('status') or 'scheduled').lower()
            direction = 'inbound'
            kind = 'booking' if status in {'scheduled', 'booked', 'confirmed', 'completed', 'closed', 'won'} else 'appointment-status'
            note = str(latest.get('notes') or latest.get('appointment_note') or '').strip()
        else:
            status = 'queued'
            direction = 'outbound'
            kind = 'handoff'
            note = str(lead.get('notes') or '').strip()
        rows.append({
            'lead_id': lead_id,
            'client_name': str(lead.get('name') or ''),
            'direction': direction,
            'kind': kind,
            'status': status,
            'appointment_status': str(latest.get('status') or ''),
            'note': note[:180],
        })
    rows.sort(key=lambda item: (item['status'] != 'queued', item['client_name']))
    summary = {
        'total': len(rows),
        'inbound': len([row for row in rows if row['direction'] == 'inbound']),
        'outbound': len([row for row in rows if row['direction'] == 'outbound']),
        'return_ready': len([row for row in rows if row['status'] in {'completed', 'closed', 'won', 'confirmed'}]),
    }
    return {'ok': True, 'generated_at': datetime.now(timezone.utc).isoformat(), 'summary': summary, 'rows': rows[:20]}


def _build_ae_bridge_fulfillment_deck(org_id: int) -> dict[str, object]:
    leads = [lead for lead in db.list_leads(org_id) if _is_ae_bridge_lead(lead)]
    lead_ids = {int(lead.get('id') or 0) for lead in leads}
    appointments = [appt for appt in db.list_appointments(org_id) if int(appt.get('lead_id') or 0) in lead_ids]
    rows: list[dict[str, object]] = []
    for appt in appointments:
        invoice_status = str(appt.get('invoice_status') or appt.get('settlement_status') or '').lower()
        appointment_status = str(appt.get('status') or '').lower()
        if invoice_status != 'paid' and appointment_status not in {'closed', 'won', 'completed'}:
            continue
        lead = next((item for item in leads if int(item.get('id') or 0) == int(appt.get('lead_id') or 0)), {})
        amount = int(appt.get('amount_cents') or appt.get('price_cents') or lead.get('estimated_value_cents') or lead.get('estimated_value') or 0)
        due_date = ''
        raw_start = str(appt.get('start_at') or appt.get('startAt') or '').strip()
        if raw_start:
            try:
                due_date = datetime.fromisoformat(raw_start.replace('Z', '+00:00')).date().isoformat()
            except Exception:
                due_date = ''
        status = 'completed' if appointment_status in {'closed', 'won'} else 'in-progress' if appointment_status == 'completed' else 'queued'
        rows.append({
            'appointment_id': int(appt.get('id') or 0),
            'lead_id': int(appt.get('lead_id') or 0),
            'client_name': str(lead.get('name') or appt.get('client_name') or 'Lead'),
            'owner': str(lead.get('assigned_owner') or 'Founder Desk'),
            'status': status,
            'due_date': due_date,
            'amount': amount / 100,
        })
    rows.sort(key=lambda item: (item['status'] == 'completed', item['due_date'] or '9999-99-99', item['client_name']))
    summary = {
        'total': len(rows),
        'queued': len([row for row in rows if row['status'] == 'queued']),
        'in_progress': len([row for row in rows if row['status'] == 'in-progress']),
        'completed': len([row for row in rows if row['status'] == 'completed']),
    }
    return {'ok': True, 'generated_at': datetime.now(timezone.utc).isoformat(), 'summary': summary, 'rows': rows[:20]}


def _build_ae_bridge_profitability_deck(org_id: int) -> dict[str, object]:
    revenue = _build_ae_bridge_revenue_deck(org_id)
    settlements = _build_ae_bridge_settlement_deck(org_id)
    fulfillment = _build_ae_bridge_fulfillment_deck(org_id)
    revenue_rows = {int(row.get('lead_id') or 0): row for row in list(revenue.get('rows') or [])}
    settlement_rows = {int(row.get('lead_id') or 0): row for row in list(settlements.get('rows') or [])}
    fulfillment_rows = {int(row.get('lead_id') or 0): row for row in list(fulfillment.get('rows') or [])}
    lead_ids = sorted(set(revenue_rows.keys()) | set(settlement_rows.keys()) | set(fulfillment_rows.keys()))
    rows: list[dict[str, object]] = []
    for lead_id in lead_ids:
        revenue_row = revenue_rows.get(lead_id, {})
        settlement_row = settlement_rows.get(lead_id, {})
        fulfillment_row = fulfillment_rows.get(lead_id, {})
        estimated_value = int(revenue_row.get('estimated_value') or 0)
        deposit_amount = int(revenue_row.get('deposit_amount') or 0)
        deposit_paid = deposit_amount if str(revenue_row.get('deposit_status') or '').lower() == 'paid' else 0
        settlement_paid = int(settlement_row.get('amount') or 0) if str(settlement_row.get('status') or '').lower() == 'paid' else 0
        collected = deposit_paid + settlement_paid
        outstanding = max(estimated_value - collected, 0)
        fulfillment_status = str(fulfillment_row.get('status') or 'not-opened')
        delivery_reserve = 0
        if fulfillment_status == 'queued':
            delivery_reserve = 22500
        elif fulfillment_status == 'in-progress':
            delivery_reserve = 45000
        elif fulfillment_status == 'completed':
            delivery_reserve = 60000
        net_position = collected - delivery_reserve
        rows.append({
            'lead_id': lead_id,
            'client_name': str(revenue_row.get('client_name') or settlement_row.get('client_name') or fulfillment_row.get('client_name') or 'Lead'),
            'assigned_owner': str(revenue_row.get('assigned_owner') or settlement_row.get('assigned_owner') or fulfillment_row.get('owner') or 'Founder Desk'),
            'estimated_value': estimated_value,
            'collected': collected,
            'outstanding': outstanding,
            'delivery_reserve': delivery_reserve,
            'net_position': net_position,
            'fulfillment_status': fulfillment_status,
        })
    rows.sort(key=lambda item: (-int(item.get('net_position') or 0), -int(item.get('collected') or 0), str(item.get('client_name') or '')))
    summary = {
        'total': len(rows),
        'booked_value': sum(int(row.get('estimated_value') or 0) for row in rows),
        'collected': sum(int(row.get('collected') or 0) for row in rows),
        'outstanding': sum(int(row.get('outstanding') or 0) for row in rows),
        'delivery_reserve': sum(int(row.get('delivery_reserve') or 0) for row in rows),
        'net_position': sum(int(row.get('net_position') or 0) for row in rows),
        'margin_watch': len([row for row in rows if int(row.get('net_position') or 0) < 0]),
    }
    return {'ok': True, 'generated_at': datetime.now(timezone.utc).isoformat(), 'summary': summary, 'rows': rows[:20]}


def _build_ae_bridge_template_deck(org_id: int) -> dict[str, object]:
    revenue = _build_ae_bridge_revenue_deck(org_id)
    rows: list[dict[str, object]] = []
    template_counts: dict[str, int] = {'service-launch': 0, 'premium-whiteglove': 0, 'local-growth-sprint': 0}
    for row in list(revenue.get('rows') or []):
        estimated_value = int(row.get('estimated_value') or 0)
        owner = str(row.get('assigned_owner') or '').lower()
        client_name = str(row.get('client_name') or 'Lead')
        if estimated_value >= 250000:
            template_id = 'premium-whiteglove'
            reason = 'High-value appointment lane needs higher-touch fulfillment coverage.'
        elif 'local' in owner or 'growth' in owner:
            template_id = 'local-growth-sprint'
            reason = 'Growth-oriented owner or local-market lane benefits from local sprint follow-through.'
        else:
            template_id = 'service-launch'
            reason = 'Default delivery launch template fits the current appointment lane.'
        template_counts[template_id] = template_counts.get(template_id, 0) + 1
        rows.append({
            'lead_id': int(row.get('lead_id') or 0),
            'client_name': client_name,
            'assigned_owner': str(row.get('assigned_owner') or 'Founder Desk'),
            'template_id': template_id,
            'reason': reason,
            'estimated_value': estimated_value,
        })
    rows.sort(key=lambda item: (-int(item.get('estimated_value') or 0), str(item.get('client_name') or '')))
    summary = {
        'total': len(rows),
        'service_launch': template_counts.get('service-launch', 0),
        'premium_whiteglove': template_counts.get('premium-whiteglove', 0),
        'local_growth_sprint': template_counts.get('local-growth-sprint', 0),
    }
    return {'ok': True, 'generated_at': datetime.now(timezone.utc).isoformat(), 'summary': summary, 'rows': rows[:20]}

def _import_ae_bridge_payload(org_id: int, payload: dict[str, object]) -> dict[str, int]:
    rows = list(payload.get('clients') or payload.get('handoffs') or payload.get('leads') or [])
    created = 0
    updated = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        match = _find_ae_bridge_match(org_id, row)
        tags = [tag for tag in [
            'ae-command',
            str(row.get('priority') or '').strip(),
            str(row.get('stage') or '').strip(),
            str(row.get('serviceInterest') or row.get('service_interest') or '').strip(),
        ] if tag]
        notes = '\n'.join(part for part in [
            'AE handoff bridge import',
            str(row.get('notes') or '').strip(),
            str(row.get('handoffNote') or '').strip(),
            f"Next step: {str(row.get('nextStep') or '').strip()}" if str(row.get('nextStep') or '').strip() else '',
            f"Value tier estimate: {str(row.get('estimatedValue') or row.get('estimated_value') or '')}" if str(row.get('estimatedValue') or row.get('estimated_value') or '') else '',
        ] if part)
        fields = {
            'org_id': org_id,
            'name': str(row.get('clientName') or row.get('name') or '').strip(),
            'email': str(row.get('email') or '').strip(),
            'phone': str(row.get('phone') or '').strip(),
            'business_name': str(row.get('company') or row.get('business_name') or '').strip(),
            'service_interest': str(row.get('serviceInterest') or row.get('service_interest') or 'appointment setter').strip(),
            'urgency': str(row.get('priority') or 'normal').strip(),
            'qualification_status': str(row.get('qualificationStatus') or row.get('qualification_status') or 'new').strip(),
            'source': 'ae-command',
            'notes': notes,
            'assigned_owner': str(row.get('aeName') or row.get('assignedOwner') or 'Founder Desk').strip(),
            'tags': tags,
        }
        if match:
            db.update_lead(int(match.get('id') or 0), fields)
            lead = db.get_lead(int(match.get('id') or 0)) or match
            updated += 1
        else:
            lead = db.create_lead(fields) or {}
            created += 1
        lead_id = int(lead.get('id') or 0)
        if lead_id:
            db.upsert_lead_memory(lead_id, {
                'org_id': org_id,
                'summary': f"Imported from AE Command for {fields['name']}",
                'preferences_json': {
                    'ae_id': str(row.get('aeId') or ''),
                    'ae_name': str(row.get('aeName') or row.get('assignedOwner') or ''),
                    'estimated_value': row.get('estimatedValue') or row.get('estimated_value') or 0,
                    'monthly_value': row.get('monthlyValue') or row.get('monthly_value') or 0,
                    'target_close_date': str(row.get('targetCloseDate') or row.get('target_close_date') or ''),
                    'follow_up_date': str(row.get('followUpDate') or row.get('follow_up_date') or ''),
                },
                'latest_intent': str(row.get('nextStep') or fields['service_interest']),
            })
    return {'created': created, 'updated': updated}

class AppHandler(BaseHTTPRequestHandler):
    server_version = "SkyesAppointmentSetter/4.0"

    def log_message(self, format: str, *args) -> None:
        return

    def _security_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        }
        if secure_cookie_enabled():
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if extra:
            headers.update(extra)
        return headers

    def _send_json(self, payload: dict | list, status: int = 200, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for key, value in self._security_headers(headers).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, payload: str, status: int = 200, mime: str = "text/plain; charset=utf-8", headers: dict[str, str] | None = None) -> None:
        body = payload.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        for key, value in self._security_headers(headers).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, payload: bytes, status: int = 200, mime: str = "application/octet-stream", headers: dict[str, str] | None = None) -> None:
        body = payload or b''
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        for key, value in self._security_headers(headers).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _send_redirect(self, location: str) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        for key, value in self._security_headers().items():
            self.send_header(key, value)
        self.end_headers()

    def _read_body_bytes(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or 0)
        return self.rfile.read(length) if length > 0 else b""

    def _read_json_body(self) -> dict:
        raw = self._read_body_bytes()
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def _parse_cookies(self) -> cookies.SimpleCookie:
        jar = cookies.SimpleCookie()
        jar.load(self.headers.get("Cookie", ""))
        return jar

    def _auth_token(self) -> str:
        jar = self._parse_cookies()
        if SESSION_COOKIE in jar:
            return jar[SESSION_COOKIE].value
        auth_header = self.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            return auth_header.split(" ", 1)[1].strip()
        return ""

    def _client_ip(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "").strip()
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
        return str(self.client_address[0]) if self.client_address else ""

    def _audit(
        self,
        event_type: str,
        *,
        session: dict | None = None,
        org_id: int | None = None,
        entity_type: str = "",
        entity_id: str | int | None = None,
        status: str = "ok",
        detail: str = "",
        metadata: dict | None = None,
    ) -> None:
        actor_email = str(session.get("email") or "") if session else ""
        actor_role = str(session.get("role") or "") if session else ""
        actor_user_id = int(session.get("user_id") or 0) or None if session else None
        resolved_org_id = org_id
        if resolved_org_id is None and session and session.get("org_id"):
            resolved_org_id = int(session.get("org_id") or 0) or None
        if resolved_org_id is None:
            resolved_org_id = db.get_default_org_id()
        db.log_audit_event(
            event_type,
            org_id=resolved_org_id,
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            actor_role=actor_role,
            route=self.path,
            entity_type=entity_type,
            entity_id=entity_id,
            status=status,
            detail=detail,
            ip_address=self._client_ip(),
            user_agent=self.headers.get("User-Agent", ""),
            metadata=metadata or {},
        )

    def _current_user(self) -> dict | None:
        token = self._auth_token()
        if not token:
            return None
        db.prune_admin_sessions()
        session = db.get_admin_session(token)
        if session:
            db.touch_admin_session(token)
        return session

    def _resolve_scoped_org(self, session: dict | None, org_id: int | None = None, org_slug: str | None = None) -> int | None:
        requested = db.resolve_org_id(org_id, org_slug) if (org_id or org_slug) else None
        if not session:
            return requested
        session_org = int(session.get("org_id") or 0) or None
        if session.get("role") != "admin":
            if requested and session_org and requested != session_org:
                raise PermissionError("Org scope is restricted for this account.")
            return session_org or requested or db.get_default_org_id()
        return requested or session_org or db.get_default_org_id()

    def _forbidden_password_change(self) -> None:
        self._audit("password_change_required", status="blocked", detail="password rotation required before continuing")
        self._send_json(
            {"ok": False, "error": "Password change required before continuing.", "code": "PASSWORD_CHANGE_REQUIRED"},
            status=403,
        )

    def _require_auth(self, required_role: str = "viewer", allow_password_change_only: bool = False) -> dict | None:
        session = self._current_user()
        if not session:
            self._audit("auth_required", status="blocked", detail="authentication required for protected route")
            self._send_json({"ok": False, "error": "Authentication required.", "code": "AUTH_REQUIRED"}, status=401)
            return None
        if int(session.get("require_password_change") or 0) == 1 and not allow_password_change_only:
            self._forbidden_password_change()
            return None
        if not role_allows(session.get("role"), required_role):
            self._audit("role_denied", session=session, status="blocked", detail=f"{required_role} role required")
            self._send_json({"ok": False, "error": f"{required_role.title()} role required."}, status=403)
            return None
        return session

    def _require_csrf(self, session: dict | None) -> bool:
        if not session:
            self._send_json({"ok": False, "error": "Authentication required.", "code": "AUTH_REQUIRED"}, status=401)
            return False
        expected = str(session.get("csrf_token") or "")
        provided = self.headers.get("X-CSRF-Token", "").strip()
        if not expected or not provided or provided != expected:
            self._audit("csrf_mismatch", session=session, status="blocked", detail="csrf token mismatch")
            self._send_json({"ok": False, "error": "CSRF token mismatch.", "code": "CSRF_MISMATCH"}, status=403)
            return False
        return True

    def _require_signed_webhook(self, raw_body: bytes) -> bool:
        if not os.getenv("VOICE_WEBHOOK_URL", "").strip():
            self._send_json({"ok": False, "error": "Voice webhook is not configured."}, status=503)
            return False
        secret = os.getenv("VOICE_WEBHOOK_SECRET", "").strip()
        if not secret:
            self._send_json({"ok": False, "error": "VOICE_WEBHOOK_SECRET is required."}, status=503)
            return False
        timestamp = self.headers.get("X-Webhook-Timestamp", "").strip()
        signature = self.headers.get("X-Webhook-Signature", "").strip().lower()
        if not timestamp or not signature:
            self._send_json({"ok": False, "error": "Missing webhook signature headers."}, status=403)
            return False
        try:
            ts_int = int(timestamp)
        except ValueError:
            self._send_json({"ok": False, "error": "Invalid webhook timestamp."}, status=403)
            return False
        now = int(time.time())
        if abs(now - ts_int) > 300:
            self._send_json({"ok": False, "error": "Webhook timestamp expired."}, status=403)
            return False
        expected = webhook_signature(secret, timestamp, raw_body)
        if expected != signature:
            self._send_json({"ok": False, "error": "Webhook signature mismatch."}, status=403)
            return False
        return True


    def _require_inbound_channel_webhook(self, raw_body: bytes, channel: str) -> bool:
        secret_env = 'SMS_INBOUND_SECRET' if channel == 'sms' else 'EMAIL_INBOUND_SECRET'
        secret = os.getenv(secret_env, '').strip()
        if not secret:
            self._send_json({"ok": False, "error": f"{secret_env} is required."}, status=503)
            return False
        direct_secret = self.headers.get('X-Inbound-Secret', '').strip()
        if direct_secret:
            if direct_secret != secret:
                self._send_json({"ok": False, "error": "Inbound secret mismatch."}, status=403)
                return False
            return True
        timestamp = self.headers.get('X-Webhook-Timestamp', '').strip()
        signature = self.headers.get('X-Webhook-Signature', '').strip().lower()
        if not timestamp or not signature:
            self._send_json({"ok": False, "error": "Missing inbound authentication headers."}, status=403)
            return False
        try:
            ts_int = int(timestamp)
        except ValueError:
            self._send_json({"ok": False, "error": "Invalid inbound webhook timestamp."}, status=403)
            return False
        now = int(time.time())
        if abs(now - ts_int) > 300:
            self._send_json({"ok": False, "error": "Inbound webhook timestamp expired."}, status=403)
            return False
        expected = webhook_signature(secret, timestamp, raw_body)
        if expected != signature:
            self._send_json({"ok": False, "error": "Inbound webhook signature mismatch."}, status=403)
            return False
        return True

    def _session_cookie_header(self, token: str) -> str:
        cookie = cookies.SimpleCookie()
        cookie[SESSION_COOKIE] = token
        cookie[SESSION_COOKIE]["path"] = "/"
        cookie[SESSION_COOKIE]["httponly"] = True
        cookie[SESSION_COOKIE]["samesite"] = "Lax"
        if secure_cookie_enabled():
            cookie[SESSION_COOKIE]["secure"] = True
        return cookie.output(header="").strip()

    def _clear_session_cookie_header(self) -> str:
        cookie = cookies.SimpleCookie()
        cookie[SESSION_COOKIE] = ""
        cookie[SESSION_COOKIE]["path"] = "/"
        cookie[SESSION_COOKIE]["expires"] = "Thu, 01 Jan 1970 00:00:00 GMT"
        if secure_cookie_enabled():
            cookie[SESSION_COOKIE]["secure"] = True
        cookie[SESSION_COOKIE]["httponly"] = True
        cookie[SESSION_COOKIE]["samesite"] = "Lax"
        return cookie.output(header="").strip()

    def _serve_static(self, path: str) -> None:
        current_user = self._current_user()
        protected_paths = {"/admin", "/admin/", "/admin/index.html", "/diagnostics", "/diagnostics/", "/diagnostics/index.html"}
        if path in protected_paths and not current_user:
            self._send_redirect(f"/auth/login.html?next={quote(path)}")
            return
        if path in protected_paths and current_user and int(current_user.get("require_password_change") or 0) == 1:
            self._send_redirect(f"/auth/login.html?next={quote(path)}&must_change=1")
            return
        if path in {"/auth", "/auth/", "/auth/login.html"} and current_user and int(current_user.get("require_password_change") or 0) != 1:
            self._send_redirect("/admin/index.html")
            return
        rel = "index.html" if path == "/" else path.lstrip("/")
        if ".." in rel:
            self._send_text("Not found", status=404)
            return
        file_path = STATIC_DIR / rel
        if file_path.is_dir():
            file_path = file_path / "index.html"
        if not file_path.exists() or not file_path.is_file():
            self._send_text("Not found", status=404)
            return
        data = file_path.read_bytes()
        mime, _ = mimetypes.guess_type(str(file_path))
        self.send_response(200)
        self.send_header("Content-Type", mime or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        for key, value in self._security_headers().items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(data)

    def _scope_from_qs(self, qs: dict[str, list[str]]) -> tuple[int | None, str | None]:
        org_id_raw = qs.get("org_id", [""])[0]
        org_slug = qs.get("org", [""])[0] or qs.get("org_slug", [""])[0] or None
        org_id = int(org_id_raw) if str(org_id_raw).isdigit() else None
        return org_id, org_slug

    def _public_org_payload(self, org_slug: str | None = None, org_id: int | None = None) -> dict:
        org = db.get_org(db.resolve_org_id(org_id, org_slug)) or {}
        resolved_org_id = org.get("id")
        settings = get_org_runtime_settings(int(resolved_org_id) if resolved_org_id else None)
        calendar_states = provider_status(resolved_org_id)
        voice_webhook = os.getenv("VOICE_WEBHOOK_URL", "").strip()
        smtp_host = os.getenv("SMTP_HOST", "").strip()
        outbound_channels = sorted(configured_outbound_channels())
        inbound_channels = sorted(configured_inbound_channels())
        return {
            "brand": os.getenv("APP_BRAND", PUBLIC_BRAND),
            "support_email": org.get("support_email") or PUBLIC_SUPPORT_EMAIL,
            "support_phone": org.get("support_phone") or PUBLIC_SUPPORT_PHONE,
            "business_timezone": settings.get("timezone") or BUSINESS_TZ,
            "operating_hours": format_operating_hours(int(resolved_org_id) if resolved_org_id else None),
            "org": {"id": org.get("id"), "slug": org.get("slug"), "name": org.get("name")},
            "settings": {
                "open_hour": settings.get("open_hour"),
                "close_hour": settings.get("close_hour"),
                "slot_minutes": settings.get("slot_minutes"),
                "buffer_minutes": settings.get("buffer_minutes"),
                "reminder_lead_hours": settings.get("reminder_lead_hours"),
                "autonomy_enabled": bool(settings.get("autonomy_enabled")),
                "auto_followup_hours": settings.get("auto_followup_hours") or 24,
                "auto_noshow_minutes": settings.get("auto_noshow_minutes") or 90,
                "auto_invoice_followup_hours": settings.get("auto_invoice_followup_hours") or 48,
                "auto_intake_followup_hours": settings.get("auto_intake_followup_hours") or 24,
                "operating_days": settings.get("operating_days"),
                "booking_notice": settings.get("booking_notice"),
                "default_deposit_cents": settings.get("default_deposit_cents") or 0,
                "default_service_price_cents": settings.get("default_service_price_cents") or 0,
                "currency": settings.get("currency") or "USD",
                "payment_instructions": settings.get("payment_instructions") or "",
            },
            "features": {
                "voice": bool(voice_webhook),
                "voice_mode": "provider" if voice_webhook else "disabled",
                "calendar": any(bool(item.get("configured")) for item in calendar_states),
                "calendar_providers": [str(item.get("provider")) for item in calendar_states if item.get("configured")],
                "calendar_download": True,
                "outbound": bool(outbound_channels),
                "outbound_channels": outbound_channels,
                "inbound": bool(inbound_channels),
                "inbound_channels": inbound_channels,
                "email_mode": "smtp" if smtp_host else ("webhook" if "email" in outbound_channels else "disabled"),
                "ai_mode": "openai" if ai_configured() else "built-in",
                "self_service_manage": True,
                "settings_editor": True,
                "autonomy": bool(settings.get("autonomy_enabled")),
            },
        }

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        org_id, org_slug = self._scope_from_qs(qs)

        if path == "/api/health":
            scoped_health_org = db.resolve_org_id(org_id, org_slug) if (org_id or org_slug) else None
            scoped_settings = get_org_runtime_settings(scoped_health_org)
            self._send_json(
                {
                    "ok": True,
                    "runtime": "python-stdlib-http-server",
                    "ai_configured": ai_configured(),
                    "configured_voice": bool(os.getenv("VOICE_WEBHOOK_URL", "").strip()),
                    "configured_outbound_channels": sorted(configured_outbound_channels()),
                    "configured_inbound_channels": sorted(configured_inbound_channels()),
                    "db_path": str(db.DB_PATH),
                    "business_timezone": BUSINESS_TZ,
                    "org_count": len(db.list_orgs()),
                    "rep_count": len(db.list_reps()),
                    "calendar_providers": provider_status(scoped_health_org),
                    "worker": WORKER.status(),
                    "runtime_snapshot": db.runtime_snapshot(scoped_health_org),
                    "autonomy": {
                        "enabled": bool(scoped_settings.get("autonomy_enabled")),
                        "followup_hours": int(scoped_settings.get("auto_followup_hours") or 24),
                        "no_show_minutes": int(scoped_settings.get("auto_noshow_minutes") or 90),
                        "invoice_followup_hours": int(scoped_settings.get("auto_invoice_followup_hours") or 48),
                        "intake_followup_hours": int(scoped_settings.get("auto_intake_followup_hours") or 24),
                    },
                    "security_posture": {
                        "production_mode": is_production(),
                        "secure_cookie_enabled": secure_cookie_enabled(),
                        "bootstrap_rotation_pending": any(int(user.get("require_password_change") or 0) == 1 for user in db.list_admin_users(scoped_health_org)),
                    },
                }
            )
            return

        if path == "/api/public/config":
            self._send_json(self._public_org_payload(org_slug, org_id))
            return

        if path == "/api/public/appointment":
            code = str(qs.get("code", [""])[0]).strip()
            appointment = get_public_appointment_by_code(code) or {}
            if not appointment:
                self._send_json({"ok": False, "error": "Appointment not found."}, status=404)
                return
            payload = serialize_public_appointment(appointment)
            self._send_json({"ok": True, **payload})
            return

        match_public_quote_receipt = re.fullmatch(r"/api/public/quotes/([^/]+)/receipt", path)
        if match_public_quote_receipt:
            quote_code = match_public_quote_receipt.group(1)
            code = str(qs.get('code', [''])[0] or '').strip()
            quote = db.get_quote_by_code(quote_code) or {}
            appointment = get_public_appointment_by_code(code) or {}
            if not quote or not appointment or int(quote.get('lead_id') or 0) != int(appointment.get('lead_id') or 0):
                self._send_json({"ok": False, "error": "Quote not found for this appointment."}, status=404)
                return
            if str(quote.get('status') or '').strip().lower() != 'accepted':
                self._send_json({"ok": False, "error": "Quote is not accepted yet."}, status=400)
                return
            content = db.render_quote_acceptance_receipt_text(int(quote.get('id') or 0))
            filename = f"quote-acceptance-{quote_code}.txt".replace('\"', '')
            self._send_text(content, mime='text/plain; charset=utf-8', headers={"Content-Disposition": f'attachment; filename="{filename}"'})
            return

        if path == "/api/auth/me":
            session = self._current_user()
            if not session:
                self._send_json({"ok": False, "error": "Authentication required.", "code": "AUTH_REQUIRED"}, status=401)
                return
            self._send_json(
                {
                    "ok": True,
                    "user": {
                        "id": session.get("user_id"),
                        "email": session.get("email"),
                        "display_name": session.get("display_name"),
                        "role": session.get("role"),
                        "org_id": session.get("org_id"),
                        "expires_at": session.get("expires_at"),
                        "must_change_password": bool(int(session.get("require_password_change") or 0)),
                    },
                    "csrf_token": session.get("csrf_token"),
                }
            )
            return

        if path == "/api/orgs":
            self._send_json({"ok": True, "orgs": db.list_orgs()})
            return

        if path == "/api/availability":
            days = int(qs.get("days", ["7"])[0])
            preferred = qs.get("preferred", [""])[0]
            timezone_value = qs.get("timezone", [BUSINESS_TZ])[0]
            public_scope = db.resolve_org_id(org_id, org_slug) if (org_id or org_slug) else None
            self._send_json({"ok": True, "slots": build_suggested_slots(days, preferred, timezone_value, org_id=public_scope)})
            return

        match_ics = re.fullmatch(r"/api/appointments/(\d+)/ics", path)
        if match_ics:
            appointment_id = int(match_ics.group(1))
            appointment = db.get_appointment(appointment_id) or {}
            if not appointment:
                self._send_text("Not found", status=404)
                return
            confirmation_code = str(qs.get("code", [""])[0]).strip()
            current_user = self._current_user()
            allowed = False
            if confirmation_code and confirmation_code == str(appointment.get("confirmation_code") or ""):
                allowed = True
            elif current_user:
                try:
                    scoped_org_id = self._resolve_scoped_org(current_user, int(appointment.get("org_id") or 0) or None, None)
                    allowed = bool(scoped_org_id and int(appointment.get("org_id") or 0) == int(scoped_org_id))
                except PermissionError:
                    allowed = False
            if not allowed:
                self._send_text("Forbidden", status=403)
                return
            lead = db.get_lead(int(appointment.get("lead_id") or 0)) or {}
            body = build_ics_content(appointment, lead)
            filename = f"appointment-{appointment.get('confirmation_code') or appointment_id}.ics"
            self._send_text(body, mime="text/calendar; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
            return

        if path.startswith("/api/admin/") or path in {"/api/reminders/preview", "/api/outbound/history"}:
            session = self._require_auth("viewer")
            if not session:
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, org_id, org_slug)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return

            if path == "/api/admin/summary":
                self._send_json({"ok": True, "summary": db.get_summary(scoped_org_id)})
                return
            if path == "/api/admin/orgs":
                if session.get("role") == "admin":
                    self._send_json({"ok": True, "orgs": db.list_orgs()})
                else:
                    self._send_json({"ok": True, "orgs": [db.get_org(int(scoped_org_id))] if scoped_org_id else []})
                return
            if path == "/api/admin/org-presets":
                self._send_json({"ok": True, "presets": db.list_org_presets()})
                return
            match_admin_org_readiness = re.fullmatch(r"/api/admin/orgs/(\d+)/readiness", path)
            if match_admin_org_readiness:
                org_id = int(match_admin_org_readiness.group(1))
                try:
                    scoped_target = self._resolve_scoped_org(session, org_id)
                except PermissionError:
                    self._send_json({"ok": False, "error": "Forbidden"}, status=403)
                    return
                self._send_json({"ok": True, "readiness": db.get_org_readiness(scoped_target)})
                return
            match_admin_org_plan = re.fullmatch(r"/api/admin/orgs/(\d+)/onboarding-plan", path)
            if match_admin_org_plan:
                org_id = int(match_admin_org_plan.group(1))
                try:
                    scoped_target = self._resolve_scoped_org(session, org_id)
                except PermissionError:
                    self._send_json({"ok": False, "error": "Forbidden"}, status=403)
                    return
                preset_slug = str(qs.get('preset_slug', [''])[0] or '').strip()
                self._send_json({"ok": True, "plan": db.get_org_onboarding_plan(scoped_target, preset_slug)})
                return
            match_admin_org_plan_download = re.fullmatch(r"/api/admin/orgs/(\d+)/onboarding-plan/download", path)
            if match_admin_org_plan_download:
                org_id = int(match_admin_org_plan_download.group(1))
                try:
                    scoped_target = self._resolve_scoped_org(session, org_id)
                except PermissionError:
                    self._send_json({"ok": False, "error": "Forbidden"}, status=403)
                    return
                preset_slug = str(qs.get('preset_slug', [''])[0] or '').strip()
                plan = db.get_org_onboarding_plan(scoped_target, preset_slug)
                filename = f"desk-onboarding-plan-{scoped_target}.json"
                self._send_text(json.dumps(plan, indent=2), mime='application/json; charset=utf-8', headers={"Content-Disposition": f'attachment; filename="{filename}"'})
                return
            match_admin_org_runbook_download = re.fullmatch(r"/api/admin/orgs/(\d+)/onboarding-runbook.md", path)
            if match_admin_org_runbook_download:
                org_id = int(match_admin_org_runbook_download.group(1))
                try:
                    scoped_target = self._resolve_scoped_org(session, org_id)
                except PermissionError:
                    self._send_json({"ok": False, "error": "Forbidden"}, status=403)
                    return
                preset_slug = str(qs.get('preset_slug', [''])[0] or '').strip()
                content = db.render_org_onboarding_runbook_markdown(scoped_target, preset_slug)
                filename = f"desk-onboarding-runbook-{scoped_target}.md"
                self._send_text(content, mime='text/markdown; charset=utf-8', headers={"Content-Disposition": f'attachment; filename="{filename}"'})
                return
            if path == "/api/admin/reps":
                self._send_json({"ok": True, "reps": db.list_reps(scoped_org_id)})
                return
            if path == "/api/admin/leads":
                self._send_json({"ok": True, "leads": db.list_leads(scoped_org_id)})
                return
            if path == "/api/admin/ae-bridge":
                self._send_json({"ok": True, **_build_ae_bridge_summary(int(scoped_org_id or db.get_default_org_id()))})
                return
            if path == "/api/admin/ae-bridge/export":
                self._send_json(_build_ae_bridge_export(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/deck":
                self._send_json(_build_ae_bridge_ops_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/sync":
                self._send_json(_build_ae_bridge_sync_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/fulfillment":
                self._send_json(_build_ae_bridge_fulfillment_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/revenue":
                self._send_json(_build_ae_bridge_revenue_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/calendar":
                self._send_json(_build_ae_bridge_calendar_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/settlements":
                self._send_json(_build_ae_bridge_settlement_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/funnel":
                self._send_json(_build_ae_bridge_funnel_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/profitability":
                self._send_json(_build_ae_bridge_profitability_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            if path == "/api/admin/ae-bridge/templates":
                self._send_json(_build_ae_bridge_template_deck(int(scoped_org_id or db.get_default_org_id())))
                return
            match_admin_lead = re.fullmatch(r"/api/admin/leads/(\d+)", path)
            if match_admin_lead:
                lead_id = int(match_admin_lead.group(1))
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                self._send_json({"ok": True, "lead": lead})
                return
            match_admin_lead_memory = re.fullmatch(r"/api/admin/leads/(\d+)/memory", path)
            if match_admin_lead_memory:
                lead_id = int(match_admin_lead_memory.group(1))
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                self._send_json({"ok": True, "lead": lead, "memory": db.refresh_lead_memory(lead_id)})
                return

            match_admin_lead_timeline = re.fullmatch(r"/api/admin/leads/(\d+)/timeline", path)
            if match_admin_lead_timeline:
                lead_id = int(match_admin_lead_timeline.group(1))
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                limit = int(qs.get("limit", ["100"])[0])
                self._send_json({"ok": True, "lead": lead, "timeline": db.lead_activity_timeline(lead_id, limit)})
                return

            match_admin_lead_intake = re.fullmatch(r"/api/admin/leads/(\d+)/intake", path)
            if match_admin_lead_intake:
                lead_id = int(match_admin_lead_intake.group(1))
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                packet = db.get_or_create_intake_packet(lead_id)
                self._send_json({"ok": True, "lead": lead, "intake": packet})
                return
            match_admin_lead_billing = re.fullmatch(r"/api/admin/leads/(\d+)/billing", path)
            if match_admin_lead_billing:
                lead_id = int(match_admin_lead_billing.group(1))
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                billing = db.get_billing_snapshot_for_lead(lead_id)
                self._send_json({"ok": True, "lead": lead, "billing": billing})
                return
            match_admin_lead_documents = re.fullmatch(r"/api/admin/leads/(\d+)/documents", path)
            if match_admin_lead_documents:
                lead_id = int(match_admin_lead_documents.group(1))
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                documents = db.get_or_create_portal_documents_for_lead(lead_id)
                self._send_json({"ok": True, "lead": lead, "documents": documents})
                return
            match_admin_lead_artifacts = re.fullmatch(r"/api/admin/leads/(\d+)/artifacts", path)
            if match_admin_lead_artifacts:
                lead_id = int(match_admin_lead_artifacts.group(1))
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                include_archived = str(qs.get("include_archived", ["0"])[0]).strip().lower() in {"1", "true", "yes"}
                include_deleted = str(qs.get("include_deleted", ["0"])[0]).strip().lower() in {"1", "true", "yes"}
                artifacts = db.list_artifacts_for_lead(lead_id, include_archived=include_archived, include_deleted=include_deleted)
                self._send_json({"ok": True, "lead": lead, "artifacts": artifacts, "include_archived": include_archived, "include_deleted": include_deleted})
                return
            match_admin_lead_artifact_export = re.fullmatch(r"/api/admin/leads/(\d+)/artifacts/export", path)
            if match_admin_lead_artifact_export:
                import io, zipfile
                lead_id = int(match_admin_lead_artifact_export.group(1))
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                include_deleted = str(qs.get("include_deleted", ["0"])[0]).strip().lower() in {"1", "true", "yes"}
                artifacts = db.list_artifacts_for_lead(lead_id, include_archived=True, include_deleted=include_deleted)
                org = db.get_org(int(lead.get('org_id') or db.get_default_org_id())) or {}
                manifest = {
                    'generated_at': db.utcnow_iso(),
                    'include_deleted': include_deleted,
                    'lead': {
                        'id': lead.get('id'),
                        'name': lead.get('name') or '',
                        'email': lead.get('email') or '',
                        'phone': lead.get('phone') or '',
                        'business_name': lead.get('business_name') or '',
                    },
                    'org': {
                        'id': org.get('id'),
                        'name': org.get('name') or '',
                        'slug': org.get('slug') or '',
                    },
                    'artifact_count': len(artifacts),
                    'artifacts': [],
                }
                buffer = io.BytesIO()
                with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
                    for artifact in artifacts:
                        full = db.get_artifact(int(artifact.get('id') or 0), include_content=True) or artifact
                        filename = str(full.get('filename') or f"artifact-{full.get('id')}.bin").strip()
                        safe_name = re.sub(r'[^A-Za-z0-9._-]+', '_', filename) or f"artifact-{full.get('id')}.bin"
                        folder = 'deleted' if str(full.get('status') or '') == 'deleted' else ('archived' if str(full.get('status') or '') != 'active' else 'current')
                        version = int(full.get('version_number') or 1)
                        export_path = f"{folder}/v{version}-{full.get('id')}-{safe_name}"
                        body = b''
                        try:
                            body = base64.b64decode(str(full.get('content_b64') or '').encode('utf-8'))
                        except Exception:
                            body = b''
                        archive.writestr(export_path, body)
                        manifest['artifacts'].append({
                            'id': full.get('id'),
                            'status': full.get('status') or 'active',
                            'category': full.get('category') or '',
                            'visible_to_client': int(full.get('visible_to_client') or 0),
                            'filename': filename,
                            'mime_type': full.get('mime_type') or 'application/octet-stream',
                            'size_bytes': int(full.get('size_bytes') or len(body)),
                            'created_at': full.get('created_at') or '',
                            'version_group': full.get('version_group') or '',
                            'version_number': version,
                            'notes': full.get('notes') or '',
                            'export_path': export_path,
                        })
                    archive.writestr('manifest.json', json.dumps(manifest, indent=2))
                payload = buffer.getvalue()
                filename = f"lead-proof-pack-{lead_id}.zip"
                self._send_bytes(payload, mime='application/zip', headers={"Content-Disposition": f'attachment; filename="{filename}"'})
                return
            match_admin_artifact_download = re.fullmatch(r"/api/admin/artifacts/(\d+)/download", path)
            if match_admin_artifact_download:
                artifact_id = int(match_admin_artifact_download.group(1))
                artifact = db.get_artifact(artifact_id, include_content=True) or {}
                if not artifact:
                    self._send_json({"ok": False, "error": "Artifact not found."}, status=404)
                    return
                if scoped_org_id and int(artifact.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Artifact is outside your org scope."}, status=403)
                    return
                try:
                    body = base64.b64decode(str(artifact.get('content_b64') or '').encode('utf-8'))
                except Exception:
                    self._send_json({"ok": False, "error": "Artifact content is invalid."}, status=500)
                    return
                filename = str(artifact.get('filename') or f'artifact-{artifact_id}.bin').replace('\"', '')
                self._send_bytes(body, mime=str(artifact.get('mime_type') or 'application/octet-stream'), headers={"Content-Disposition": f'attachment; filename="{filename}"'})
                return
            match_public_artifact_download = re.fullmatch(r"/api/public/artifacts/(\d+)/download", path)
            if match_public_artifact_download:
                artifact_id = int(match_public_artifact_download.group(1))
                code = str(qs.get('code', [''])[0]).strip()
                appointment = get_public_appointment_by_code(code) or {}
                artifact = db.get_artifact(artifact_id, include_content=True) or {}
                if not appointment or not artifact or str(artifact.get('status') or '') != 'active' or int(artifact.get('lead_id') or 0) != int(appointment.get('lead_id') or 0) or not int(artifact.get('visible_to_client') or 0):
                    self._send_json({"ok": False, "error": "Artifact not found for this appointment."}, status=404)
                    return
                try:
                    body = base64.b64decode(str(artifact.get('content_b64') or '').encode('utf-8'))
                except Exception:
                    self._send_json({"ok": False, "error": "Artifact content is invalid."}, status=500)
                    return
                filename = str(artifact.get('filename') or f'artifact-{artifact_id}.bin').replace('\"', '')
                self._send_bytes(body, mime=str(artifact.get('mime_type') or 'application/octet-stream'), headers={"Content-Disposition": f'attachment; filename="{filename}"'})
                return
            if path == "/api/admin/appointments":
                self._send_json({"ok": True, "appointments": db.list_appointments(scoped_org_id)})
                return
            if path == "/api/admin/settings":
                org_record = db.get_org(int(scoped_org_id or db.get_default_org_id())) or {}
                settings = get_org_runtime_settings(int(scoped_org_id or db.get_default_org_id()))
                self._send_json({
                    "ok": True,
                    "org": org_record,
                    "settings": {
                        "support_email": org_record.get("support_email") or PUBLIC_SUPPORT_EMAIL,
                        "support_phone": org_record.get("support_phone") or PUBLIC_SUPPORT_PHONE,
                        "timezone": settings.get("timezone") or BUSINESS_TZ,
                        "operating_days": settings.get("operating_days") or [],
                        "open_hour": settings.get("open_hour"),
                        "close_hour": settings.get("close_hour"),
                        "slot_minutes": settings.get("slot_minutes"),
                        "buffer_minutes": settings.get("buffer_minutes"),
                        "reminder_lead_hours": settings.get("reminder_lead_hours"),
                        "autonomy_enabled": bool(settings.get("autonomy_enabled")),
                        "auto_followup_hours": settings.get("auto_followup_hours") or 24,
                        "auto_noshow_minutes": settings.get("auto_noshow_minutes") or 90,
                        "auto_invoice_followup_hours": settings.get("auto_invoice_followup_hours") or 48,
                        "auto_intake_followup_hours": settings.get("auto_intake_followup_hours") or 24,
                        "booking_notice": settings.get("booking_notice") or "",
                        "default_deposit_cents": settings.get("default_deposit_cents") or 0,
                        "default_service_price_cents": settings.get("default_service_price_cents") or 0,
                        "currency": settings.get("currency") or "USD",
                        "payment_instructions": settings.get("payment_instructions") or "",
                        "operating_hours": format_operating_hours(int(scoped_org_id or db.get_default_org_id())),
                    },
                })
                return
            if path == "/api/admin/services":
                self._send_json({"ok": True, "services": db.list_services(scoped_org_id)})
                return
            if path == "/api/admin/packages":
                self._send_json({"ok": True, "packages": db.list_packages(scoped_org_id)})
                return
            if path == "/api/admin/quotes":
                self._send_json({"ok": True, "quotes": db.list_quotes(scoped_org_id)})
                return
            if path == "/api/admin/memberships":
                self._send_json({"ok": True, "memberships": db.list_recurring_memberships(scoped_org_id)})
                return
            if path == "/api/admin/lead-views":
                self._send_json({"ok": True, "views": db.list_lead_views(scoped_org_id, int(session.get("user_id") or 0) or None)})
                return
            if path == "/api/admin/playbooks":
                self._send_json({"ok": True, "playbooks": db.list_playbooks(scoped_org_id, int(session.get("user_id") or 0) or None)})
                return
            if path == "/api/admin/escalations":
                status_filter = str(qs.get("status", [""])[0]).strip()
                self._send_json({"ok": True, "escalations": db.list_escalations(scoped_org_id, status_filter or None)})
                return
            if path == "/api/admin/analytics":
                self._send_json({"ok": True, "analytics": db.get_analytics(scoped_org_id), "risk_board": build_risk_board(scoped_org_id)})
                return
            if path == "/api/admin/conversations":
                lead_id = int(qs.get("lead_id", ["0"])[0])
                if not lead_id:
                    self._send_json({"ok": False, "error": "lead_id is required"}, status=400)
                    return
                lead = db.get_lead(lead_id) or {}
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                self._send_json({"ok": True, "messages": db.get_conversation_for_lead(lead_id)})
                return
            if path == "/api/admin/voice/calls":
                limit = int(qs.get("limit", ["100"])[0])
                self._send_json({"ok": True, "calls": db.list_voice_calls(scoped_org_id, limit)})
                return
            if path == "/api/admin/calendar/status":
                self._send_json(
                    {
                        "ok": True,
                        "providers": provider_status(scoped_org_id),
                        "links": db.list_calendar_event_links(scoped_org_id, limit=100),
                        "logs": db.list_calendar_sync_logs(scoped_org_id, limit=100),
                    }
                )
                return
            if path == "/api/admin/users":
                if not role_allows(session.get("role"), "admin"):
                    self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                    return
                self._send_json({"ok": True, "users": db.list_admin_users(scoped_org_id)})
                return
            if path == "/api/admin/audit":
                limit = int(qs.get("limit", ["100"])[0])
                self._send_json({"ok": True, "events": db.list_audit_events(scoped_org_id, limit)})
                return
            if path == "/api/admin/runtime":
                self._send_json({"ok": True, "runtime": db.runtime_snapshot(scoped_org_id), "worker": WORKER.status()})
                return
            if path == "/api/reminders/preview":
                self._send_json({"ok": True, "reminders": preview_reminders(scoped_org_id)})
                return
            if path == "/api/outbound/history":
                limit = int(qs.get("limit", ["100"])[0])
                self._send_json({"ok": True, "messages": db.list_outbound_messages(scoped_org_id, limit)})
                return
            if path == "/api/admin/inbox":
                limit = int(qs.get("limit", ["100"])[0])
                lead_id = int(qs.get("lead_id", ["0"])[0] or 0)
                if lead_id:
                    lead = db.get_lead(lead_id) or {}
                    if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                        self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                        return
                self._send_json({"ok": True, "messages": db.list_inbound_messages(scoped_org_id, limit, lead_id or None)})
                return

        self._serve_static(path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/public/appointment/intake":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            code = str(payload.get("code") or "").strip()
            appointment = get_public_appointment_by_code(code) or {}
            if not appointment:
                self._send_json({"ok": False, "error": "Appointment not found."}, status=404)
                return
            lead_id = int(appointment.get("lead_id") or 0)
            packet = db.upsert_intake_packet(lead_id, {
                "appointment_id": int(appointment.get("id") or 0),
                "status": str(payload.get("status") or "submitted"),
                "business_need": str(payload.get("business_need") or "").strip(),
                "budget_range": str(payload.get("budget_range") or "").strip(),
                "decision_window": str(payload.get("decision_window") or "").strip(),
                "intake_notes": str(payload.get("intake_notes") or "").strip(),
                "waiver_accepted": bool(payload.get("waiver_accepted")),
            })
            self._audit("public_intake_submitted", org_id=int(appointment.get("org_id") or db.get_default_org_id()), entity_type="intake_packet", entity_id=(packet or {}).get("id"), detail="public intake packet updated")
            self._send_json({"ok": True, "intake": packet, **serialize_public_appointment(appointment)})
            return

        if path == "/api/public/appointment/reschedule":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            code = str(payload.get("code") or "").strip()
            appointment = get_public_appointment_by_code(code) or {}
            if not appointment:
                self._send_json({"ok": False, "error": "Appointment not found."}, status=404)
                return
            try:
                updated = reschedule_appointment(int(appointment.get("id") or 0), str(payload.get("start") or "").strip(), str(payload.get("timezone") or appointment.get("timezone") or BUSINESS_TZ).strip() or BUSINESS_TZ)
                sync_results = sync_appointment(int(updated.get("id") or 0))
                queued_notices = enqueue_appointment_notice(int(updated.get("id") or 0), "rescheduled")
                dispatched_notices = dispatch_outbound(int((updated or {}).get("org_id") or db.get_default_org_id()), [int(item["id"]) for item in queued_notices]) if queued_notices else []
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=409)
                return
            self._audit("appointment_rescheduled_public", org_id=int((updated or {}).get("org_id") or db.get_default_org_id()), entity_type="appointment", entity_id=(updated or {}).get("id"), detail="public appointment reschedule", metadata={"calendar_sync": sync_results, "notice_count": len(queued_notices)})
            self._send_json({"ok": True, **serialize_public_appointment(updated or {}), "calendar_sync": sync_results, "queued_notices": queued_notices, "dispatched_notices": dispatched_notices})
            return

        if path == "/api/public/appointment/cancel":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            code = str(payload.get("code") or "").strip()
            appointment = get_public_appointment_by_code(code) or {}
            if not appointment:
                self._send_json({"ok": False, "error": "Appointment not found."}, status=404)
                return
            try:
                updated = cancel_appointment(int(appointment.get("id") or 0))
                sync_results = sync_appointment(int(updated.get("id") or 0))
                queued_notices = enqueue_appointment_notice(int(updated.get("id") or 0), "cancelled")
                dispatched_notices = dispatch_outbound(int((updated or {}).get("org_id") or db.get_default_org_id()), [int(item["id"]) for item in queued_notices]) if queued_notices else []
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=404)
                return
            self._audit("appointment_cancelled_public", org_id=int((updated or {}).get("org_id") or db.get_default_org_id()), entity_type="appointment", entity_id=(updated or {}).get("id"), detail="public appointment cancellation", metadata={"calendar_sync": sync_results, "notice_count": len(queued_notices)})
            self._send_json({"ok": True, **serialize_public_appointment(updated or {}), "calendar_sync": sync_results, "queued_notices": queued_notices, "dispatched_notices": dispatched_notices})
            return


        if path == "/api/public/quotes/accept":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            quote_code = str(payload.get("quote_code") or "").strip()
            code = str(payload.get("code") or "").strip()
            quote = db.get_quote_by_code(quote_code) or {}
            appointment = get_public_appointment_by_code(code) or {}
            if not quote or not appointment or int(quote.get("lead_id") or 0) != int(appointment.get("lead_id") or 0):
                self._send_json({"ok": False, "error": "Quote not found for this appointment."}, status=404)
                return
            if str(quote.get('status') or '') == 'accepted':
                self._send_json({"ok": True, "quote": quote, **serialize_public_appointment(appointment)})
                return
            accepted_name = str(payload.get('accepted_name') or '').strip() or str((db.get_lead(int(quote.get('lead_id') or 0)) or {}).get('name') or 'Client')
            accepted_title = str(payload.get('accepted_title') or '').strip()
            accepted_company = str(payload.get('accepted_company') or '').strip()
            acceptance_signature = str(payload.get('acceptance_signature') or '').strip() or accepted_name
            updated_quote = db.update_quote(int(quote.get('id') or 0), {
                'status': 'accepted',
                'accepted_at': db.utcnow_iso(),
                'accepted_name': accepted_name,
                'accepted_title': accepted_title,
                'accepted_company': accepted_company,
                'acceptance_signature': acceptance_signature,
                'acceptance_notes': str(payload.get('acceptance_notes') or '').strip(),
                'metadata': {
                    **dict(quote.get('metadata') or {}),
                    'acceptance_receipt_ready': True,
                    'acceptance_channel': 'public_portal',
                },
            }) or quote
            invoice = None
            deposit_cents = int(updated_quote.get('deposit_cents') or 0)
            if deposit_cents > 0:
                invoice = db.create_invoice({
                    'org_id': int(updated_quote.get('org_id') or db.get_default_org_id()),
                    'lead_id': int(updated_quote.get('lead_id') or 0),
                    'appointment_id': int(appointment.get('id') or 0),
                    'kind': 'quote_deposit',
                    'description': f"Deposit for {updated_quote.get('title') or 'accepted quote'}",
                    'amount_cents': deposit_cents,
                    'balance_cents': deposit_cents,
                    'currency': str(updated_quote.get('currency') or 'USD'),
                    'status': 'sent',
                    'due_ts': str(appointment.get('start_ts') or ''),
                    'notes': str((db.get_org(int(updated_quote.get('org_id') or db.get_default_org_id())) or {}).get('payment_instructions') or ''),
                })
            db.refresh_lead_memory(int(updated_quote.get('lead_id') or 0))
            self._audit('quote_accepted_public', org_id=int(updated_quote.get('org_id') or db.get_default_org_id()), entity_type='quote', entity_id=updated_quote.get('id'), detail='public quote acceptance', metadata={'invoice_id': (invoice or {}).get('id')})
            self._send_json({"ok": True, "quote": updated_quote, "invoice": invoice, **serialize_public_appointment(appointment)})
            return

        if path == "/api/public/quotes/respond":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            quote_code = str(payload.get('quote_code') or '').strip()
            code = str(payload.get('code') or '').strip()
            action = str(payload.get('action') or '').strip().lower()
            quote = db.get_quote_by_code(quote_code) or {}
            appointment = get_public_appointment_by_code(code) or {}
            if not quote or not appointment or int(quote.get('lead_id') or 0) != int(appointment.get('lead_id') or 0):
                self._send_json({"ok": False, "error": "Quote not found for this appointment."}, status=404)
                return
            if action not in {'request_changes', 'decline'}:
                self._send_json({"ok": False, "error": "Unsupported quote response."}, status=400)
                return
            responder = str(payload.get('accepted_name') or '').strip() or str((db.get_lead(int(quote.get('lead_id') or 0)) or {}).get('name') or 'Client')
            note = str(payload.get('acceptance_notes') or '').strip()
            status = 'needs_revision' if action == 'request_changes' else 'declined'
            updated_quote = db.update_quote(int(quote.get('id') or 0), {'status': status, 'accepted_name': responder, 'acceptance_notes': note, 'accepted_at': ''}) or quote
            db.refresh_lead_memory(int(updated_quote.get('lead_id') or 0))
            self._audit('quote_response_public', org_id=int(updated_quote.get('org_id') or db.get_default_org_id()), entity_type='quote', entity_id=updated_quote.get('id'), detail=f'public quote {status}', metadata={'notes': note[:200]})
            self._send_json({"ok": True, "quote": updated_quote, **serialize_public_appointment(appointment)})
            return

        if path == "/api/public/payments/commit":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            code = str(payload.get('code') or '').strip()
            appointment = get_public_appointment_by_code(code) or {}
            if not appointment:
                self._send_json({"ok": False, "error": "Appointment not found."}, status=404)
                return
            lead_id = int(appointment.get('lead_id') or 0)
            invoice_id = int(payload.get('invoice_id') or 0) or None
            invoice = db.get_invoice(invoice_id) if invoice_id else None
            if invoice_id and (not invoice or int(invoice.get('lead_id') or 0) != lead_id):
                self._send_json({"ok": False, "error": "Invoice not found for this appointment."}, status=404)
                return
            try:
                commitment = db.create_payment_commitment({
                    'org_id': int(appointment.get('org_id') or db.get_default_org_id()),
                    'lead_id': lead_id,
                    'appointment_id': int(appointment.get('id') or 0),
                    'invoice_id': invoice_id,
                    'requester_name': str(payload.get('requester_name') or '').strip(),
                    'requested_amount_cents': int(payload.get('requested_amount_cents') or payload.get('amount_cents') or (invoice or {}).get('balance_cents') or 0),
                    'method': str(payload.get('method') or 'ach').strip() or 'ach',
                    'planned_for_ts': str(payload.get('planned_for_ts') or '').strip(),
                    'notes': str(payload.get('notes') or '').strip(),
                    'status': 'pending',
                    'source': 'public_portal',
                })
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('payment_commitment_public', org_id=int(appointment.get('org_id') or db.get_default_org_id()), entity_type='payment_commitment', entity_id=(commitment or {}).get('id'), detail='public payment commitment submitted', metadata={'invoice_id': invoice_id, 'method': (commitment or {}).get('method'), 'amount_cents': (commitment or {}).get('requested_amount_cents')})
            self._send_json({"ok": True, "payment_commitment": commitment, **serialize_public_appointment(appointment)})
            return

        if path == "/api/public/payments/commitment-action":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            code = str(payload.get('code') or '').strip()
            action = str(payload.get('action') or '').strip().lower()
            commitment_id = int(payload.get('commitment_id') or 0)
            appointment = get_public_appointment_by_code(code) or {}
            commitment = db.get_payment_commitment(commitment_id) or {}
            if not appointment or not commitment:
                self._send_json({"ok": False, "error": "Payment commitment not found."}, status=404)
                return
            if int(commitment.get('lead_id') or 0) != int(appointment.get('lead_id') or 0):
                self._send_json({"ok": False, "error": "Payment commitment not found for this appointment."}, status=404)
                return
            if action not in {'cancel', 'reopen'}:
                self._send_json({"ok": False, "error": "Unsupported public payment commitment action."}, status=400)
                return
            current_status = str(commitment.get('status') or '').strip().lower()
            if action == 'cancel' and current_status not in {'pending', 'confirmed'}:
                self._send_json({"ok": False, "error": 'Only pending or confirmed payment commitments can be cancelled from the portal.'}, status=400)
                return
            if action == 'reopen' and current_status != 'cancelled':
                self._send_json({"ok": False, "error": 'Only cancelled payment commitments can be reopened from the portal.'}, status=400)
                return
            note = str(payload.get('note') or '').strip()
            try:
                updated = db.apply_payment_commitment_action(commitment_id, action, note)
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            result_commitment = updated.get('commitment') if isinstance(updated, dict) and 'commitment' in updated else updated
            self._audit('payment_commitment_public_action', org_id=int(appointment.get('org_id') or db.get_default_org_id()), entity_type='payment_commitment', entity_id=commitment_id, detail=f'public payment commitment {action}', metadata={'note': note[:200]})
            self._send_json({"ok": True, "payment_commitment": result_commitment, **serialize_public_appointment(appointment)})
            return

        if path == "/api/public/artifacts/upload":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            code = str(payload.get('code') or '').strip()
            appointment = get_public_appointment_by_code(code) or {}
            if not appointment:
                self._send_json({"ok": False, "error": "Appointment not found."}, status=404)
                return
            filename = str(payload.get('filename') or '').strip()
            content_b64 = str(payload.get('content_b64') or '').strip()
            if not filename or not content_b64:
                self._send_json({"ok": False, "error": "File content and filename are required."}, status=400)
                return
            try:
                size_bytes = len(base64.b64decode(content_b64.encode('utf-8'), validate=True))
            except Exception:
                self._send_json({"ok": False, "error": "Invalid file encoding."}, status=400)
                return
            if size_bytes > 3 * 1024 * 1024:
                self._send_json({"ok": False, "error": "File exceeds the 3 MB portal limit."}, status=400)
                return
            artifact = db.create_artifact({
                'org_id': int(appointment.get('org_id') or db.get_default_org_id()),
                'lead_id': int(appointment.get('lead_id') or 0),
                'appointment_id': int(appointment.get('id') or 0),
                'quote_id': int(payload.get('quote_id') or 0) or None,
                'document_id': int(payload.get('document_id') or 0) or None,
                'category': str(payload.get('category') or 'client_upload').strip() or 'client_upload',
                'uploader_scope': 'public',
                'visible_to_client': True,
                'filename': filename,
                'mime_type': str(payload.get('mime_type') or 'application/octet-stream').strip() or 'application/octet-stream',
                'size_bytes': size_bytes,
                'content_b64': content_b64,
                'notes': str(payload.get('notes') or '').strip(),
            })
            self._audit('artifact_uploaded_public', org_id=int(appointment.get('org_id') or db.get_default_org_id()), entity_type='proof_artifact', entity_id=(artifact or {}).get('id'), detail='public proof upload', metadata={'filename': filename, 'size_bytes': size_bytes})
            self._send_json({"ok": True, "artifact": artifact, **serialize_public_appointment(appointment)})
            return

        if path == "/api/public/documents/sign":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            code = str(payload.get('code') or '').strip()
            document_id = int(payload.get('document_id') or 0)
            appointment = get_public_appointment_by_code(code) or {}
            if not appointment:
                self._send_json({"ok": False, "error": "Appointment not found."}, status=404)
                return
            documents = db.list_portal_documents_for_lead(int(appointment.get('lead_id') or 0))
            if document_id not in {int(item.get('id') or 0) for item in documents}:
                self._send_json({"ok": False, "error": "Document not found for this appointment."}, status=404)
                return
            signed = db.sign_portal_document(document_id, str(payload.get('signed_name') or '').strip() or 'Client')
            self._audit('portal_document_signed_public', org_id=int(appointment.get('org_id') or db.get_default_org_id()), entity_type='portal_document', entity_id=document_id, detail='public document signed')
            self._send_json({"ok": True, "document": signed, **serialize_public_appointment(appointment)})
            return

        if path == "/api/admin/leads":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, payload.get("org_id"), payload.get("org_slug"))
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            lead = db.create_lead(
                {
                    "org_id": int(scoped_org_id or db.get_default_org_id()),
                    "name": str(payload.get("name") or "").strip(),
                    "email": str(payload.get("email") or "").strip(),
                    "phone": str(payload.get("phone") or "").strip(),
                    "business_name": str(payload.get("business_name") or "").strip(),
                    "service_interest": str(payload.get("service_interest") or "").strip(),
                    "urgency": str(payload.get("urgency") or "").strip(),
                    "preferred_schedule": str(payload.get("preferred_schedule") or "").strip(),
                    "timezone": str(payload.get("timezone") or BUSINESS_TZ).strip() or BUSINESS_TZ,
                    "notes": str(payload.get("notes") or "").strip(),
                    "source": str(payload.get("source") or "admin").strip() or "admin",
                    "qualification_status": str(payload.get("qualification_status") or "new").strip() or "new",
                    "assigned_rep_id": int(payload.get("assigned_rep_id") or 0) or None,
                    "tags": payload.get("tags") or [],
                }
            )
            session_row = db.create_session(int(lead["id"]), int(lead.get("org_id") or db.get_default_org_id())) if lead else None
            self._audit("lead_created_admin", session=session, org_id=int((lead or {}).get("org_id") or db.get_default_org_id()), entity_type="lead", entity_id=(lead or {}).get("id"), detail="admin lead created", metadata={"session_id": (session_row or {}).get("id")})
            self._send_json({"ok": True, "lead": lead, "session": session_row})
            return

        match_admin_lead_update = re.fullmatch(r"/api/admin/leads/(\d+)", path)
        if match_admin_lead_update:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            lead_id = int(match_admin_lead_update.group(1))
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            assigned_rep_id = int(payload.get("assigned_rep_id") or lead.get("assigned_rep_id") or 0) or None
            assigned_owner = str(lead.get("assigned_owner") or "")
            if assigned_rep_id:
                rep = db.get_rep(int(assigned_rep_id)) or {}
                if rep:
                    assigned_owner = str(rep.get("name") or assigned_owner or "Founder Desk")
            updated = db.update_lead(
                lead_id,
                {
                    "name": str(payload.get("name") or lead.get("name") or "").strip(),
                    "email": str(payload.get("email") or lead.get("email") or "").strip(),
                    "phone": str(payload.get("phone") or lead.get("phone") or "").strip(),
                    "business_name": str(payload.get("business_name") or lead.get("business_name") or "").strip(),
                    "service_interest": str(payload.get("service_interest") or lead.get("service_interest") or "").strip(),
                    "urgency": str(payload.get("urgency") or lead.get("urgency") or "").strip(),
                    "preferred_schedule": str(payload.get("preferred_schedule") or lead.get("preferred_schedule") or "").strip(),
                    "timezone": str(payload.get("timezone") or lead.get("timezone") or BUSINESS_TZ).strip() or BUSINESS_TZ,
                    "qualification_status": str(payload.get("qualification_status") or lead.get("qualification_status") or "new").strip() or "new",
                    "source": str(payload.get("source") or lead.get("source") or "admin").strip() or "admin",
                    "notes": str(payload.get("notes") or lead.get("notes") or "").strip(),
                    "tags": payload.get("tags") if isinstance(payload.get("tags"), list) else (lead.get("tags") or []),
                    "assigned_rep_id": assigned_rep_id,
                    "assigned_owner": assigned_owner or "Founder Desk",
                },
            ) or {}
            self._audit("lead_updated_admin", session=session, org_id=int((updated or {}).get("org_id") or db.get_default_org_id()), entity_type="lead", entity_id=lead_id, detail="admin lead updated")
            self._send_json({"ok": True, "lead": updated})
            return

        if path == "/api/admin/leads/bulk-update":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_ids = [int(item) for item in (payload.get("lead_ids") or []) if int(item or 0) > 0]
            if not lead_ids:
                self._send_json({"ok": False, "error": "lead_ids is required"}, status=400)
                return
            rep_id = int(payload.get("assigned_rep_id") or 0) or None
            rep = db.get_rep(rep_id) if rep_id else None
            add_tags = [str(item).strip() for item in (payload.get("add_tags") or []) if str(item).strip()]
            remove_tags = {str(item).strip().lower() for item in (payload.get("remove_tags") or []) if str(item).strip()}
            updated_leads = []
            for lead_id in lead_ids:
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    continue
                try:
                    scoped_org_id = self._resolve_scoped_org(session, int(lead.get("org_id") or 0) or None, None)
                except PermissionError:
                    continue
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    continue
                merged_tags = [str(item).strip() for item in (lead.get("tags") or []) if str(item).strip()]
                for tag in add_tags:
                    if tag.lower() not in {item.lower() for item in merged_tags}:
                        merged_tags.append(tag)
                if remove_tags:
                    merged_tags = [item for item in merged_tags if item.lower() not in remove_tags]
                assigned_owner = str(lead.get("assigned_owner") or "Founder Desk")
                if rep:
                    assigned_owner = str(rep.get("name") or assigned_owner or "Founder Desk")
                updated = db.update_lead(
                    lead_id,
                    {
                        "qualification_status": str(payload.get("qualification_status") or lead.get("qualification_status") or "new").strip() or "new",
                        "assigned_rep_id": int(rep.get("id") or 0) if rep else (int(lead.get("assigned_rep_id") or 0) or None),
                        "assigned_owner": assigned_owner,
                        "source": str(payload.get("source") or lead.get("source") or "admin").strip() or "admin",
                        "tags": merged_tags,
                        "last_contacted_at": db.utcnow_iso() if bool(payload.get("touch_last_contacted")) else str(lead.get("last_contacted_at") or ''),
                    },
                ) or {}
                updated_leads.append(updated)
            self._audit("lead_bulk_updated", session=session, org_id=int((updated_leads[0] or {}).get("org_id") or db.get_default_org_id()) if updated_leads else db.get_default_org_id(), entity_type="lead", entity_id="bulk", detail="bulk lead update", metadata={"lead_count": len(updated_leads), "requested_count": len(lead_ids)})
            self._send_json({"ok": True, "leads": updated_leads, "updated_count": len(updated_leads)})
            return

        if path == "/api/admin/appointments/manual":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(payload.get("lead_id") or 0)
            start_ts = str(payload.get("start") or "").strip()
            timezone_value = str(payload.get("timezone") or BUSINESS_TZ).strip() or BUSINESS_TZ
            if not lead_id or not start_ts:
                self._send_json({"ok": False, "error": "lead_id and start are required"}, status=400)
                return
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                return
            session_row = db.get_latest_session_for_lead(lead_id) or db.create_session(lead_id, int(lead.get("org_id") or db.get_default_org_id()))
            try:
                appt = book_appointment(lead_id, int((session_row or {}).get("id") or 0) or None, start_ts, timezone_value, str(payload.get("notes") or "").strip())
                sync_results = sync_appointment(int(appt.get("id") or 0))
                queued_notices = enqueue_appointment_notice(int(appt.get("id") or 0), "booked")
                dispatched_notices = dispatch_outbound(int((appt or {}).get("org_id") or db.get_default_org_id()), [int(item["id"]) for item in queued_notices]) if queued_notices else []
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=409)
                return
            self._audit("appointment_booked_admin", session=session, org_id=int((appt or {}).get("org_id") or db.get_default_org_id()), entity_type="appointment", entity_id=(appt or {}).get("id"), detail="admin manual booking created", metadata={"calendar_sync": sync_results, "notice_count": len(queued_notices)})
            self._send_json({"ok": True, "appointment": appt, "calendar_sync": sync_results, "ics_url": appointment_ics_url(appt or {}), "manage_url": appointment_manage_url(appt or {}), "queued_notices": queued_notices, "dispatched_notices": dispatched_notices})
            return

        match_status_update = re.fullmatch(r"/api/appointments/(\d+)/status", path)
        if match_status_update:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            appointment_id = int(match_status_update.group(1))
            appointment = db.get_appointment(appointment_id) or {}
            if not appointment:
                self._send_json({"ok": False, "error": "Appointment not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(appointment.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            if scoped_org_id and int(appointment.get("org_id") or 0) != int(scoped_org_id):
                self._send_json({"ok": False, "error": "Appointment is outside your org scope."}, status=403)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            status_value = str(payload.get("status") or "").strip().lower()
            allowed_statuses = {"booked", "confirmed", "completed", "no_show"}
            if status_value not in allowed_statuses:
                self._send_json({"ok": False, "error": "Unsupported status."}, status=400)
                return
            updated = db.update_appointment(appointment_id, {"status": status_value}) or {}
            self._audit("appointment_status_updated", session=session, org_id=int((updated or {}).get("org_id") or db.get_default_org_id()), entity_type="appointment", entity_id=appointment_id, detail=f"appointment marked {status_value}")
            self._send_json({"ok": True, "appointment": updated, "ics_url": appointment_ics_url(updated or {}), "manage_url": appointment_manage_url(updated or {})})
            return

        if path == "/api/auth/login":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            email = str(payload.get("email", "")).strip()
            password = str(payload.get("password", ""))
            user = db.get_admin_user_by_email(email)
            if not user or int(user.get("is_active") or 0) != 1:
                self._audit("login_failed", org_id=db.get_default_org_id(), entity_type="admin_user", entity_id=email, status="blocked", detail="unknown or inactive account")
                self._send_json({"ok": False, "error": "Invalid email or password."}, status=401)
                return
            if db.user_locked(user):
                self._audit("login_locked", org_id=int(user.get("org_id") or db.get_default_org_id()), entity_type="admin_user", entity_id=user.get("id"), status="blocked", detail="user lockout active", metadata={"email": email})
                self._send_json({"ok": False, "error": "Too many failed login attempts. Try again later."}, status=429)
                return
            if not verify_password(password, str(user.get("password_hash") or "")):
                current_failures = int(user.get("failed_login_count") or 0) + 1
                threshold = login_lockout_threshold()
                lock_until = ""
                if current_failures >= threshold:
                    lock_until = (datetime.utcnow() + timedelta(minutes=login_lockout_minutes())).replace(microsecond=0).isoformat() + "Z"
                db.increment_login_failure(int(user["id"]), lock_until)
                if lock_until:
                    self._audit("login_failed", org_id=int(user.get("org_id") or db.get_default_org_id()), entity_type="admin_user", entity_id=user.get("id"), status="blocked", detail="account locked after repeated failures", metadata={"email": email, "failed_login_count": current_failures})
                    self._send_json({"ok": False, "error": "Too many failed login attempts. Try again later."}, status=429)
                else:
                    self._audit("login_failed", org_id=int(user.get("org_id") or db.get_default_org_id()), entity_type="admin_user", entity_id=user.get("id"), status="blocked", detail="invalid password", metadata={"email": email, "failed_login_count": current_failures})
                    self._send_json({"ok": False, "error": "Invalid email or password."}, status=401)
                return
            db.reset_login_failures(int(user["id"]))
            token = new_session_token()
            session = db.create_admin_session(int(user["id"]), token, csrf_token(), session_ttl_hours()) or {}
            refreshed_user = db.get_admin_user(int(user["id"])) or user
            self._audit("login_success", session=session, org_id=int(refreshed_user.get("org_id") or db.get_default_org_id()), entity_type="admin_session", entity_id=session.get("id"), detail="admin login success")
            self._send_json(
                {
                    "ok": True,
                    "user": {
                        "id": refreshed_user.get("id"),
                        "email": refreshed_user.get("email"),
                        "display_name": refreshed_user.get("display_name"),
                        "role": refreshed_user.get("role"),
                        "org_id": refreshed_user.get("org_id"),
                        "must_change_password": bool(int(refreshed_user.get("require_password_change") or 0)),
                    },
                    "csrf_token": session.get("csrf_token"),
                },
                headers={"Set-Cookie": self._session_cookie_header(token)},
            )
            return

        if path == "/api/auth/change-password":
            session = self._require_auth("viewer", allow_password_change_only=True)
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            current_password = str(payload.get("current_password", ""))
            new_password = str(payload.get("new_password", ""))
            confirm_password = str(payload.get("confirm_password", ""))
            user = db.get_admin_user(int(session.get("user_id") or 0))
            if not user or not verify_password(current_password, str(user.get("password_hash") or "")):
                self._send_json({"ok": False, "error": "Current password is incorrect."}, status=400)
                return
            if new_password != confirm_password:
                self._send_json({"ok": False, "error": "New password and confirmation do not match."}, status=400)
                return
            if current_password == new_password:
                self._send_json({"ok": False, "error": "Choose a different password."}, status=400)
                return
            valid, message = validate_password_policy(new_password, str(user.get("email") or ""))
            if not valid:
                self._send_json({"ok": False, "error": message}, status=400)
                return
            updated = db.update_admin_password(int(user["id"]), hash_password(new_password), require_password_change=0) or user
            self._audit("password_changed", session=session, org_id=int(updated.get("org_id") or db.get_default_org_id()), entity_type="admin_user", entity_id=updated.get("id"), detail="password rotated")
            self._send_json(
                {
                    "ok": True,
                    "user": {
                        "id": updated.get("id"),
                        "email": updated.get("email"),
                        "display_name": updated.get("display_name"),
                        "role": updated.get("role"),
                        "org_id": updated.get("org_id"),
                        "must_change_password": False,
                    },
                }
            )
            return

        if path == "/api/auth/logout":
            token = self._auth_token()
            session = self._current_user()
            if token:
                db.delete_admin_session(token)
            if session:
                self._audit("logout", session=session, org_id=int(session.get("org_id") or db.get_default_org_id()), entity_type="admin_user", entity_id=session.get("user_id"), detail="session terminated")
            self._send_json({"ok": True}, headers={"Set-Cookie": self._clear_session_cookie_header()})
            return

        if path in {"/api/inbound/sms", "/api/inbound/email"}:
            channel = 'sms' if path.endswith('/sms') else 'email'
            raw = self._read_body_bytes()
            if not self._require_inbound_channel_webhook(raw, channel):
                return
            try:
                payload = json.loads(raw.decode('utf-8')) if raw else {}
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            try:
                result = handle_inbound_message(channel, payload)
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit(
                "inbound_message_captured",
                org_id=int((result.get('lead') or {}).get('org_id') or db.get_default_org_id()),
                entity_type="inbound_message",
                entity_id=(result.get('inbound') or {}).get('id'),
                detail=f"{channel} reply captured",
                metadata={"action_taken": result.get('action_taken') or '', "lead_id": (result.get('lead') or {}).get('id')},
            )
            self._send_json({"ok": True, **result})
            return

        if path == "/api/chat/start":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            payload["qualification_status"] = compute_qualification_status(payload)
            lead = db.create_lead(payload)
            session = db.create_session(int(lead["id"]), int(lead.get("org_id") or db.get_default_org_id())) if lead else None
            reply = build_reply(lead or {}, "") if lead else {"text": "Could not start session.", "suggested_slots": []}
            if session:
                db.add_message(int(session["id"]), "assistant", reply["text"], {"kind": "opening"})
            self._audit("lead_created", org_id=int((lead or {}).get("org_id") or db.get_default_org_id()), entity_type="lead", entity_id=(lead or {}).get("id"), detail="public lead intake created", metadata={"session_id": (session or {}).get("id")})
            self._send_json({"ok": True, "lead": lead, "session": session, "assistant": reply})
            return

        if path == "/api/chat/message":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            session_id = int(payload.get("session_id", 0))
            message = str(payload.get("message", "")).strip()
            if not session_id or not message:
                self._send_json({"ok": False, "error": "session_id and message are required"}, status=400)
                return
            session = db.get_session(session_id)
            if not session:
                self._send_json({"ok": False, "error": "Session not found"}, status=404)
                return
            lead_id = int(session["lead_id"])
            db.add_message(session_id, "user", message)
            updates = extract_updates_from_message(message)
            lead = db.update_lead(lead_id, updates) or db.get_lead(lead_id) or {}
            reply = build_reply(lead, message)
            db.add_message(session_id, "assistant", reply["text"], {"suggested_slots": reply.get("suggested_slots", []), "recommended_service": (reply.get('recommended_service') or {}).get('name', ''), "recommended_package": (reply.get('recommended_package') or {}).get('name', '')})
            escalation = escalation_from_message(lead, session_id, message, None, 'chat')
            memory = db.refresh_lead_memory(lead_id)
            self._send_json({"ok": True, "assistant": reply, "lead": lead, "escalation": escalation, "memory": memory})
            return

        if path == "/api/appointments":
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(payload.get("lead_id", 0))
            start_ts = str(payload.get("start", "")).strip()
            timezone_value = str(payload.get("timezone", BUSINESS_TZ)).strip() or BUSINESS_TZ
            if not lead_id or not start_ts:
                self._send_json({"ok": False, "error": "lead_id and start are required"}, status=400)
                return
            try:
                appt = book_appointment(lead_id, payload.get("session_id"), start_ts, timezone_value, str(payload.get("notes", "")))
                sync_results = sync_appointment(int(appt["id"])) if appt else []
                queued_notices = enqueue_appointment_notice(int(appt["id"]), "confirmation") if appt else []
                dispatched_notices = dispatch_outbound(int(appt.get("org_id") or db.get_default_org_id()), [int(item["id"]) for item in queued_notices]) if queued_notices else []
                intake_packet = db.get_or_create_intake_packet(int(appt.get("lead_id") or 0), int(appt.get("id") or 0), int(appt.get("org_id") or db.get_default_org_id())) if appt else None
                settings = get_org_runtime_settings(int(appt.get("org_id") or db.get_default_org_id())) if appt else {}
                invoice = None
                deposit_cents = int(settings.get("default_deposit_cents") or 0) if settings else 0
                if appt and deposit_cents > 0:
                    invoice = db.create_invoice({
                        "org_id": int(appt.get("org_id") or db.get_default_org_id()),
                        "lead_id": int(appt.get("lead_id") or 0),
                        "appointment_id": int(appt.get("id") or 0),
                        "kind": "deposit",
                        "description": "Booking deposit",
                        "amount_cents": deposit_cents,
                        "balance_cents": deposit_cents,
                        "currency": settings.get("currency") or "USD",
                        "status": "sent",
                        "due_ts": str(appt.get("start_ts") or ""),
                        "notes": str(settings.get("payment_instructions") or "").strip(),
                    })
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=409)
                return
            self._audit("appointment_booked", org_id=int((appt or {}).get("org_id") or db.get_default_org_id()), entity_type="appointment", entity_id=(appt or {}).get("id"), detail="appointment booked", metadata={"calendar_sync": sync_results, "notice_count": len(queued_notices)})
            self._send_json({"ok": True, "appointment": appt, "calendar_sync": sync_results, "ics_url": appointment_ics_url(appt or {}), "manage_url": appointment_manage_url(appt or {}), "queued_notices": queued_notices, "dispatched_notices": dispatched_notices, "intake": intake_packet, "invoice": invoice})
            return

        if path == "/api/voice/calls":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(payload.get("lead_id", 0))
            if not lead_id:
                self._send_json({"ok": False, "error": "lead_id is required"}, status=400)
                return
            lead = db.get_lead(lead_id) or {}
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                return
            try:
                call = start_voice_call(
                    lead_id,
                    purpose=str(payload.get("purpose") or "qualification"),
                    appointment_id=int(payload.get("appointment_id") or 0) or None,
                    initiated_by=str(session.get("email") or ""),
                )
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit("voice_call_started", session=session, org_id=int((call or {}).get("org_id") or db.get_default_org_id()), entity_type="voice_call", entity_id=(call or {}).get("id"), detail="outbound voice call started", metadata={"purpose": (call or {}).get("purpose")})
            self._send_json({"ok": True, "call": call})
            return

        if path == "/api/voice/inbound":
            raw = self._read_body_bytes()
            if not self._require_signed_webhook(raw):
                return
            try:
                payload = json.loads(raw.decode("utf-8")) if raw else {}
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            transcript = str(payload.get("transcript") or "").strip()
            from_number = str(payload.get("from") or payload.get("from_number") or "").strip()
            if not transcript or not from_number:
                self._send_json({"ok": False, "error": "from and transcript are required"}, status=400)
                return
            result = ingest_inbound_call(from_number, transcript, payload.get("org_id"), str(payload.get("purpose") or "inbound"))
            self._audit("voice_inbound_captured", org_id=int((result.get("lead") or {}).get("org_id") or db.get_default_org_id()), entity_type="voice_call", entity_id=(result.get("call") or {}).get("id"), detail="inbound voice transcript captured")
            self._send_json({"ok": True, **result})
            return

        match_voice_complete = re.fullmatch(r"/api/voice/calls/(\d+)/complete", path)
        if match_voice_complete:
            raw = self._read_body_bytes()
            if not self._require_signed_webhook(raw):
                return
            call_id = int(match_voice_complete.group(1))
            try:
                payload = json.loads(raw.decode("utf-8")) if raw else {}
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            try:
                updated = complete_voice_call(
                    call_id,
                    transcript=str(payload.get("transcript") or ""),
                    status=str(payload.get("status") or "completed"),
                    outcome=str(payload.get("outcome") or ""),
                    duration_seconds=int(payload.get("duration_seconds") or 0),
                    provider_call_id=str(payload.get("provider_call_id") or ""),
                )
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=404)
                return
            self._audit("voice_call_completed", org_id=int((updated or {}).get("org_id") or db.get_default_org_id()), entity_type="voice_call", entity_id=(updated or {}).get("id"), detail="voice call completion webhook applied")
            self._send_json({"ok": True, "call": updated})
            return

        protected_manager_paths = {"/api/admin/calendar/sync", "/api/reminders/queue", "/api/outbound/dispatch", "/api/admin/settings", "/api/admin/outbound/manual", "/api/admin/orgs", "/api/admin/reps", "/api/admin/autonomy/run", "/api/admin/memberships/run"}

        match_admin_org_autofix = re.fullmatch(r"/api/admin/orgs/(\d+)/autofix", path)
        if match_admin_org_autofix:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            target_org_id = int(match_admin_org_autofix.group(1))
            try:
                scoped_org_id = self._resolve_scoped_org(session, target_org_id)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                result = db.autofix_org_readiness(
                    scoped_org_id,
                    str(payload.get('preset_slug') or '').strip(),
                    bool(payload.get('seed_reps', True)),
                )
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('org_readiness_autofix', session=session, org_id=scoped_org_id, entity_type='organization', entity_id=scoped_org_id, detail='desk readiness autofix run', metadata={'preset_slug': str(payload.get('preset_slug') or '').strip(), 'before_percent': ((result.get('before') or {}).get('percent_complete') or 0), 'after_percent': ((result.get('after') or {}).get('percent_complete') or 0)})
            self._send_json({"ok": True, "result": result})
            return

        if path == "/api/admin/ae-bridge":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            target_org_id = int(payload.get('org_id') or org_id or db.get_default_org_id())
            try:
                scoped_target = self._resolve_scoped_org(session, target_org_id, org_slug)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            imported = _import_ae_bridge_payload(int(scoped_target or db.get_default_org_id()), payload)
            self._audit('ae_bridge_import', session=session, org_id=int(scoped_target or db.get_default_org_id()), entity_type='organization', entity_id=int(scoped_target or db.get_default_org_id()), detail='AE bridge payload imported', metadata=imported)
            self._send_json({"ok": True, "imported": imported, **_build_ae_bridge_summary(int(scoped_target or db.get_default_org_id()))})
            return

        match_admin_lead_intake_post = re.fullmatch(r"/api/admin/leads/(\d+)/intake", path)
        if match_admin_lead_intake_post:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(match_admin_lead_intake_post.group(1))
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            packet = db.upsert_intake_packet(lead_id, {
                "org_id": int(scoped_org_id or lead.get("org_id") or db.get_default_org_id()),
                "appointment_id": int(payload.get("appointment_id") or 0) or None,
                "status": str(payload.get("status") or "pending"),
                "business_need": str(payload.get("business_need") or "").strip(),
                "budget_range": str(payload.get("budget_range") or "").strip(),
                "decision_window": str(payload.get("decision_window") or "").strip(),
                "intake_notes": str(payload.get("intake_notes") or "").strip(),
                "waiver_text": str(payload.get("waiver_text") or "").strip() or None,
                "waiver_accepted": bool(payload.get("waiver_accepted")),
            })
            self._audit("intake_updated", session=session, org_id=int(scoped_org_id or lead.get("org_id") or db.get_default_org_id()), entity_type="intake_packet", entity_id=(packet or {}).get("id"), detail="intake packet updated")
            self._send_json({"ok": True, "intake": packet})
            return

        match_admin_invoice_create = re.fullmatch(r"/api/admin/leads/(\d+)/invoices", path)
        if match_admin_invoice_create:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(match_admin_invoice_create.group(1))
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                invoice = db.create_invoice({
                    "org_id": int(scoped_org_id or lead.get("org_id") or db.get_default_org_id()),
                    "lead_id": lead_id,
                    "appointment_id": int(payload.get("appointment_id") or 0) or None,
                    "kind": str(payload.get("kind") or "service"),
                    "description": str(payload.get("description") or "").strip(),
                    "amount_cents": int(payload.get("amount_cents") or 0),
                    "balance_cents": int(payload.get("balance_cents") or payload.get("amount_cents") or 0),
                    "currency": str(payload.get("currency") or "USD"),
                    "status": str(payload.get("status") or "sent"),
                    "due_ts": str(payload.get("due_ts") or "").strip(),
                    "notes": str(payload.get("notes") or "").strip(),
                })
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit("invoice_created", session=session, org_id=int(scoped_org_id or lead.get("org_id") or db.get_default_org_id()), entity_type="invoice", entity_id=(invoice or {}).get("id"), detail="invoice created")
            self._send_json({"ok": True, "invoice": invoice, "billing": db.get_billing_snapshot_for_lead(lead_id)})
            return

        match_payment_commitment_action = re.fullmatch(r"/api/admin/payment-commitments/(\d+)/action", path)
        if match_payment_commitment_action:
            session = self._require_auth(['manager'])
            if not session:
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            commitment_id = int(match_payment_commitment_action.group(1))
            commitment = db.get_payment_commitment(commitment_id) or {}
            if not commitment:
                self._send_json({"ok": False, "error": "Payment commitment not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(commitment.get('org_id') or 0) or None, None)
            except PermissionError:
                self._send_json({"ok": False, "error": "Forbidden"}, status=403)
                return
            try:
                result = db.apply_payment_commitment_action(commitment_id, str(payload.get('action') or ''), str(payload.get('note') or '').strip())
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            payment = result.get('payment') if isinstance(result, dict) and 'commitment' in result else None
            invoice = result.get('invoice') if isinstance(result, dict) and 'commitment' in result else None
            updated = result.get('commitment') if isinstance(result, dict) and 'commitment' in result else result
            self._audit('payment_commitment_action_admin', session=session, org_id=scoped_org_id, entity_type='payment_commitment', entity_id=commitment_id, detail=f"payment commitment {str(payload.get('action') or '').strip().lower()}", metadata={'payment_id': (payment or {}).get('id')})
            self._send_json({"ok": True, "payment_commitment": updated, "payment": payment, "invoice": invoice, "billing": db.get_billing_snapshot_for_lead(int(commitment.get('lead_id') or 0))})
            return

        match_invoice_payment = re.fullmatch(r"/api/admin/invoices/(\d+)/payments", path)
        if match_invoice_payment:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            invoice_id = int(match_invoice_payment.group(1))
            invoice = db.get_invoice(invoice_id) or {}
            if not invoice:
                self._send_json({"ok": False, "error": "Invoice not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(invoice.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                result = db.record_payment({
                    "invoice_id": invoice_id,
                    "amount_cents": int(payload.get("amount_cents") or 0),
                    "method": str(payload.get("method") or "cash"),
                    "reference": str(payload.get("reference") or ""),
                    "notes": str(payload.get("notes") or ""),
                })
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit("payment_recorded", session=session, org_id=int(scoped_org_id or invoice.get("org_id") or db.get_default_org_id()), entity_type="payment", entity_id=(result.get("payment") or {}).get("id"), detail="payment recorded")
            self._send_json({"ok": True, **result, "billing": db.get_billing_snapshot_for_lead(int(invoice.get("lead_id") or 0))})
            return

        match_invoice_lifecycle = re.fullmatch(r"/api/admin/invoices/(\d+)/lifecycle", path)
        if match_invoice_lifecycle:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            invoice_id = int(match_invoice_lifecycle.group(1))
            invoice = db.get_invoice(invoice_id) or {}
            if not invoice:
                self._send_json({"ok": False, "error": "Invoice not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(invoice.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                updated = db.apply_invoice_action(invoice_id, str(payload.get('action') or ''), str(payload.get('note') or ''))
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('invoice_lifecycle_updated', session=session, org_id=int(scoped_org_id or invoice.get('org_id') or db.get_default_org_id()), entity_type='invoice', entity_id=invoice_id, detail=str(payload.get('action') or ''))
            self._send_json({"ok": True, "invoice": updated, "billing": db.get_billing_snapshot_for_lead(int(invoice.get('lead_id') or 0))})
            return

        match_invoice_credit = re.fullmatch(r"/api/admin/invoices/(\d+)/credit", path)
        if match_invoice_credit:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            invoice_id = int(match_invoice_credit.group(1))
            invoice = db.get_invoice(invoice_id) or {}
            if not invoice:
                self._send_json({"ok": False, "error": "Invoice not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(invoice.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                result = db.create_credit_memo(invoice_id, int(payload.get('amount_cents') or 0), str(payload.get('note') or ''))
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('credit_memo_created', session=session, org_id=int(scoped_org_id or invoice.get('org_id') or db.get_default_org_id()), entity_type='invoice', entity_id=invoice_id, detail='credit memo created', metadata={'credit_invoice_id': (result.get('credit_invoice') or {}).get('id')})
            self._send_json({"ok": True, **result, "billing": db.get_billing_snapshot_for_lead(int(invoice.get('lead_id') or 0))})
            return

        match_admin_lead_documents_post = re.fullmatch(r"/api/admin/leads/(\d+)/documents", path)
        if match_admin_lead_documents_post:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(match_admin_lead_documents_post.group(1))
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                document = db.create_portal_document({
                    'org_id': int(scoped_org_id or lead.get('org_id') or db.get_default_org_id()),
                    'lead_id': lead_id,
                    'appointment_id': int(payload.get('appointment_id') or 0) or None,
                    'title': str(payload.get('title') or '').strip(),
                    'body': str(payload.get('body') or '').strip(),
                    'kind': str(payload.get('kind') or 'document').strip(),
                    'required': bool(payload.get('required')),
                    'status': str(payload.get('status') or 'pending').strip(),
                })
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('portal_document_created', session=session, org_id=int(scoped_org_id or lead.get('org_id') or db.get_default_org_id()), entity_type='portal_document', entity_id=(document or {}).get('id'), detail='portal document created')
            self._send_json({"ok": True, "document": document, "documents": db.list_portal_documents_for_lead(lead_id)})
            return

        match_admin_lead_artifacts_post = re.fullmatch(r"/api/admin/leads/(\d+)/artifacts", path)
        if match_admin_lead_artifacts_post:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            lead_id = int(match_admin_lead_artifacts_post.group(1))
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                target_org_id = self._resolve_scoped_org(session, int(lead.get("org_id") or 0))
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            filename = str(payload.get('filename') or '').strip()
            content_b64 = str(payload.get('content_b64') or '').strip()
            if not filename or not content_b64:
                self._send_json({"ok": False, "error": "File content and filename are required."}, status=400)
                return
            try:
                size_bytes = len(base64.b64decode(content_b64.encode('utf-8'), validate=True))
            except Exception:
                self._send_json({"ok": False, "error": "Invalid file encoding."}, status=400)
                return
            if size_bytes > 3 * 1024 * 1024:
                self._send_json({"ok": False, "error": "File exceeds the 3 MB vault limit."}, status=400)
                return
            artifact = db.create_artifact({
                'org_id': target_org_id,
                'lead_id': lead_id,
                'appointment_id': int(payload.get('appointment_id') or 0) or None,
                'quote_id': int(payload.get('quote_id') or 0) or None,
                'document_id': int(payload.get('document_id') or 0) or None,
                'category': str(payload.get('category') or 'operator_upload').strip() or 'operator_upload',
                'uploader_scope': 'admin',
                'visible_to_client': bool(payload.get('visible_to_client', True)),
                'filename': filename,
                'mime_type': str(payload.get('mime_type') or 'application/octet-stream').strip() or 'application/octet-stream',
                'size_bytes': size_bytes,
                'content_b64': content_b64,
                'notes': str(payload.get('notes') or '').strip(),
            })
            artifacts = db.list_artifacts_for_lead(lead_id)
            self._audit('artifact_uploaded_admin', session=session, org_id=target_org_id, entity_type='proof_artifact', entity_id=(artifact or {}).get('id'), detail='proof artifact uploaded', metadata={'filename': filename, 'size_bytes': size_bytes})
            self._send_json({"ok": True, "artifact": artifact, "artifacts": artifacts})
            return

        match_admin_artifact_update = re.fullmatch(r"/api/admin/artifacts/(\d+)/update", path)
        if match_admin_artifact_update:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            artifact_id = int(match_admin_artifact_update.group(1))
            artifact = db.get_artifact(artifact_id) or {}
            if not artifact or str(artifact.get('status') or '') == 'deleted':
                self._send_json({"ok": False, "error": "Artifact not found."}, status=404)
                return
            try:
                target_org_id = self._resolve_scoped_org(session, int(artifact.get("org_id") or 0))
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            updated = db.update_artifact(artifact_id, {
                'visible_to_client': payload.get('visible_to_client') if payload.get('visible_to_client') is not None else bool(artifact.get('visible_to_client')),
                'category': str(payload.get('category') or artifact.get('category') or '').strip() or artifact.get('category') or 'evidence',
                'notes': str(payload.get('notes') if payload.get('notes') is not None else artifact.get('notes') or '').strip(),
            }) or artifact
            artifacts = db.list_artifacts_for_lead(int(updated.get('lead_id') or 0))
            self._audit('artifact_updated_admin', session=session, org_id=target_org_id, entity_type='proof_artifact', entity_id=artifact_id, detail='proof artifact updated', metadata={'visible_to_client': int(updated.get('visible_to_client') or 0), 'category': updated.get('category')})
            self._send_json({"ok": True, "artifact": updated, "artifacts": artifacts})
            return

        match_admin_artifact_replace = re.fullmatch(r"/api/admin/artifacts/(\d+)/replace", path)
        if match_admin_artifact_replace:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            artifact_id = int(match_admin_artifact_replace.group(1))
            artifact = db.get_artifact(artifact_id) or {}
            if not artifact or str(artifact.get('status') or '') == 'deleted':
                self._send_json({"ok": False, "error": "Artifact not found."}, status=404)
                return
            try:
                target_org_id = self._resolve_scoped_org(session, int(artifact.get("org_id") or 0))
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            filename = str(payload.get('filename') or '').strip()
            content_b64 = str(payload.get('content_b64') or '').strip()
            if not filename or not content_b64:
                self._send_json({"ok": False, "error": "Replacement file content and filename are required."}, status=400)
                return
            try:
                size_bytes = len(base64.b64decode(content_b64.encode('utf-8'), validate=True))
            except Exception:
                self._send_json({"ok": False, "error": "Invalid file encoding."}, status=400)
                return
            if size_bytes > 3 * 1024 * 1024:
                self._send_json({"ok": False, "error": "File exceeds the 3 MB vault limit."}, status=400)
                return
            try:
                result = db.replace_artifact(artifact_id, {
                    'filename': filename,
                    'mime_type': str(payload.get('mime_type') or artifact.get('mime_type') or 'application/octet-stream').strip() or 'application/octet-stream',
                    'content_b64': content_b64,
                    'size_bytes': size_bytes,
                    'category': str(payload.get('category') or artifact.get('category') or 'evidence').strip() or 'evidence',
                    'visible_to_client': payload.get('visible_to_client') if payload.get('visible_to_client') is not None else bool(artifact.get('visible_to_client')),
                    'notes': str(payload.get('notes') if payload.get('notes') is not None else artifact.get('notes') or '').strip(),
                    'uploader_scope': 'admin',
                })
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            artifacts = db.list_artifacts_for_lead(int(artifact.get('lead_id') or 0))
            self._audit('artifact_replaced_admin', session=session, org_id=target_org_id, entity_type='proof_artifact', entity_id=(result.get('artifact') or {}).get('id'), detail='proof artifact replaced', metadata={'replaced_artifact_id': artifact_id, 'filename': filename, 'size_bytes': size_bytes})
            self._send_json({"ok": True, **result, "artifacts": artifacts})
            return

        match_admin_artifact_delete = re.fullmatch(r"/api/admin/artifacts/(\d+)/delete", path)
        if match_admin_artifact_delete:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            artifact_id = int(match_admin_artifact_delete.group(1))
            artifact = db.get_artifact(artifact_id) or {}
            if not artifact or str(artifact.get('status') or '') == 'deleted':
                self._send_json({"ok": False, "error": "Artifact not found."}, status=404)
                return
            try:
                target_org_id = self._resolve_scoped_org(session, int(artifact.get("org_id") or 0))
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            deleted = db.delete_artifact(artifact_id) or artifact
            artifacts = db.list_artifacts_for_lead(int(artifact.get('lead_id') or 0))
            self._audit('artifact_deleted_admin', session=session, org_id=target_org_id, entity_type='proof_artifact', entity_id=artifact_id, detail='proof artifact deleted')
            self._send_json({"ok": True, "artifact": deleted, "artifacts": artifacts})
            return

        match_admin_document_update = re.fullmatch(r"/api/admin/documents/(\d+)", path)
        if match_admin_document_update:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            document_id = int(match_admin_document_update.group(1))
            document = db.get_row('SELECT * FROM portal_documents WHERE id = ?', (document_id,)) or {}
            if not document:
                self._send_json({"ok": False, "error": "Document not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(document.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            updated = db.update_portal_document(document_id, {
                'title': payload.get('title'),
                'body': payload.get('body'),
                'kind': payload.get('kind'),
                'required': payload.get('required'),
                'status': payload.get('status'),
            })
            self._audit('portal_document_updated', session=session, org_id=int(scoped_org_id or document.get('org_id') or db.get_default_org_id()), entity_type='portal_document', entity_id=document_id, detail='portal document updated')
            self._send_json({"ok": True, "document": updated, "documents": db.list_portal_documents_for_lead(int(document.get('lead_id') or 0))})
            return
        match_admin_service_update = re.fullmatch(r"/api/admin/services/(\d+)", path)
        if match_admin_service_update:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            if not role_allows(session.get("role"), "admin"):
                self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            service_id = int(match_admin_service_update.group(1))
            service = db.get_service(service_id) or {}
            if not service:
                self._send_json({"ok": False, "error": "Service not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(service.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            updated = db.update_service(service_id, {
                'slug': str(payload.get('slug') or service.get('slug') or '').strip(),
                'name': str(payload.get('name') or service.get('name') or '').strip(),
                'description': str(payload.get('description') or service.get('description') or '').strip(),
                'base_price_cents': int(payload.get('base_price_cents') if payload.get('base_price_cents') is not None else service.get('base_price_cents') or 0),
                'deposit_cents': int(payload.get('deposit_cents') if payload.get('deposit_cents') is not None else service.get('deposit_cents') or 0),
                'duration_minutes': int(payload.get('duration_minutes') if payload.get('duration_minutes') is not None else service.get('duration_minutes') or 30),
                'active': bool(payload.get('active', bool(service.get('active', True)))),
                'metadata': {
                    'keywords': payload.get('keywords') if payload.get('keywords') is not None else ((service.get('metadata') or {}).get('keywords') or []),
                    'questions': payload.get('questions') if payload.get('questions') is not None else ((service.get('metadata') or {}).get('questions') or []),
                },
            }) or service
            self._audit('service_updated', session=session, org_id=int(scoped_org_id or updated.get('org_id') or db.get_default_org_id()), entity_type='service', entity_id=service_id, detail='service updated')
            self._send_json({"ok": True, "service": updated, "services": db.list_services(int(scoped_org_id or updated.get('org_id') or db.get_default_org_id()))})
            return

        match_admin_package_update = re.fullmatch(r"/api/admin/packages/(\d+)", path)
        if match_admin_package_update:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            if not role_allows(session.get("role"), "admin"):
                self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            package_id = int(match_admin_package_update.group(1))
            package = db.get_package(package_id) or {}
            if not package:
                self._send_json({"ok": False, "error": "Package not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(package.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            updated = db.update_package(package_id, {
                'slug': str(payload.get('slug') or package.get('slug') or '').strip(),
                'name': str(payload.get('name') or package.get('name') or '').strip(),
                'description': str(payload.get('description') or package.get('description') or '').strip(),
                'total_price_cents': int(payload.get('total_price_cents') if payload.get('total_price_cents') is not None else package.get('total_price_cents') or 0),
                'deposit_cents': int(payload.get('deposit_cents') if payload.get('deposit_cents') is not None else package.get('deposit_cents') or 0),
                'active': bool(payload.get('active', bool(package.get('active', True)))),
                'metadata': {
                    'included_service_slugs': payload.get('included_service_slugs') if payload.get('included_service_slugs') is not None else ((package.get('metadata') or {}).get('included_service_slugs') or []),
                },
            }) or package
            self._audit('package_updated', session=session, org_id=int(scoped_org_id or updated.get('org_id') or db.get_default_org_id()), entity_type='package', entity_id=package_id, detail='package updated')
            self._send_json({"ok": True, "package": updated, "packages": db.list_packages(int(scoped_org_id or updated.get('org_id') or db.get_default_org_id()))})
            return

        match_admin_quote_update = re.fullmatch(r"/api/admin/quotes/(\d+)", path)
        if match_admin_quote_update:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            quote_id = int(match_admin_quote_update.group(1))
            quote = db.get_quote(quote_id) or {}
            if not quote:
                self._send_json({"ok": False, "error": "Quote not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(quote.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            updated = db.update_quote(quote_id, {
                'appointment_id': int(payload.get('appointment_id') or 0) or (int(quote.get('appointment_id') or 0) or None),
                'service_id': int(payload.get('service_id') or 0) or (int(quote.get('service_id') or 0) or None),
                'package_id': int(payload.get('package_id') or 0) or (int(quote.get('package_id') or 0) or None),
                'title': str(payload.get('title') or quote.get('title') or '').strip(),
                'summary': str(payload.get('summary') or quote.get('summary') or '').strip(),
                'amount_cents': int(payload.get('amount_cents') if payload.get('amount_cents') is not None else quote.get('amount_cents') or 0),
                'deposit_cents': int(payload.get('deposit_cents') if payload.get('deposit_cents') is not None else quote.get('deposit_cents') or 0),
                'currency': str(payload.get('currency') or quote.get('currency') or 'USD').strip() or 'USD',
                'status': str(payload.get('status') or quote.get('status') or 'draft').strip() or 'draft',
                'expires_at': str(payload.get('expires_at') if payload.get('expires_at') is not None else quote.get('expires_at') or '').strip(),
                'terms_text': str(payload.get('terms_text') if payload.get('terms_text') is not None else quote.get('terms_text') or '').strip(),
                'metadata': {'line_items': payload.get('line_items') if payload.get('line_items') is not None else ((quote.get('metadata') or {}).get('line_items') or [])},
            }) or quote
            db.refresh_lead_memory(int(updated.get('lead_id') or 0))
            self._audit('quote_updated', session=session, org_id=int(scoped_org_id or updated.get('org_id') or db.get_default_org_id()), entity_type='quote', entity_id=quote_id, detail='quote updated')
            self._send_json({"ok": True, "quote": updated, "quotes": db.list_quotes(int(scoped_org_id or updated.get('org_id') or db.get_default_org_id()), int(updated.get('lead_id') or 0))})
            return

        match_admin_quote_action = re.fullmatch(r"/api/admin/quotes/(\d+)/action", path)
        if match_admin_quote_action:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            quote_id = int(match_admin_quote_action.group(1))
            quote = db.get_quote(quote_id) or {}
            if not quote:
                self._send_json({"ok": False, "error": "Quote not found."}, status=404)
                return
            lead = db.get_lead(int(quote.get('lead_id') or 0)) or {}
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(quote.get('org_id') or lead.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            action = str(payload.get('action') or '').strip().lower()
            updated_quote = quote
            outbound = None
            if action in {'mark_sent', 'send'}:
                updated_quote = db.update_quote(quote_id, {'status': 'sent'}) or quote
                should_notify = bool(payload.get('notify_lead', True))
                if should_notify and lead:
                    appointment = None
                    if int(updated_quote.get('appointment_id') or 0):
                        appointment = db.get_appointment(int(updated_quote.get('appointment_id') or 0))
                    if not appointment:
                        appts = db.list_appointments_for_lead(int(lead.get('id') or 0))
                        appointment = next((item for item in appts if str(item.get('status') or '') in {'booked', 'confirmed'}), appts[0] if appts else None)
                    manage_url = appointment_manage_url(appointment or {}) if appointment else ''
                    body = '\n\n'.join(part for part in [
                        f"Quote: {updated_quote.get('title') or 'Service quote'}",
                        str(updated_quote.get('summary') or '').strip(),
                        f"Total: {int(updated_quote.get('amount_cents') or 0)/100:.2f} {updated_quote.get('currency') or 'USD'}",
                        f"Deposit: {int(updated_quote.get('deposit_cents') or 0)/100:.2f} {updated_quote.get('currency') or 'USD'}",
                        str(updated_quote.get('terms_text') or '').strip(),
                        f"Manage / accept here: {manage_url}" if manage_url else '',
                    ] if part)
                    recipient = str(payload.get('recipient') or (lead.get('email') or lead.get('phone') or '')).strip()
                    channel = str(payload.get('channel') or ('email' if lead.get('email') else 'sms')).strip() or 'email'
                    transport = ''
                    if recipient:
                        if channel == 'email':
                            if os.getenv('SMTP_HOST', '').strip():
                                transport = 'smtp-direct'
                            elif os.getenv('EMAIL_WEBHOOK_URL', '').strip():
                                transport = 'email-webhook'
                        else:
                            if os.getenv('SMS_WEBHOOK_URL', '').strip():
                                transport = 'sms-webhook'
                    outbound = db.enqueue_outbound_message(
                        int(updated_quote.get('org_id') or db.get_default_org_id()),
                        int(lead.get('id') or 0),
                        int((appointment or {}).get('id') or 0) or None,
                        channel,
                        recipient,
                        body,
                        subject=str(payload.get('subject') or f"Quote ready: {updated_quote.get('title') or 'Service quote'}").strip(),
                        transport=transport or 'unconfigured',
                        metadata={'source': 'quote_notice', 'quote_id': quote_id},
                    ) if recipient else None
                    if outbound and bool(payload.get('send_now')) and outbound.get('id'):
                        dispatched = dispatch_outbound(int(updated_quote.get('org_id') or db.get_default_org_id()), [int(outbound.get('id') or 0)])
                        outbound = dispatched[0] if dispatched else outbound
            elif action in {'expire', 'mark_expired'}:
                updated_quote = db.update_quote(quote_id, {'status': 'expired', 'expires_at': str(payload.get('expires_at') or db.utcnow_iso()).strip()}) or quote
            elif action in {'withdraw', 'void'}:
                updated_quote = db.update_quote(quote_id, {'status': 'withdrawn'}) or quote
            elif action == 'reopen':
                updated_quote = db.update_quote(quote_id, {'status': 'draft'}) or quote
            elif action == 'duplicate':
                updated_quote = db.create_quote({
                    'org_id': int(quote.get('org_id') or db.get_default_org_id()),
                    'lead_id': int(quote.get('lead_id') or 0),
                    'appointment_id': int(quote.get('appointment_id') or 0) or None,
                    'service_id': int(quote.get('service_id') or 0) or None,
                    'package_id': int(quote.get('package_id') or 0) or None,
                    'title': f"{quote.get('title') or 'Service Quote'} copy",
                    'summary': str(quote.get('summary') or ''),
                    'amount_cents': int(quote.get('amount_cents') or 0),
                    'deposit_cents': int(quote.get('deposit_cents') or 0),
                    'currency': str(quote.get('currency') or 'USD'),
                    'status': 'draft',
                    'expires_at': '',
                    'terms_text': str(quote.get('terms_text') or ''),
                    'metadata': quote.get('metadata') or {},
                }) or quote
            else:
                self._send_json({"ok": False, "error": "Unsupported quote action."}, status=400)
                return
            db.refresh_lead_memory(int((updated_quote or {}).get('lead_id') or 0))
            self._audit('quote_action', session=session, org_id=int(scoped_org_id or (updated_quote or {}).get('org_id') or db.get_default_org_id()), entity_type='quote', entity_id=(updated_quote or {}).get('id') or quote_id, detail=f'quote action {action}', metadata={'outbound_message_id': (outbound or {}).get('id')})
            self._send_json({"ok": True, "quote": updated_quote, "quotes": db.list_quotes(int(scoped_org_id or (updated_quote or {}).get('org_id') or db.get_default_org_id()), int(lead.get('id') or 0)), "message": outbound})
            return


        match_admin_artifact_restore = re.fullmatch(r"/api/admin/artifacts/(\d+)/restore", path)
        if match_admin_artifact_restore:
            session = self._require_auth('manager')
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            artifact_id = int(match_admin_artifact_restore.group(1))
            artifact = db.get_artifact(artifact_id) or {}
            if not artifact:
                self._send_json({"ok": False, "error": "Artifact not found."}, status=404)
                return
            try:
                target_org_id = self._resolve_scoped_org(session, int(artifact.get("org_id") or 0))
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                restored = db.restore_artifact(artifact_id) or artifact
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            artifacts = db.list_artifacts_for_lead(int(artifact.get('lead_id') or 0), include_deleted=bool(payload.get('include_deleted')))
            self._audit('artifact_restored_admin', session=session, org_id=target_org_id, entity_type='proof_artifact', entity_id=artifact_id, detail='proof artifact restored')
            self._send_json({"ok": True, "artifact": restored, "artifacts": artifacts})
            return

        if path == "/api/admin/artifacts/batch":
            session = self._require_auth('manager')
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            action = str(payload.get('action') or '').strip()
            artifact_ids = [int(item or 0) for item in list(payload.get('artifact_ids') or []) if int(item or 0)]
            if not artifact_ids:
                self._send_json({"ok": False, "error": "Pick at least one artifact."}, status=400)
                return
            lead_ids: set[int] = set()
            errors: list[dict[str, object]] = []
            allowed_ids: list[int] = []
            for artifact_id in artifact_ids:
                artifact = db.get_artifact(artifact_id) or {}
                if not artifact:
                    errors.append({'id': artifact_id, 'error': 'Artifact not found.'})
                    continue
                try:
                    self._resolve_scoped_org(session, int(artifact.get('org_id') or 0))
                except PermissionError as exc:
                    errors.append({'id': artifact_id, 'error': str(exc)})
                    continue
                allowed_ids.append(artifact_id)
                lead_ids.add(int(artifact.get('lead_id') or 0))
            result = db.batch_update_artifacts(allowed_ids, action) if allowed_ids else {'updated': [], 'errors': []}
            all_errors = errors + list(result.get('errors') or [])
            lead_id = int(payload.get('lead_id') or 0) or (next(iter(lead_ids)) if len(lead_ids) == 1 else 0)
            artifacts = db.list_artifacts_for_lead(lead_id, include_deleted=bool(payload.get('include_deleted'))) if lead_id else []
            self._audit('artifact_batch_action_admin', session=session, org_id=int((db.get_artifact(allowed_ids[0]) or {}).get('org_id') or db.get_default_org_id()) if allowed_ids else db.get_default_org_id(), entity_type='proof_artifact', entity_id='batch', detail=f'proof artifact batch action {action}', metadata={'artifact_ids': allowed_ids, 'updated_count': len(result.get('updated') or []), 'error_count': len(all_errors)})
            self._send_json({"ok": True, "action": action, "updated": result.get('updated') or [], "errors": all_errors, "artifacts": artifacts})
            return

        match_admin_lead_payment_plans = re.fullmatch(r"/api/admin/leads/(\d+)/payment-plans", path)
        if match_admin_lead_payment_plans:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(match_admin_lead_payment_plans.group(1))
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                plan = db.create_payment_plan({
                    'org_id': int(scoped_org_id or lead.get('org_id') or db.get_default_org_id()),
                    'lead_id': lead_id,
                    'appointment_id': int(payload.get('appointment_id') or 0) or None,
                    'quote_id': int(payload.get('quote_id') or 0) or None,
                    'title': str(payload.get('title') or 'Installment plan').strip() or 'Installment plan',
                    'total_cents': int(payload.get('total_cents') or 0),
                    'deposit_cents': int(payload.get('deposit_cents') or 0),
                    'currency': str(payload.get('currency') or ((db.get_org(int(lead.get('org_id') or db.get_default_org_id())) or {}).get('currency') or 'USD')).strip() or 'USD',
                    'installment_count': int(payload.get('installment_count') or 1),
                    'interval_days': int(payload.get('interval_days') or 30),
                    'first_due_ts': str(payload.get('first_due_ts') or '').strip(),
                    'notes': str(payload.get('notes') or '').strip(),
                    'metadata': {'created_from': 'admin_billing_desk'},
                })
                generation = db.generate_invoices_for_payment_plan(int(plan.get('id') or 0), str(payload.get('invoice_status') or 'sent'))
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('payment_plan_created', session=session, org_id=int(scoped_org_id or plan.get('org_id') or db.get_default_org_id()), entity_type='payment_plan', entity_id=plan.get('id'), detail='payment plan created', metadata={'invoice_count': generation.get('created_count')})
            self._send_json({"ok": True, "plan": generation.get('plan') or plan, "created_invoices": generation.get('invoices') or [], "billing": db.get_billing_snapshot_for_lead(lead_id)})
            return

        match_admin_payment_plan_generate = re.fullmatch(r"/api/admin/payment-plans/(\d+)/generate", path)
        if match_admin_payment_plan_generate:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            plan_id = int(match_admin_payment_plan_generate.group(1))
            plan = db.get_payment_plan(plan_id) or {}
            if not plan:
                self._send_json({"ok": False, "error": "Payment plan not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(plan.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                generation = db.generate_invoices_for_payment_plan(plan_id, str(payload.get('invoice_status') or 'sent'))
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('payment_plan_generated', session=session, org_id=int(scoped_org_id or plan.get('org_id') or db.get_default_org_id()), entity_type='payment_plan', entity_id=plan_id, detail='payment plan invoices generated', metadata={'invoice_count': generation.get('created_count')})
            self._send_json({"ok": True, "plan": generation.get('plan') or plan, "created_invoices": generation.get('invoices') or [], "billing": db.get_billing_snapshot_for_lead(int(plan.get('lead_id') or 0))})
            return

        match_admin_payment_plan_cancel = re.fullmatch(r"/api/admin/payment-plans/(\d+)/cancel", path)
        if match_admin_payment_plan_cancel:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            plan_id = int(match_admin_payment_plan_cancel.group(1))
            plan = db.get_payment_plan(plan_id) or {}
            if not plan:
                self._send_json({"ok": False, "error": "Payment plan not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(plan.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                updated = db.cancel_payment_plan(plan_id, str(payload.get('note') or '').strip())
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('payment_plan_cancelled', session=session, org_id=int(scoped_org_id or plan.get('org_id') or db.get_default_org_id()), entity_type='payment_plan', entity_id=plan_id, detail='payment plan cancelled')
            self._send_json({"ok": True, "plan": updated, "billing": db.get_billing_snapshot_for_lead(int(plan.get('lead_id') or 0))})
            return

        match_admin_lead_memberships = re.fullmatch(r"/api/admin/leads/(\d+)/memberships", path)
        if match_admin_lead_memberships:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(match_admin_lead_memberships.group(1))
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            try:
                membership = db.create_recurring_membership({
                    'org_id': int(scoped_org_id or lead.get('org_id') or db.get_default_org_id()),
                    'lead_id': lead_id,
                    'appointment_id': int(payload.get('appointment_id') or 0) or None,
                    'quote_id': int(payload.get('quote_id') or 0) or None,
                    'service_id': int(payload.get('service_id') or 0) or None,
                    'package_id': int(payload.get('package_id') or 0) or None,
                    'title': str(payload.get('title') or 'Recurring membership').strip() or 'Recurring membership',
                    'amount_cents': int(payload.get('amount_cents') or 0),
                    'currency': str(payload.get('currency') or ((db.get_org(int(lead.get('org_id') or db.get_default_org_id())) or {}).get('currency') or 'USD')).strip() or 'USD',
                    'interval_days': int(payload.get('interval_days') or 30),
                    'next_invoice_ts': str(payload.get('next_invoice_ts') or '').strip(),
                    'notes': str(payload.get('notes') or '').strip(),
                    'metadata': {'created_from': 'admin_membership_desk', 'start_mode': str(payload.get('start_mode') or 'wait')},
                })
                invoice = None
                if str(payload.get('start_mode') or '').strip() == 'generate_now':
                    immediate_due = str(payload.get('next_invoice_ts') or '').strip() or db.utcnow_iso()
                    generation = db.create_membership_invoice(int(membership.get('id') or 0), invoice_status=str(payload.get('invoice_status') or 'sent'), due_ts=immediate_due)
                    membership = generation.get('membership') or membership
                    invoice = generation.get('invoice')
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('membership_created', session=session, org_id=int(scoped_org_id or membership.get('org_id') or db.get_default_org_id()), entity_type='membership', entity_id=membership.get('id'), detail='recurring membership created', metadata={'invoice_id': (invoice or {}).get('id')})
            self._send_json({"ok": True, "membership": membership, "invoice": invoice, "billing": db.get_billing_snapshot_for_lead(lead_id)})
            return

        match_admin_membership_action = re.fullmatch(r"/api/admin/memberships/(\d+)/action", path)
        if match_admin_membership_action:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            membership_id = int(match_admin_membership_action.group(1))
            membership = db.get_recurring_membership(membership_id) or {}
            if not membership:
                self._send_json({"ok": False, "error": "Membership not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(membership.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            action = str(payload.get('action') or '').strip().lower()
            invoice = None
            try:
                if action == 'pause':
                    updated = db.pause_membership(membership_id, str(payload.get('note') or '').strip())
                elif action == 'resume':
                    updated = db.resume_membership(membership_id, str(payload.get('next_invoice_ts') or '').strip())
                elif action == 'cancel':
                    updated = db.cancel_membership(membership_id, str(payload.get('note') or '').strip())
                elif action == 'generate_now':
                    generation = db.create_membership_invoice(membership_id, invoice_status=str(payload.get('invoice_status') or 'sent'), due_ts=str(payload.get('due_ts') or '').strip() or db.utcnow_iso())
                    updated = generation.get('membership') or membership
                    invoice = generation.get('invoice')
                elif action == 'skip_cycle':
                    updated = db.advance_membership_cycle(membership_id)
                else:
                    self._send_json({"ok": False, "error": "Unsupported membership action."}, status=400)
                    return
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._audit('membership_action', session=session, org_id=int(scoped_org_id or membership.get('org_id') or db.get_default_org_id()), entity_type='membership', entity_id=membership_id, detail=f'membership action {action}', metadata={'invoice_id': (invoice or {}).get('id')})
            self._send_json({"ok": True, "membership": updated, "invoice": invoice, "billing": db.get_billing_snapshot_for_lead(int(membership.get('lead_id') or 0))})
            return

        if path == "/api/admin/memberships/run":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            scoped_org_id = int(self._resolve_scoped_org(session, None, None) or db.get_default_org_id())
            generated = db.run_due_membership_invoices(scoped_org_id)
            self._audit('membership_due_run', session=session, org_id=scoped_org_id, entity_type='membership', entity_id='manual', detail='manual recurring membership billing run', metadata={'generated_count': len(generated)})
            self._send_json({"ok": True, "generated": generated})
            return
        if path == "/api/admin/services":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            if not role_allows(session.get("role"), "admin"):
                self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, payload.get('org_id'), payload.get('org_slug'))
                service = db.create_service({
                    'org_id': int(scoped_org_id or db.get_default_org_id()),
                    'slug': str(payload.get('slug') or '').strip(),
                    'name': str(payload.get('name') or '').strip(),
                    'description': str(payload.get('description') or '').strip(),
                    'base_price_cents': int(payload.get('base_price_cents') or 0),
                    'deposit_cents': int(payload.get('deposit_cents') or 0),
                    'duration_minutes': int(payload.get('duration_minutes') or 30),
                    'active': bool(payload.get('active', True)),
                    'metadata': {'keywords': payload.get('keywords') or [], 'questions': payload.get('questions') or []},
                })
            except (PermissionError, ValueError) as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400 if isinstance(exc, ValueError) else 403)
                return
            self._audit('service_created', session=session, org_id=int(service.get('org_id') or db.get_default_org_id()), entity_type='service', entity_id=service.get('id'), detail='service created')
            self._send_json({"ok": True, "service": service, "services": db.list_services(int(service.get('org_id') or db.get_default_org_id()))})
            return

        if path == "/api/admin/packages":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            if not role_allows(session.get("role"), "admin"):
                self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, payload.get('org_id'), payload.get('org_slug'))
                package = db.create_package({
                    'org_id': int(scoped_org_id or db.get_default_org_id()),
                    'slug': str(payload.get('slug') or '').strip(),
                    'name': str(payload.get('name') or '').strip(),
                    'description': str(payload.get('description') or '').strip(),
                    'total_price_cents': int(payload.get('total_price_cents') or 0),
                    'deposit_cents': int(payload.get('deposit_cents') or 0),
                    'active': bool(payload.get('active', True)),
                    'metadata': {'included_service_slugs': payload.get('included_service_slugs') or []},
                })
            except (PermissionError, ValueError) as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=400 if isinstance(exc, ValueError) else 403)
                return
            self._audit('package_created', session=session, org_id=int(package.get('org_id') or db.get_default_org_id()), entity_type='package', entity_id=package.get('id'), detail='package created')
            self._send_json({"ok": True, "package": package, "packages": db.list_packages(int(package.get('org_id') or db.get_default_org_id()))})
            return

        if path == "/api/admin/quotes":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(payload.get('lead_id') or 0)
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            service = db.get_service(int(payload.get('service_id') or 0)) if int(payload.get('service_id') or 0) else None
            package = db.get_package(int(payload.get('package_id') or 0)) if int(payload.get('package_id') or 0) else None
            amount_cents = int(payload.get('amount_cents') or (package.get('total_price_cents') if package else (service.get('base_price_cents') if service else 0)) or 0)
            deposit_cents = int(payload.get('deposit_cents') or (package.get('deposit_cents') if package else (service.get('deposit_cents') if service else 0)) or 0)
            quote = db.create_quote({
                'org_id': int(scoped_org_id or lead.get('org_id') or db.get_default_org_id()),
                'lead_id': lead_id,
                'appointment_id': int(payload.get('appointment_id') or 0) or None,
                'service_id': int(payload.get('service_id') or 0) or None,
                'package_id': int(payload.get('package_id') or 0) or None,
                'title': str(payload.get('title') or (package.get('name') if package else (service.get('name') if service else 'Service Quote'))),
                'summary': str(payload.get('summary') or '').strip(),
                'amount_cents': amount_cents,
                'deposit_cents': deposit_cents,
                'currency': str(payload.get('currency') or (db.get_org(int(lead.get('org_id') or db.get_default_org_id())) or {}).get('currency') or 'USD'),
                'status': str(payload.get('status') or 'sent'),
                'expires_at': str(payload.get('expires_at') or '').strip(),
                'terms_text': str(payload.get('terms_text') or 'By accepting this quote, you approve the scope and any listed deposit requirement.').strip(),
                'metadata': {'line_items': payload.get('line_items') or []},
            })
            db.refresh_lead_memory(lead_id)
            self._audit('quote_created', session=session, org_id=int(quote.get('org_id') or db.get_default_org_id()), entity_type='quote', entity_id=quote.get('id'), detail='quote created')
            self._send_json({"ok": True, "quote": quote, "quotes": db.list_quotes(int(quote.get('org_id') or db.get_default_org_id()), lead_id)})
            return

        if path == "/api/admin/lead-views":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, payload.get("org_id"), None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            name = str(payload.get("name") or '').strip()
            if not name:
                self._send_json({"ok": False, "error": "name is required"}, status=400)
                return
            view = db.create_lead_view({
                "org_id": int(scoped_org_id or db.get_default_org_id()),
                "name": name,
                "filters": payload.get("filters") or {},
                "is_shared": bool(payload.get("is_shared", True)),
                "created_by_user_id": int(session.get("user_id") or 0) or None,
            }) or {}
            self._audit("lead_view_created", session=session, org_id=int(view.get("org_id") or db.get_default_org_id()), entity_type="lead_view", entity_id=view.get("id") or '', detail="lead view created")
            self._send_json({"ok": True, "view": view, "views": db.list_lead_views(int(view.get("org_id") or db.get_default_org_id()), int(session.get("user_id") or 0) or None)})
            return

        match_lead_view_delete = re.fullmatch(r"/api/admin/lead-views/(\d+)/delete", path)
        if match_lead_view_delete:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            view_id = int(match_lead_view_delete.group(1))
            view = db.get_lead_view(view_id) or {}
            if not view:
                self._send_json({"ok": False, "error": "View not found."}, status=404)
                return
            try:
                self._resolve_scoped_org(session, int(view.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            db.delete_lead_view(view_id)
            self._audit("lead_view_deleted", session=session, org_id=int(view.get("org_id") or db.get_default_org_id()), entity_type="lead_view", entity_id=view_id, detail="lead view deleted")
            self._send_json({"ok": True})
            return

        if path == "/api/admin/playbooks":
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, payload.get("org_id"), None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            name = str(payload.get("name") or '').strip()
            body_template = str(payload.get("body_template") or '').strip()
            channel = str(payload.get("channel") or 'email').strip().lower()
            if not name or not body_template:
                self._send_json({"ok": False, "error": "name and body_template are required"}, status=400)
                return
            if channel not in {"email", "sms"}:
                self._send_json({"ok": False, "error": "channel must be email or sms"}, status=400)
                return
            playbook = db.create_playbook({
                "org_id": int(scoped_org_id or db.get_default_org_id()),
                "name": name,
                "channel": channel,
                "subject_template": str(payload.get("subject_template") or '').strip(),
                "body_template": body_template,
                "tags": payload.get("tags") or [],
                "active": bool(payload.get("active", True)),
                "created_by_user_id": int(session.get("user_id") or 0) or None,
            }) or {}
            self._audit("playbook_created", session=session, org_id=int(playbook.get("org_id") or db.get_default_org_id()), entity_type="playbook", entity_id=playbook.get("id") or '', detail="playbook created")
            self._send_json({"ok": True, "playbook": playbook, "playbooks": db.list_playbooks(int(playbook.get("org_id") or db.get_default_org_id()), int(session.get("user_id") or 0) or None)})
            return

        match_playbook_delete = re.fullmatch(r"/api/admin/playbooks/(\d+)/delete", path)
        if match_playbook_delete:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            playbook_id = int(match_playbook_delete.group(1))
            playbook = db.get_playbook(playbook_id) or {}
            if not playbook:
                self._send_json({"ok": False, "error": "Playbook not found."}, status=404)
                return
            try:
                self._resolve_scoped_org(session, int(playbook.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            db.delete_playbook(playbook_id)
            self._audit("playbook_deleted", session=session, org_id=int(playbook.get("org_id") or db.get_default_org_id()), entity_type="playbook", entity_id=playbook_id, detail="playbook deleted")
            self._send_json({"ok": True})
            return

        match_playbook_queue = re.fullmatch(r"/api/admin/playbooks/(\d+)/queue", path)
        if match_playbook_queue:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            playbook_id = int(match_playbook_queue.group(1))
            playbook = db.get_playbook(playbook_id) or {}
            if not playbook:
                self._send_json({"ok": False, "error": "Playbook not found."}, status=404)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            lead_id = int(payload.get("lead_id") or 0)
            if not lead_id:
                self._send_json({"ok": False, "error": "lead_id is required"}, status=400)
                return
            lead = db.get_lead(lead_id) or {}
            if not lead:
                self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(lead.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            if int(playbook.get("org_id") or scoped_org_id or db.get_default_org_id()) not in {0, int(scoped_org_id or db.get_default_org_id())}:
                self._send_json({"ok": False, "error": "Playbook is outside your org scope."}, status=403)
                return
            channel = str(payload.get("channel") or playbook.get("channel") or 'email').strip().lower()
            if channel not in {"email", "sms"}:
                self._send_json({"ok": False, "error": "channel must be email or sms"}, status=400)
                return
            send_now = bool(payload.get("send_now"))
            appointment = db.get_appointment(int(payload.get("appointment_id") or 0)) if int(payload.get("appointment_id") or 0) else db.get_next_active_appointment_for_lead(lead_id)
            recipient = str(payload.get("recipient") or '').strip() or str(lead.get("email") if channel == 'email' else lead.get("phone") or '').strip()
            if not recipient:
                self._send_json({"ok": False, "error": f"Lead is missing a {channel} recipient."}, status=400)
                return
            transport = ''
            if channel == 'email':
                if os.getenv('SMTP_HOST', '').strip():
                    transport = 'smtp-direct'
                elif os.getenv('EMAIL_WEBHOOK_URL', '').strip():
                    transport = 'email-webhook'
            else:
                if os.getenv('SMS_WEBHOOK_URL', '').strip():
                    transport = 'sms-webhook'
            if not transport:
                self._send_json({"ok": False, "error": f"{channel.upper()} delivery is not configured."}, status=409)
                return
            context = build_playbook_context(lead, appointment or {})
            subject = format_playbook_template(str(payload.get("subject_template") or playbook.get("subject_template") or ''), context)
            body = format_playbook_template(str(payload.get("body_template") or playbook.get("body_template") or ''), context)
            if not body:
                self._send_json({"ok": False, "error": "Rendered playbook body was empty."}, status=400)
                return
            message = db.enqueue_outbound_message(
                int(lead.get("org_id") or scoped_org_id or db.get_default_org_id()),
                lead_id,
                int((appointment or {}).get("id") or 0) or None,
                channel,
                recipient,
                body,
                subject=subject,
                transport=transport,
                metadata={"playbook_id": playbook_id, "playbook_name": playbook.get("name") or '', "sender_role": session.get("role") or '', "sender_email": session.get("email") or ''},
            ) or {}
            dispatched = dispatch_outbound(int(lead.get("org_id") or scoped_org_id or db.get_default_org_id()), [int(message.get("id") or 0)]) if send_now and message.get("id") else []
            if dispatched:
                message = dispatched[0]
            self._audit("playbook_used", session=session, org_id=int(lead.get("org_id") or scoped_org_id or db.get_default_org_id()), entity_type="playbook", entity_id=playbook_id, detail=f"playbook {'sent' if send_now else 'queued'}", metadata={"lead_id": lead_id, "channel": channel, "message_id": message.get("id") or ''})
            self._send_json({"ok": True, "message": message, "dispatched": dispatched, "rendered": {"subject": subject, "body": body}})
            return

        match_escalation_resolve = re.fullmatch(r"/api/admin/escalations/(\d+)/resolve", path)
        if match_escalation_resolve:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            escalation_id = int(match_escalation_resolve.group(1))
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            escalation = db.get_row('SELECT * FROM escalations WHERE id = ?', (escalation_id,)) or {}
            if not escalation:
                self._send_json({"ok": False, "error": "Escalation not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(escalation.get('org_id') or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            updated = db.update_escalation(escalation_id, {'status': str(payload.get('status') or 'resolved'), 'resolved_at': db.utcnow_iso(), 'suggested_reply': str(payload.get('suggested_reply') or escalation.get('suggested_reply') or '')})
            self._audit('escalation_resolved', session=session, org_id=int(scoped_org_id or escalation.get('org_id') or db.get_default_org_id()), entity_type='escalation', entity_id=escalation_id, detail='escalation resolved')
            self._send_json({"ok": True, "escalation": updated})
            return

        match_admin_rep_update = re.fullmatch(r"/api/admin/reps/(\d+)", path)
        if match_admin_rep_update:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            if not role_allows(session.get("role"), "admin"):
                self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            rep_id = int(match_admin_rep_update.group(1))
            rep = db.get_rep(rep_id) or {}
            if not rep:
                self._send_json({"ok": False, "error": "Rep not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(rep.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            updated = db.update_rep(rep_id, {
                "name": str(payload.get("name") or rep.get("name") or "").strip(),
                "email": str(payload.get("email") or rep.get("email") or "").strip(),
                "phone": str(payload.get("phone") or rep.get("phone") or "").strip(),
                "role": str(payload.get("role") or rep.get("role") or "setter").strip() or "setter",
                "is_active": 1 if bool(payload.get("is_active", True)) else 0,
                "sort_order": int(payload.get("sort_order") or rep.get("sort_order") or 0),
                "commission_rate_bps": int(payload.get("commission_rate_bps") or rep.get("commission_rate_bps") or 0),
                "target_monthly_cents": int(payload.get("target_monthly_cents") or rep.get("target_monthly_cents") or 0),
                "payout_notes": str(payload.get("payout_notes") or rep.get("payout_notes") or "").strip(),
            }) or {}
            self._audit("rep_updated", session=session, org_id=int((updated or {}).get("org_id") or scoped_org_id or db.get_default_org_id()), entity_type="rep", entity_id=rep_id, detail="rep settings updated")
            self._send_json({"ok": True, "rep": updated})
            return

        if path in protected_manager_paths:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            try:
                payload = self._read_json_body()
            except json.JSONDecodeError:
                payload = {}
            try:
                scoped_org_id = self._resolve_scoped_org(session, payload.get("org_id"), payload.get("org_slug"))
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            if path == "/api/admin/orgs":
                if not role_allows(session.get("role"), "admin"):
                    self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                    return
                try:
                    created_org = db.create_org({
                        "name": str(payload.get("name") or "").strip(),
                        "slug": str(payload.get("slug") or "").strip(),
                        "support_email": str(payload.get("support_email") or "").strip(),
                        "support_phone": str(payload.get("support_phone") or "").strip(),
                        "timezone": str(payload.get("timezone") or BUSINESS_TZ).strip() or BUSINESS_TZ,
                        "autonomy_enabled": bool(payload.get("autonomy_enabled", True)),
                        "auto_followup_hours": int(payload.get("auto_followup_hours") or 24),
                        "auto_noshow_minutes": int(payload.get("auto_noshow_minutes") or 90),
                        "auto_invoice_followup_hours": int(payload.get("auto_invoice_followup_hours") or 48),
                        "auto_intake_followup_hours": int(payload.get("auto_intake_followup_hours") or 24),
                        "default_deposit_cents": int(payload.get("default_deposit_cents") or 0),
                        "default_service_price_cents": int(payload.get("default_service_price_cents") or 0),
                        "currency": str(payload.get("currency") or "USD").strip() or "USD",
                        "payment_instructions": str(payload.get("payment_instructions") or "").strip(),
                    }) or {}
                    cloned = None
                    preset_applied = None
                    clone_from_org_id = int(payload.get("clone_from_org_id") or 0)
                    if clone_from_org_id and int((created_org or {}).get("id") or 0):
                        cloned = db.clone_org_template(
                            int(created_org.get("id") or 0),
                            clone_from_org_id,
                            {
                                "clone_settings": bool(payload.get("clone_settings", True)),
                                "clone_services": bool(payload.get("clone_services", True)),
                                "clone_packages": bool(payload.get("clone_packages", True)),
                                "clone_playbooks": bool(payload.get("clone_playbooks", True)),
                                "clone_reps": bool(payload.get("clone_reps", False)),
                            },
                        )
                    preset_slug = str(payload.get("preset_slug") or '').strip()
                    if preset_slug and int((created_org or {}).get("id") or 0):
                        preset_applied = db.apply_org_preset(int(created_org.get("id") or 0), preset_slug, include_reps=bool(payload.get('apply_preset_reps', True)))
                    seeded_rep = None
                    if int((created_org or {}).get("id") or 0) and str(payload.get('seed_rep_name') or '').strip():
                        seeded_rep = db.create_rep({
                            'org_id': int(created_org.get('id') or 0),
                            'name': str(payload.get('seed_rep_name') or '').strip(),
                            'email': str(payload.get('seed_rep_email') or '').strip(),
                            'phone': str(payload.get('seed_rep_phone') or '').strip(),
                            'role': str(payload.get('seed_rep_role') or 'admin').strip() or 'admin',
                            'commission_rate_bps': int(payload.get('seed_rep_commission_bps') or 0),
                            'target_monthly_cents': int(payload.get('seed_rep_target_cents') or 0),
                            'payout_notes': str(payload.get('seed_rep_notes') or 'Founding operator seeded during desk creation.').strip(),
                            'sort_order': int(payload.get('seed_rep_sort_order') or 0),
                            'is_active': 1,
                        })
                except ValueError as exc:
                    self._send_json({"ok": False, "error": str(exc)}, status=400)
                    return
                self._audit("organization_created", session=session, org_id=int((created_org or {}).get("id") or db.get_default_org_id()), entity_type="organization", entity_id=(created_org or {}).get("id"), detail="new org desk created", metadata={"clone_from_org_id": int(payload.get("clone_from_org_id") or 0), "clone_summary": (cloned or {}).get("cloned") or {}, "preset_slug": str(payload.get("preset_slug") or ''), "preset_applied": (preset_applied or {}).get('applied') or {}, "seeded_rep_id": (seeded_rep or {}).get('id')})
                self._send_json({"ok": True, "org": db.get_org(int((created_org or {}).get("id") or 0)) if (created_org or {}).get("id") else created_org, "orgs": db.list_orgs(), "clone": cloned, "preset": preset_applied, "seeded_rep": seeded_rep})
                return
            if path == "/api/admin/reps":
                if not role_allows(session.get("role"), "admin"):
                    self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                    return
                target_org_id = int(scoped_org_id or payload.get("org_id") or db.get_default_org_id())
                try:
                    created_rep = db.create_rep({
                        "org_id": target_org_id,
                        "name": str(payload.get("name") or "").strip(),
                        "email": str(payload.get("email") or "").strip(),
                        "phone": str(payload.get("phone") or "").strip(),
                        "role": str(payload.get("role") or "setter").strip() or "setter",
                        "is_active": 1 if bool(payload.get("is_active", True)) else 0,
                        "sort_order": int(payload.get("sort_order") or 0),
                        "commission_rate_bps": int(payload.get("commission_rate_bps") or 1000),
                        "target_monthly_cents": int(payload.get("target_monthly_cents") or 0),
                        "payout_notes": str(payload.get("payout_notes") or "").strip(),
                    }) or {}
                except ValueError as exc:
                    self._send_json({"ok": False, "error": str(exc)}, status=400)
                    return
                self._audit("rep_created", session=session, org_id=int((created_rep or {}).get("org_id") or target_org_id), entity_type="rep", entity_id=(created_rep or {}).get("id"), detail="new rep desk created")
                self._send_json({"ok": True, "rep": created_rep, "reps": db.list_reps(target_org_id)})
                return
            if path == "/api/admin/settings":
                if not role_allows(session.get("role"), "admin"):
                    self._send_json({"ok": False, "error": "Admin role required."}, status=403)
                    return
                target_org_id = int(scoped_org_id or db.get_default_org_id())
                operating_days = [int(day) for day in (payload.get("operating_days") or []) if str(day).strip().isdigit() and 0 <= int(day) <= 6]
                if not operating_days:
                    operating_days = [0, 1, 2, 3, 4]
                updated_org = db.update_org(target_org_id, {
                    "support_email": str(payload.get("support_email") or "").strip(),
                    "support_phone": str(payload.get("support_phone") or "").strip(),
                    "timezone": str(payload.get("timezone") or BUSINESS_TZ).strip() or BUSINESS_TZ,
                    "operating_days_json": json.dumps(sorted(set(operating_days))),
                    "open_hour": int(payload.get("open_hour") or 9),
                    "close_hour": int(payload.get("close_hour") or 17),
                    "slot_minutes": int(payload.get("slot_minutes") or 30),
                    "buffer_minutes": int(payload.get("buffer_minutes") or 15),
                    "reminder_lead_hours": int(payload.get("reminder_lead_hours") or 24),
                    "autonomy_enabled": 1 if bool(payload.get("autonomy_enabled", True)) else 0,
                    "auto_followup_hours": int(payload.get("auto_followup_hours") or 24),
                    "auto_noshow_minutes": int(payload.get("auto_noshow_minutes") or 90),
                    "auto_invoice_followup_hours": int(payload.get("auto_invoice_followup_hours") or 48),
                    "auto_intake_followup_hours": int(payload.get("auto_intake_followup_hours") or 24),
                    "booking_notice": str(payload.get("booking_notice") or "").strip(),
                    "default_deposit_cents": int(payload.get("default_deposit_cents") or 0),
                    "default_service_price_cents": int(payload.get("default_service_price_cents") or 0),
                    "currency": str(payload.get("currency") or "USD").strip() or "USD",
                    "payment_instructions": str(payload.get("payment_instructions") or "").strip(),
                }) or {}
                self._audit("settings_updated", session=session, org_id=target_org_id, entity_type="organization", entity_id=target_org_id, detail="booking settings updated")
                self._send_json({"ok": True, "org": updated_org, "settings": self._public_org_payload(org_id=target_org_id).get("settings", {}), "operating_hours": format_operating_hours(target_org_id)})
                return
            if path == "/api/admin/calendar/sync":
                appointment_id = int(payload.get("appointment_id") or 0)
                try:
                    if appointment_id:
                        appt = db.get_appointment(appointment_id) or {}
                        if scoped_org_id and int(appt.get("org_id") or 0) != int(scoped_org_id):
                            self._send_json({"ok": False, "error": "Appointment is outside your org scope."}, status=403)
                            return
                    results = sync_appointment(appointment_id) if appointment_id else sync_all_active(scoped_org_id)
                except ValueError as exc:
                    self._send_json({"ok": False, "error": str(exc)}, status=404)
                    return
                self._audit("calendar_sync_run", session=session, org_id=scoped_org_id, entity_type="calendar_sync", entity_id=appointment_id or "all", detail="manual calendar sync run", metadata={"results": results})
                self._send_json({"ok": True, "results": results})
                return
            if path == "/api/reminders/queue":
                queued = queue_reminders(scoped_org_id)
                self._audit("reminders_queued", session=session, org_id=scoped_org_id, entity_type="outbound_queue", entity_id="manual", detail="manual reminder queue run", metadata={"queued_count": len(queued)})
                self._send_json({"ok": True, "queued": queued})
                return
            if path == "/api/admin/autonomy/run":
                result = run_autonomy_cycle(scoped_org_id)
                self._audit("autonomy_run", session=session, org_id=scoped_org_id, entity_type="automation", entity_id="manual", detail="manual autonomy run", metadata=result)
                self._send_json({"ok": True, "result": result})
                return
            if path == "/api/outbound/dispatch":
                message_ids = payload.get("message_ids") or []
                dispatched = dispatch_outbound(scoped_org_id, [int(item) for item in message_ids] if message_ids else None)
                self._audit("outbound_dispatched", session=session, org_id=scoped_org_id, entity_type="outbound_queue", entity_id="manual", detail="manual outbound dispatch run", metadata={"dispatched_count": len(dispatched)})
                self._send_json({"ok": True, "messages": dispatched})
                return
            if path == "/api/admin/outbound/manual":
                lead_id = int(payload.get("lead_id") or 0)
                channel = str(payload.get("channel") or "email").strip().lower()
                send_now = bool(payload.get("send_now"))
                if channel not in {"email", "sms"}:
                    self._send_json({"ok": False, "error": "channel must be email or sms"}, status=400)
                    return
                lead = db.get_lead(lead_id) or {}
                if not lead:
                    self._send_json({"ok": False, "error": "Lead not found."}, status=404)
                    return
                if scoped_org_id and int(lead.get("org_id") or 0) != int(scoped_org_id):
                    self._send_json({"ok": False, "error": "Lead is outside your org scope."}, status=403)
                    return
                recipient = str(payload.get("recipient") or "").strip()
                if not recipient:
                    recipient = str(lead.get("email") if channel == "email" else lead.get("phone") or "").strip()
                if not recipient:
                    self._send_json({"ok": False, "error": f"Lead is missing a {channel} recipient."}, status=400)
                    return
                subject = str(payload.get("subject") or "").strip()
                body = str(payload.get("body") or "").strip()
                if not body:
                    self._send_json({"ok": False, "error": "body is required"}, status=400)
                    return
                appointment_id = int(payload.get("appointment_id") or 0) or None
                if appointment_id:
                    appointment = db.get_appointment(int(appointment_id)) or {}
                    if not appointment or int(appointment.get("lead_id") or 0) != lead_id:
                        self._send_json({"ok": False, "error": "appointment_id does not belong to the selected lead."}, status=400)
                        return
                transport = ""
                if channel == "email":
                    if os.getenv("SMTP_HOST", "").strip():
                        transport = "smtp-direct"
                    elif os.getenv("EMAIL_WEBHOOK_URL", "").strip():
                        transport = "email-webhook"
                else:
                    if os.getenv("SMS_WEBHOOK_URL", "").strip():
                        transport = "sms-webhook"
                if not transport:
                    self._send_json({"ok": False, "error": f"{channel.upper()} delivery is not configured."}, status=409)
                    return
                message = db.enqueue_outbound_message(
                    int(lead.get("org_id") or scoped_org_id or db.get_default_org_id()),
                    lead_id,
                    appointment_id,
                    channel,
                    recipient,
                    body,
                    subject=subject,
                    transport=transport,
                    metadata={"manual": True, "sender_role": session.get("role") or "", "sender_email": session.get("email") or ""},
                ) or {}
                dispatched = dispatch_outbound(int(lead.get("org_id") or scoped_org_id or db.get_default_org_id()), [int(message.get("id") or 0)]) if send_now and message.get("id") else []
                if dispatched:
                    message = dispatched[0]
                self._audit(
                    "manual_outbound_created",
                    session=session,
                    org_id=int(lead.get("org_id") or scoped_org_id or db.get_default_org_id()),
                    entity_type="outbound_message",
                    entity_id=message.get("id") or "",
                    detail=f"manual {channel} {'sent' if send_now else 'queued'} for lead {lead_id}",
                    metadata={"lead_id": lead_id, "channel": channel, "send_now": send_now, "appointment_id": appointment_id},
                )
                if send_now and message.get("id"):
                    db.update_latest_inbound_thread_for_lead(lead_id, channel, {
                        "thread_status": "waiting_on_lead",
                        "action_taken": "manual_reply_sent",
                        "owner_user_id": int(session.get("user_id") or 0) or None,
                        "owner_name": str(session.get("display_name") or session.get("email") or ""),
                        "claimed_at": db.utcnow_iso(),
                        "replied_at": db.utcnow_iso(),
                        "closed_at": "",
                    })
                self._send_json({"ok": True, "message": message, "dispatched": dispatched})
                return

        match_inbox_action = re.fullmatch(r"/api/admin/inbox/(\d+)/(claim|release|close|reopen)", path)
        if match_inbox_action:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            inbox_id = int(match_inbox_action.group(1))
            action = match_inbox_action.group(2)
            inbound = db.get_inbound_message(inbox_id) or {}
            if not inbound:
                self._send_json({"ok": False, "error": "Inbox thread not found."}, status=404)
                return
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(inbound.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            now = db.utcnow_iso()
            updates = {}
            if action == "claim":
                updates = {
                    "thread_status": "claimed",
                    "owner_user_id": int(session.get("user_id") or 0) or None,
                    "owner_name": str(session.get("display_name") or session.get("email") or ""),
                    "claimed_at": now,
                    "closed_at": "",
                }
            elif action == "release":
                updates = {
                    "thread_status": "open",
                    "owner_user_id": None,
                    "owner_name": "",
                    "claimed_at": "",
                    "closed_at": "",
                }
            elif action == "close":
                updates = {
                    "thread_status": "closed",
                    "owner_user_id": int(session.get("user_id") or 0) or None,
                    "owner_name": str(session.get("display_name") or session.get("email") or ""),
                    "claimed_at": str(inbound.get("claimed_at") or now),
                    "closed_at": now,
                    "action_taken": str(inbound.get("action_taken") or "thread_closed"),
                }
            elif action == "reopen":
                updates = {
                    "thread_status": "open",
                    "closed_at": "",
                }
            updated = db.update_inbound_message(inbox_id, updates) or inbound
            self._audit("inbox_thread_updated", session=session, org_id=int(scoped_org_id or inbound.get("org_id") or db.get_default_org_id()), entity_type="inbound_message", entity_id=inbox_id, detail=f"inbox thread {action}", metadata={"thread_status": updated.get("thread_status") or "", "owner_name": updated.get("owner_name") or ""})
            self._send_json({"ok": True, "message": updated})
            return

        match_reschedule = re.fullmatch(r"/api/appointments/(\d+)/reschedule", path)
        if match_reschedule:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            appointment_id = int(match_reschedule.group(1))
            appt = db.get_appointment(appointment_id) or {}
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(appt.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            if scoped_org_id and int(appt.get("org_id") or 0) != int(scoped_org_id):
                self._send_json({"ok": False, "error": "Appointment is outside your org scope."}, status=403)
                return
            try:
                payload = self._read_json_body()
                updated = reschedule_appointment(
                    appointment_id,
                    str(payload.get("start", "")).strip(),
                    str(payload.get("timezone", BUSINESS_TZ)).strip() or BUSINESS_TZ,
                )
                sync_results = sync_appointment(appointment_id)
                queued_notices = enqueue_appointment_notice(appointment_id, "rescheduled")
                dispatched_notices = dispatch_outbound(int((updated or {}).get("org_id") or db.get_default_org_id()), [int(item["id"]) for item in queued_notices]) if queued_notices else []
            except json.JSONDecodeError:
                self._send_json({"ok": False, "error": "Invalid JSON body"}, status=400)
                return
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=409)
                return
            self._audit("appointment_rescheduled", session=session, org_id=int((updated or {}).get("org_id") or db.get_default_org_id()), entity_type="appointment", entity_id=(updated or {}).get("id"), detail="appointment rescheduled", metadata={"calendar_sync": sync_results, "notice_count": len(queued_notices)})
            self._send_json({"ok": True, "appointment": updated, "calendar_sync": sync_results, "ics_url": appointment_ics_url(updated or {}), "manage_url": appointment_manage_url(updated or {}), "queued_notices": queued_notices, "dispatched_notices": dispatched_notices})
            return

        match_cancel = re.fullmatch(r"/api/appointments/(\d+)/cancel", path)
        if match_cancel:
            session = self._require_auth("manager")
            if not session:
                return
            if not self._require_csrf(session):
                return
            appointment_id = int(match_cancel.group(1))
            appt = db.get_appointment(appointment_id) or {}
            try:
                scoped_org_id = self._resolve_scoped_org(session, int(appt.get("org_id") or 0) or None, None)
            except PermissionError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=403)
                return
            if scoped_org_id and int(appt.get("org_id") or 0) != int(scoped_org_id):
                self._send_json({"ok": False, "error": "Appointment is outside your org scope."}, status=403)
                return
            try:
                updated = cancel_appointment(appointment_id)
                sync_results = sync_appointment(appointment_id)
                queued_notices = enqueue_appointment_notice(appointment_id, "cancelled")
                dispatched_notices = dispatch_outbound(int((updated or {}).get("org_id") or db.get_default_org_id()), [int(item["id"]) for item in queued_notices]) if queued_notices else []
            except ValueError as exc:
                self._send_json({"ok": False, "error": str(exc)}, status=404)
                return
            self._audit("appointment_cancelled", session=session, org_id=int((updated or {}).get("org_id") or db.get_default_org_id()), entity_type="appointment", entity_id=(updated or {}).get("id"), detail="appointment cancelled", metadata={"calendar_sync": sync_results, "notice_count": len(queued_notices)})
            self._send_json({"ok": True, "appointment": updated, "calendar_sync": sync_results, "manage_url": appointment_manage_url(updated or {}), "queued_notices": queued_notices, "dispatched_notices": dispatched_notices})
            return

        self._send_json({"ok": False, "error": "Not found"}, status=404)


if __name__ == "__main__":
    server = create_server(HOST, PORT)
    print(f"Serving on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        WORKER.stop()
        server.server_close()
