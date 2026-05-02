from __future__ import annotations

import base64
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")
os.environ.setdefault("APPT_SETTER_PROVIDER_MODE", "mock")
os.environ.setdefault("GOOGLE_CALENDAR_ACCESS_TOKEN", "mock-google")
os.environ.setdefault("GOOGLE_CALENDAR_ID", "primary")
os.environ.setdefault("MICROSOFT_CALENDAR_ACCESS_TOKEN", "mock-microsoft")
os.environ.setdefault("MICROSOFT_CALENDAR_ID", "primary")
os.environ.setdefault("VOICE_FROM_NUMBER", "(555) 010-3000")

from app import calendar_sync, db, logic, provider_mock, voice  # noqa: E402


def now_plus(hours: int = 24) -> tuple[str, str]:
    start = datetime.now(timezone.utc) + timedelta(hours=hours)
    end = start + timedelta(minutes=45)
    return start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")


def ensure_db() -> None:
    db.init_db()


def create_lead(payload: dict) -> dict:
    ensure_db()
    lead = db.create_lead(
        {
            "name": payload.get("name") or "CommandHub Lead",
            "email": payload.get("email") or "lead@example.com",
            "phone": payload.get("phone") or "+14805550100",
            "business_name": payload.get("business_name") or "Skyes Over London LC",
            "service_interest": payload.get("service_interest") or "AE command integration",
            "urgency": payload.get("urgency") or "high",
            "preferred_schedule": payload.get("preferred_schedule") or "Afternoons",
            "source": payload.get("source") or "commandhub-runtime",
            "notes": payload.get("notes") or "Created from CommandHub branch bridge",
            "tags": payload.get("tags") or ["commandhub", "runtime"],
        }
    )
    session = db.get_latest_session_for_lead(int(lead["id"])) or db.create_session(int(lead["id"]))
    return {"lead": lead, "session": session}


def book_and_sync(payload: dict) -> dict:
    ensured = create_lead(payload)
    lead = ensured["lead"]
    session = ensured["session"]
    start_ts, end_ts = now_plus(int(payload.get("hours_from_now") or 24))
    appointment = db.create_appointment(
        {
            "org_id": int(lead.get("org_id") or db.get_default_org_id()),
            "lead_id": int(lead["id"]),
            "session_id": int(session["id"]),
            "start_ts": payload.get("start_ts") or start_ts,
            "end_ts": payload.get("end_ts") or end_ts,
            "timezone": payload.get("timezone") or "America/Phoenix",
            "status": payload.get("status") or "booked",
            "notes": payload.get("appointment_notes") or "CommandHub runtime booking",
            "confirmation_code": payload.get("confirmation_code") or f"CH-{int(lead['id']):04d}",
        }
    )
    sync_results = calendar_sync.sync_appointment(int(appointment["id"]))
    return {"lead": lead, "session": session, "appointment": appointment, "sync_results": sync_results}


def run_voice(payload: dict) -> dict:
    lead_id = int(payload.get("lead_id") or 0)
    appointment_id = int(payload.get("appointment_id") or 0) or None
    if not lead_id:
        booking = book_and_sync(payload)
        lead_id = int(booking["lead"]["id"])
        appointment_id = int(booking["appointment"]["id"])
    call = voice.start_voice_call(lead_id, purpose=str(payload.get("purpose") or "qualification"), appointment_id=appointment_id, initiated_by=str(payload.get("initiated_by") or "commandhub"))
    return {"call": call, "voice_calls": db.list_voice_calls(limit=25)}


def provider_preflight(_: dict | None = None) -> dict:
    ensure_db()
    provider_status = calendar_sync.provider_status()
    outbound_channels = sorted(logic.configured_outbound_channels())
    pending = db.list_pending_outbound_messages(None)
    return {
        "runtime_mode": "mock" if provider_mock.mock_mode() else "live",
        "providers": provider_status,
        "provider_ready": {
            "google": any(item.get("provider") == "google" and item.get("configured") for item in provider_status),
            "microsoft": any(item.get("provider") == "microsoft" and item.get("configured") for item in provider_status),
            "voice": bool(provider_mock.mock_mode() or os.getenv("VOICE_WEBHOOK_URL", "").strip()),
            "email": bool(provider_mock.mock_mode() or os.getenv("SMTP_HOST", "").strip() or os.getenv("EMAIL_WEBHOOK_URL", "").strip()),
            "sms": bool(provider_mock.mock_mode() or os.getenv("SMS_WEBHOOK_URL", "").strip()),
        },
        "outbound_channels": outbound_channels,
        "pending_outbound": len(pending),
        "counts": {
            "leads": len(db.list_leads()),
            "appointments": len(db.list_appointments()),
            "voice_calls": len(db.list_voice_calls(limit=200)),
            "calendar_links": len(db.list_calendar_event_links(limit=300)),
            "quotes": _quote_invoice_artifact_counts()[0],
            "invoices": _quote_invoice_artifact_counts()[1],
            "artifacts": _quote_invoice_artifact_counts()[2],
        },
    }




def _quote_invoice_artifact_counts() -> tuple[int, int, int]:
    leads = db.list_leads()
    lead_ids = [int(row.get("id") or 0) for row in leads if int(row.get("id") or 0)]
    quote_count = len(db.list_quotes())
    invoice_count = sum(len(db.list_invoices_for_lead(lead_id)) for lead_id in lead_ids)
    artifact_count = sum(len(db.list_artifacts_for_lead(lead_id, include_archived=True, include_deleted=False)) for lead_id in lead_ids)
    return quote_count, invoice_count, artifact_count

def _money_cents(value: object, fallback: int) -> int:
    raw = str(value or "").strip()
    if not raw:
        return int(fallback)
    try:
        return int(round(float(raw) * 100))
    except ValueError:
        return int(fallback)


def _queue_message(lead: dict, appointment: dict, quote: dict, invoice: dict, *, channel: str, recipient: str, body: str, subject: str) -> dict | None:
    if not recipient:
        return None
    org_id = int(lead.get("org_id") or db.get_default_org_id())
    transport = f"{channel}-mock" if provider_mock.mock_mode() else ("smtp-direct" if channel == "email" and os.getenv("SMTP_HOST", "").strip() else f"{channel}-webhook")
    return db.enqueue_outbound_message(
        org_id,
        int(lead["id"]),
        int(appointment["id"]),
        channel,
        recipient,
        body,
        subject=subject,
        transport=transport,
        metadata={
            "kind": "commandhub_stage16_packet",
            "quote_id": int(quote.get("id") or 0),
            "invoice_id": int(invoice.get("id") or 0),
            "appointment_id": int(appointment.get("id") or 0),
        },
    )


def run_revenue_scenario(payload: dict) -> dict:
    booking = book_and_sync(payload)
    lead = booking["lead"]
    appointment = booking["appointment"]
    lead_id = int(lead["id"])
    org_id = int(lead.get("org_id") or db.get_default_org_id())
    total_cents = _money_cents(payload.get("quote_total") or payload.get("amount"), 280000)
    deposit_cents = _money_cents(payload.get("deposit_total") or payload.get("deposit_amount"), int(round(total_cents * 0.4)))
    expires_at = (datetime.now(timezone.utc) + timedelta(days=int(payload.get("expires_in_days") or 10))).isoformat().replace("+00:00", "Z")
    quote = db.create_quote({
        "org_id": org_id,
        "lead_id": lead_id,
        "appointment_id": int(appointment["id"]),
        "title": payload.get("quote_title") or "AE Runtime Strategy Scope",
        "summary": payload.get("quote_summary") or "CommandHub stage-16 revenue packet covering appointment setting, follow-up automation, and qualification workflow.",
        "amount_cents": total_cents,
        "deposit_cents": deposit_cents,
        "currency": payload.get("currency") or "USD",
        "status": "accepted",
        "expires_at": expires_at,
        "accepted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "accepted_name": lead.get("name") or "Client",
        "accepted_company": lead.get("business_name") or "",
        "acceptance_signature": payload.get("acceptance_signature") or "commandhub-stage16",
        "acceptance_notes": payload.get("acceptance_notes") or "Revenue scenario accepted in packaged runtime smoke.",
        "terms_text": payload.get("terms_text") or "Deposit reserves the lane. Balance follows delivery and activation milestones.",
        "metadata": {
            "line_items": [
                {"label": "Appointment setter runtime closure", "amount_cents": total_cents, "deposit_cents": deposit_cents},
            ],
            "source": "commandhub-stage16",
        },
    })
    invoice = db.create_invoice({
        "org_id": org_id,
        "lead_id": lead_id,
        "appointment_id": int(appointment["id"]),
        "kind": "quote_deposit",
        "description": f"Deposit for {quote.get('title') or 'accepted quote'}",
        "amount_cents": deposit_cents,
        "balance_cents": deposit_cents,
        "currency": quote.get("currency") or "USD",
        "status": "sent",
        "notes": payload.get("payment_instructions") or "Reply to the desk before sending payment so the correct invoice can be matched cleanly.",
    })
    packet = {
        "kind": "commandhub_stage16_revenue_packet",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "lead": {"id": lead.get("id"), "name": lead.get("name"), "email": lead.get("email"), "phone": lead.get("phone"), "business_name": lead.get("business_name")},
        "appointment": {"id": appointment.get("id"), "start_ts": appointment.get("start_ts"), "end_ts": appointment.get("end_ts"), "confirmation_code": appointment.get("confirmation_code")},
        "quote": {"id": quote.get("id"), "quote_code": quote.get("quote_code"), "title": quote.get("title"), "amount_cents": quote.get("amount_cents"), "deposit_cents": quote.get("deposit_cents"), "status": quote.get("status")},
        "invoice": {"id": invoice.get("id"), "invoice_code": invoice.get("invoice_code"), "amount_cents": invoice.get("amount_cents"), "status": invoice.get("status")},
        "provider_preflight": provider_preflight({}),
    }
    packet_bytes = json.dumps(packet, indent=2).encode("utf-8")
    artifact = db.create_artifact({
        "org_id": org_id,
        "lead_id": lead_id,
        "appointment_id": int(appointment["id"]),
        "quote_id": int(quote.get("id") or 0),
        "category": "handoff",
        "uploader_scope": "admin",
        "visible_to_client": True,
        "filename": f"appointment-setter-stage16-{quote.get('quote_code')}.json",
        "mime_type": "application/json",
        "size_bytes": len(packet_bytes),
        "content_b64": base64.b64encode(packet_bytes).decode("utf-8"),
        "notes": "CommandHub stage-16 revenue packet.",
    })
    receipt_text = db.render_quote_acceptance_receipt_text(int(quote.get("id") or 0))
    receipt_bytes = receipt_text.encode("utf-8")
    receipt_artifact = db.create_artifact({
        "org_id": org_id,
        "lead_id": lead_id,
        "appointment_id": int(appointment["id"]),
        "quote_id": int(quote.get("id") or 0),
        "category": "receipt",
        "uploader_scope": "admin",
        "visible_to_client": True,
        "filename": f"appointment-setter-receipt-{quote.get('quote_code')}.txt",
        "mime_type": "text/plain",
        "size_bytes": len(receipt_bytes),
        "content_b64": base64.b64encode(receipt_bytes).decode("utf-8"),
        "notes": "Accepted quote receipt exported from packaged runtime.",
    })
    outbound_created = []
    email = str(lead.get("email") or "").strip()
    phone = str(lead.get("phone") or "").strip()
    email_msg = _queue_message(lead, appointment, quote, invoice, channel="email", recipient=email, subject="Your CommandHub scope packet", body=f"Your quote {quote.get('quote_code')} and invoice {invoice.get('invoice_code')} are ready. Reply here to confirm deposit routing.")
    sms_msg = _queue_message(lead, appointment, quote, invoice, channel="sms", recipient=phone, subject="", body=f"CommandHub scope ready: quote {quote.get('quote_code')} / invoice {invoice.get('invoice_code')}. Deposit reserves the lane.")
    outbound_created.extend([item for item in [email_msg, sms_msg] if item])
    dispatched = logic.dispatch_outbound(None, [int(item["id"]) for item in outbound_created]) if outbound_created else []
    return {
        **booking,
        "quote": quote,
        "invoice": invoice,
        "packet": packet,
        "artifacts": [artifact, receipt_artifact],
        "billing": db.get_billing_snapshot_for_lead(lead_id),
        "outbound": {
            "queued": outbound_created,
            "dispatched": dispatched,
            "pending": db.list_pending_outbound_messages(None),
        },
        "summary": summary({}),
    }


def run_provider_closure(payload: dict) -> dict:
    revenue = run_revenue_scenario(payload)
    lead = revenue["lead"]
    appointment = revenue["appointment"]
    quote = revenue["quote"]
    invoice = revenue["invoice"]
    lead_id = int(lead["id"])
    org_id = int(lead.get("org_id") or db.get_default_org_id())

    commitment = db.create_payment_commitment({
        "org_id": org_id,
        "lead_id": lead_id,
        "appointment_id": int(appointment["id"]),
        "invoice_id": int(invoice.get("id") or 0),
        "requester_name": lead.get("name") or "Client",
        "requested_amount_cents": int(invoice.get("balance_cents") or invoice.get("amount_cents") or 0),
        "method": str(payload.get("deposit_method") or "ach"),
        "planned_for_ts": payload.get("planned_for_ts") or (datetime.now(timezone.utc) + timedelta(days=1)).isoformat().replace("+00:00", "Z"),
        "status": "pending",
        "notes": payload.get("commitment_notes") or "Provider-ready deposit commitment created from CommandHub stage-17 closure lane.",
        "source": "commandhub-stage17",
    })
    confirmed_commitment = db.apply_payment_commitment_action(int(commitment["id"]), "confirm", "CommandHub stage-17 provider closure confirmation")
    paid_result = db.apply_payment_commitment_action(int(commitment["id"]), "mark_paid", "Packaged runtime deposit capture proof for provider-ready closure")
    paid_commitment = paid_result.get("commitment") if isinstance(paid_result, dict) else None
    deposit_payment = paid_result.get("payment") if isinstance(paid_result, dict) else None
    paid_invoice = paid_result.get("invoice") if isinstance(paid_result, dict) else invoice

    total_cents = int(quote.get("amount_cents") or 0)
    deposit_cents = int(invoice.get("amount_cents") or 0)
    remaining_cents = max(0, total_cents - deposit_cents)
    payment_plan = None
    generated_plan = {"created_count": 0, "invoices": []}
    if remaining_cents > 0:
        payment_plan = db.create_payment_plan({
            "org_id": org_id,
            "lead_id": lead_id,
            "appointment_id": int(appointment["id"]),
            "quote_id": int(quote.get("id") or 0),
            "title": payload.get("plan_title") or f"{quote.get('title') or 'CommandHub scope'} balance plan",
            "total_cents": remaining_cents,
            "deposit_cents": 0,
            "currency": quote.get("currency") or "USD",
            "installment_count": int(payload.get("installment_count") or 2),
            "interval_days": int(payload.get("interval_days") or 14),
            "first_due_ts": payload.get("first_due_ts") or (datetime.now(timezone.utc) + timedelta(days=14)).isoformat().replace("+00:00", "Z"),
            "notes": payload.get("plan_notes") or "Balance plan generated by stage-17 provider closure lane.",
            "metadata": {"source": "commandhub-stage17", "quote_code": quote.get("quote_code")},
        })
        generated_plan = db.generate_invoices_for_payment_plan(int(payment_plan.get("id") or 0), invoice_status="sent")

    archive_query = str(quote.get("quote_code") or "").strip() or str(invoice.get("invoice_code") or "").strip() or str(lead.get("email") or "").strip()
    archive_hits = []
    if archive_query:
        artifacts = db.list_artifacts_for_lead(lead_id, include_archived=True, include_deleted=False)
        archive_hits = [item for item in artifacts if archive_query.lower() in json.dumps(item, default=str).lower()][:10]

    followup = _queue_message(
        lead,
        appointment,
        quote,
        paid_invoice,
        channel="email",
        recipient=str(lead.get("email") or "").strip(),
        subject="Deposit received and balance plan ready",
        body=(
            f"Deposit captured for {quote.get('quote_code')}. "
            f"Your balance plan is now staged with {len(generated_plan.get('invoices') or [])} invoice(s)."
        ),
    )
    followup_dispatched = logic.dispatch_outbound(None, [int(followup["id"])]) if followup else []

    inbound_result = logic.handle_inbound_message("email", {
        "lead_id": lead_id,
        "from": str(lead.get("email") or "client@example.com"),
        "sender_name": str(lead.get("name") or "Client"),
        "to": os.getenv("APP_SUPPORT_EMAIL", "support@example.com"),
        "subject": f"Re: {quote.get('quote_code')} balance plan",
        "body": payload.get("inbound_body") or "Confirmed. We will pay the remaining balance next Friday morning.",
        "provider_message_id": f"commandhub-stage17-{lead_id}",
        "service_interest": lead.get("service_interest") or "Appointment Setter",
    })

    provider_packet = {
        "kind": "commandhub_stage17_provider_closure",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "runtime_mode": "mock" if provider_mock.mock_mode() else "live",
        "provider_preflight": provider_preflight({}),
        "lead": {"id": lead.get("id"), "name": lead.get("name"), "email": lead.get("email")},
        "quote": {"id": quote.get("id"), "quote_code": quote.get("quote_code"), "amount_cents": quote.get("amount_cents")},
        "deposit_invoice": {"id": paid_invoice.get("id"), "invoice_code": paid_invoice.get("invoice_code"), "status": paid_invoice.get("status")},
        "payment_commitment": paid_commitment or confirmed_commitment,
        "payment": deposit_payment,
        "payment_plan": payment_plan,
        "generated_plan_invoices": generated_plan.get("invoices") or [],
        "archive_hits": [{"id": item.get("id"), "filename": item.get("filename"), "category": item.get("category")} for item in archive_hits],
        "outbound_followup": followup_dispatched,
        "inbound": inbound_result.get("inbound") if isinstance(inbound_result, dict) else None,
    }
    packet_bytes = json.dumps(provider_packet, indent=2).encode("utf-8")
    packet_artifact = db.create_artifact({
        "org_id": org_id,
        "lead_id": lead_id,
        "appointment_id": int(appointment["id"]),
        "quote_id": int(quote.get("id") or 0),
        "category": "provider_closure",
        "uploader_scope": "admin",
        "visible_to_client": False,
        "filename": f"appointment-setter-provider-closure-{quote.get('quote_code')}.json",
        "mime_type": "application/json",
        "size_bytes": len(packet_bytes),
        "content_b64": base64.b64encode(packet_bytes).decode("utf-8"),
        "notes": "Stage-17 provider-ready closure packet with payment plan, archive proof, and inbound/outbound confirmation lane.",
    })
    plan_lines = [
        f"Quote: {quote.get('quote_code')}",
        f"Deposit invoice: {paid_invoice.get('invoice_code')} ({paid_invoice.get('status')})",
        f"Payment commitment: {(paid_commitment or confirmed_commitment or {}).get('status')}",
        f"Payment recorded: {bool(deposit_payment)}",
        f"Remaining installments: {len(generated_plan.get('invoices') or [])}",
        f"Archive hits: {len(archive_hits)}",
        f"Inbound action: {(inbound_result or {}).get('action_taken') or 'conversation'}",
    ]
    plan_text = "\n".join(plan_lines)
    plan_artifact = db.create_artifact({
        "org_id": org_id,
        "lead_id": lead_id,
        "appointment_id": int(appointment["id"]),
        "quote_id": int(quote.get("id") or 0),
        "category": "provider_plan",
        "uploader_scope": "admin",
        "visible_to_client": True,
        "filename": f"appointment-setter-balance-plan-{quote.get('quote_code')}.txt",
        "mime_type": "text/plain",
        "size_bytes": len(plan_text.encode("utf-8")),
        "content_b64": base64.b64encode(plan_text.encode("utf-8")).decode("utf-8"),
        "notes": "Client-visible stage-17 balance-plan proof.",
    })

    return {
        **revenue,
        "provider_preflight": provider_preflight({}),
        "payment_commitment": {
            "created": commitment,
            "confirmed": confirmed_commitment,
            "paid": paid_commitment,
        },
        "payment": deposit_payment,
        "payment_plan": payment_plan,
        "generated_plan": generated_plan,
        "archive_hits": archive_hits,
        "followup": {
            "queued": followup,
            "dispatched": followup_dispatched,
        },
        "inbound": inbound_result,
        "provider_packet": provider_packet,
        "artifacts": revenue.get("artifacts", []) + [packet_artifact, plan_artifact],
        "billing": db.get_billing_snapshot_for_lead(lead_id),
        "summary": summary({}),
    }


def summary(_: dict | None = None) -> dict:
    ensure_db()
    leads = db.list_leads()
    appointments = db.list_appointments()
    calls = db.list_voice_calls(limit=50)
    calendar_links = db.list_calendar_event_links(limit=100)
    logs = db.list_calendar_sync_logs(limit=100)
    outbound = db.list_pending_outbound_messages(None)
    quotes = db.list_quotes()
    invoice_count = _quote_invoice_artifact_counts()[1]
    artifact_count = _quote_invoice_artifact_counts()[2]
    latest_invoice = None
    latest_artifact = None
    for lead in leads:
        lead_id = int(lead.get("id") or 0)
        if not latest_invoice:
            invoices_for_lead = db.list_invoices_for_lead(lead_id)
            if invoices_for_lead:
                latest_invoice = invoices_for_lead[0]
        if not latest_artifact:
            artifacts_for_lead = db.list_artifacts_for_lead(lead_id, include_archived=True, include_deleted=False)
            if artifacts_for_lead:
                latest_artifact = artifacts_for_lead[0]
        if latest_invoice and latest_artifact:
            break
    return {
        "counts": {
            "leads": len(leads),
            "appointments": len(appointments),
            "voice_calls": len(calls),
            "calendar_links": len(calendar_links),
            "calendar_logs": len(logs),
            "pending_outbound": len(outbound),
            "quotes": len(quotes),
            "invoices": invoice_count,
            "artifacts": artifact_count,
            "payments": sum(len(db.list_payments_for_lead(int(lead.get("id") or 0))) for lead in leads),
            "payment_commitments": sum(len(db.list_payment_commitments_for_lead(int(lead.get("id") or 0))) for lead in leads),
            "payment_plans": sum(len(db.list_payment_plans_for_lead(int(lead.get("id") or 0))) for lead in leads),
            "inbound_messages": sum(len(db.list_inbound_messages_for_lead(int(lead.get("id") or 0), limit=200)) for lead in leads),
        },
        "provider_status": calendar_sync.provider_status(),
        "latest_lead": leads[0] if leads else None,
        "latest_appointment": appointments[-1] if appointments else None,
        "latest_call": calls[0] if calls else None,
        "latest_quote": quotes[0] if quotes else None,
        "latest_invoice": latest_invoice,
        "latest_artifact": latest_artifact,
    }


def run_scenario(payload: dict) -> dict:
    booking = book_and_sync(payload)
    call = voice.start_voice_call(int(booking["lead"]["id"]), purpose="qualification", appointment_id=int(booking["appointment"]["id"]), initiated_by="commandhub-scenario")
    return {**booking, "call": call, "summary": summary({})}


def main() -> None:
    body = json.loads(sys.stdin.read() or "{}")
    action = str(body.get("action") or "summary")
    payload = body.get("payload") or {}
    if action == "createLead":
        result = create_lead(payload)
    elif action == "bookAndSync":
        result = book_and_sync(payload)
    elif action == "runVoice":
        result = run_voice(payload)
    elif action == "providerPreflight":
        result = provider_preflight(payload)
    elif action == "runRevenueScenario":
        result = run_revenue_scenario(payload)
    elif action == "runProviderClosure":
        result = run_provider_closure(payload)
    elif action == "runScenario":
        result = run_scenario(payload)
    elif action == "summary":
        result = summary(payload)
    else:
        raise SystemExit(json.dumps({"ok": False, "error": f"Unsupported action: {action}"}))
    print(json.dumps({"ok": True, "action": action, "result": result}, default=str))


if __name__ == "__main__":
    main()
