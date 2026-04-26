from __future__ import annotations

import json
import re
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterable

from .auth import default_admin_users

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "appointments.db"
DEFAULT_ORG_SLUG = "main"
DEFAULT_ORG_NAME = "Main Desk"

ORG_PRESETS: dict[str, dict[str, Any]] = {
    "general-consulting": {
        "name": "General Consulting Desk",
        "description": "Balanced services, discovery calls, and follow-up messaging for broad service businesses.",
        "org_updates": {
            "open_hour": 8,
            "close_hour": 18,
            "slot_minutes": 45,
            "buffer_minutes": 15,
            "reminder_lead_hours": 24,
            "default_deposit_cents": 15000,
            "default_service_price_cents": 45000,
            "booking_notice": "Bring your goals, constraints, and any current vendor or systems context so the first call can move directly into decision-making.",
            "payment_instructions": "Deposits lock the strategy slot. Final balances are due according to the signed scope or quote.",
        },
        "services": [
            {"slug": "discovery-call", "name": "Discovery Call", "description": "Fast qualification and next-step mapping.", "base_price_cents": 45000, "deposit_cents": 15000, "duration_minutes": 45, "metadata": {"preset": "general-consulting"}},
            {"slug": "proposal-review", "name": "Proposal Review", "description": "Walkthrough of scope, pricing, and delivery expectations.", "base_price_cents": 65000, "deposit_cents": 20000, "duration_minutes": 60, "metadata": {"preset": "general-consulting"}},
        ],
        "packages": [
            {"slug": "launch-sprint", "name": "Launch Sprint", "description": "One strategy call, one quote lane, and one follow-up implementation path.", "total_price_cents": 185000, "deposit_cents": 35000, "metadata": {"preset": "general-consulting"}},
        ],
        "playbooks": [
            {"name": "Consulting reachback", "channel": "email", "subject_template": "Next step for {service_interest}", "body_template": "Hi {lead_name},\n\nI reviewed your request for {service_interest}. The fastest next step is to secure a decision call here: {manage_url}\n\nReply with your best window if you want us to handle it manually.\n\n– {assigned_owner}", "tags": ["preset", "consulting"]},
            {"name": "Consulting SMS nudge", "channel": "sms", "subject_template": "", "body_template": "Hi {first_name}, this is {assigned_owner}. I can hold a slot for your {service_interest}. Use {manage_url} or reply with your best time.", "tags": ["preset", "consulting", "sms"]},
        ],
        "reps": [
            {"name": "Founder Desk", "role": "admin", "sort_order": 0, "commission_rate_bps": 0, "target_monthly_cents": 0, "payout_notes": "Preset founder-operator lane for consulting approvals and escalations."},
            {"name": "Strategy Setter", "role": "setter", "sort_order": 1, "commission_rate_bps": 900, "target_monthly_cents": 2500000, "payout_notes": "Handles discovery-call scheduling and qualification follow-up for consulting desks."},
        ],
    },
    "home-services": {
        "name": "Home Services Desk",
        "description": "Estimate-first scheduling with property, urgency, and onsite follow-up baked in.",
        "org_updates": {
            "open_hour": 7,
            "close_hour": 19,
            "slot_minutes": 60,
            "buffer_minutes": 30,
            "reminder_lead_hours": 18,
            "default_deposit_cents": 9900,
            "default_service_price_cents": 29900,
            "booking_notice": "Please have the property address, access notes, and photos ready if you want a faster estimate or dispatch path.",
            "payment_instructions": "Estimate and dispatch deposits are due to reserve a field lane. Change requests are handled through the quote desk.",
        },
        "services": [
            {"slug": "onsite-estimate", "name": "Onsite Estimate", "description": "A field visit to scope the job and lock pricing.", "base_price_cents": 29900, "deposit_cents": 9900, "duration_minutes": 60, "metadata": {"preset": "home-services"}},
            {"slug": "same-day-dispatch", "name": "Same-Day Dispatch", "description": "Priority lane for urgent service calls and fast routing.", "base_price_cents": 49900, "deposit_cents": 19900, "duration_minutes": 90, "metadata": {"preset": "home-services"}},
        ],
        "packages": [
            {"slug": "repair-priority-pack", "name": "Repair Priority Pack", "description": "Estimate, dispatch priority, and one booked completion window.", "total_price_cents": 149500, "deposit_cents": 24900, "metadata": {"preset": "home-services"}},
        ],
        "playbooks": [
            {"name": "Estimate reminder", "channel": "sms", "subject_template": "", "body_template": "Hi {first_name}, we can still get your {service_interest} estimate booked. Use {manage_url} or reply with the property address and best access window.", "tags": ["preset", "home-services", "sms"]},
            {"name": "Property prep email", "channel": "email", "subject_template": "Prep for your estimate", "body_template": "Hi {lead_name},\n\nBefore the appointment, send any photos, access notes, and urgency details you want the desk to review. You can manage the appointment and upload proof here: {manage_url}\n\n– {assigned_owner}", "tags": ["preset", "home-services"]},
        ],
        "reps": [
            {"name": "Dispatch Desk", "role": "admin", "sort_order": 0, "commission_rate_bps": 0, "target_monthly_cents": 0, "payout_notes": "Controls dispatch approvals, scheduling changes, and field escalations."},
            {"name": "Field Estimator", "role": "setter", "sort_order": 1, "commission_rate_bps": 1100, "target_monthly_cents": 1800000, "payout_notes": "Runs estimate scheduling, photo follow-up, and property readiness intake."},
        ],
    },
    "white-glove-chauffeur": {
        "name": "White-Glove Chauffeur Desk",
        "description": "Executive and concierge scheduling with longer buffers, premium deposits, and itinerary-driven follow-up.",
        "org_updates": {
            "open_hour": 5,
            "close_hour": 23,
            "slot_minutes": 90,
            "buffer_minutes": 45,
            "reminder_lead_hours": 12,
            "default_deposit_cents": 25000,
            "default_service_price_cents": 125000,
            "booking_notice": "Provide pickup address, destination, passenger count, luggage load, and any white-glove requirements so routing can be confirmed cleanly.",
            "payment_instructions": "Luxury reservations remain tentative until the desk records deposit receipt and confirms itinerary details.",
        },
        "services": [
            {"slug": "executive-transfer", "name": "Executive Transfer", "description": "Premium private transfer with live itinerary handling.", "base_price_cents": 125000, "deposit_cents": 25000, "duration_minutes": 120, "metadata": {"preset": "white-glove-chauffeur"}},
            {"slug": "airport-concierge", "name": "Airport Concierge", "description": "Arrival or departure lane with luggage and timing coordination.", "base_price_cents": 145000, "deposit_cents": 30000, "duration_minutes": 150, "metadata": {"preset": "white-glove-chauffeur"}},
        ],
        "packages": [
            {"slug": "executive-day-block", "name": "Executive Day Block", "description": "Reserved chauffeur block for multi-stop and executive calendar support.", "total_price_cents": 395000, "deposit_cents": 75000, "metadata": {"preset": "white-glove-chauffeur"}},
        ],
        "playbooks": [
            {"name": "Itinerary request", "channel": "email", "subject_template": "Trip details needed for your reservation", "body_template": "Hi {lead_name},\n\nTo finalize your white-glove reservation, reply with pickup, destination, passenger count, luggage, and any timing constraints. You can also manage the reservation here: {manage_url}\n\n– {assigned_owner}", "tags": ["preset", "chauffeur"]},
            {"name": "Chauffeur SMS confirmation", "channel": "sms", "subject_template": "", "body_template": "Hi {first_name}, this is {assigned_owner}. Your concierge reservation is almost ready. Reply with your pickup time or use {manage_url} to confirm details.", "tags": ["preset", "chauffeur", "sms"]},
        ],
        "reps": [
            {"name": "Concierge Desk", "role": "admin", "sort_order": 0, "commission_rate_bps": 0, "target_monthly_cents": 0, "payout_notes": "Owns itinerary approval, premium client escalations, and reservation QA."},
            {"name": "Reservation Setter", "role": "setter", "sort_order": 1, "commission_rate_bps": 1200, "target_monthly_cents": 3200000, "payout_notes": "Runs pickup coordination, itinerary follow-up, and luxury reservation confirmation."},
        ],
    },
}


def utcnow_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"



def normalize_phone(value: str | None) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits



def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)



def connect() -> sqlite3.Connection:
    ensure_data_dir()
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn



def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        (name,),
    ).fetchone()
    return row is not None



def column_names(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {str(row[1]) for row in rows}



def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    if column not in column_names(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")



def init_db() -> None:
    ensure_data_dir()
    with connect() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;

            CREATE TABLE IF NOT EXISTS organizations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                support_email TEXT DEFAULT '',
                support_phone TEXT DEFAULT '',
                timezone TEXT DEFAULT 'America/Phoenix',
                operating_days_json TEXT DEFAULT '[1,2,3,4,5]',
                open_hour INTEGER DEFAULT 9,
                close_hour INTEGER DEFAULT 17,
                slot_minutes INTEGER DEFAULT 30,
                buffer_minutes INTEGER DEFAULT 15,
                reminder_lead_hours INTEGER DEFAULT 24,
                autonomy_enabled INTEGER DEFAULT 1,
                auto_followup_hours INTEGER DEFAULT 24,
                auto_noshow_minutes INTEGER DEFAULT 90,
                auto_invoice_followup_hours INTEGER DEFAULT 48,
                auto_intake_followup_hours INTEGER DEFAULT 24,
                booking_notice TEXT DEFAULT '',
                active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                email TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                role TEXT DEFAULT 'setter',
                is_active INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                commission_rate_bps INTEGER DEFAULT 1000,
                target_monthly_cents INTEGER DEFAULT 0,
                payout_notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS routing_state (
                org_id INTEGER PRIMARY KEY,
                last_rep_id INTEGER,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                assigned_rep_id INTEGER,
                name TEXT,
                email TEXT,
                phone TEXT,
                phone_normalized TEXT DEFAULT '',
                business_name TEXT,
                service_interest TEXT,
                urgency TEXT,
                preferred_schedule TEXT,
                timezone TEXT DEFAULT 'America/Phoenix',
                qualification_status TEXT DEFAULT 'new',
                source TEXT DEFAULT 'website',
                notes TEXT DEFAULT '',
                tags_json TEXT DEFAULT '[]',
                assigned_owner TEXT DEFAULT 'Founder Desk',
                last_contacted_at TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (assigned_rep_id) REFERENCES reps(id)
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER NOT NULL,
                org_id INTEGER NOT NULL DEFAULT 1,
                status TEXT DEFAULT 'open',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                text TEXT NOT NULL,
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                session_id INTEGER,
                start_ts TEXT NOT NULL,
                end_ts TEXT NOT NULL,
                timezone TEXT NOT NULL,
                status TEXT DEFAULT 'booked',
                notes TEXT DEFAULT '',
                confirmation_code TEXT NOT NULL,
                reminder_last_queued_at TEXT DEFAULT '',
                reminder_last_sent_at TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS outbound_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER,
                appointment_id INTEGER,
                channel TEXT NOT NULL,
                recipient TEXT NOT NULL,
                subject TEXT DEFAULT '',
                body TEXT NOT NULL,
                transport TEXT DEFAULT 'unconfigured',
                status TEXT DEFAULT 'queued',
                provider_message_id TEXT DEFAULT '',
                error_text TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                dispatched_at TEXT DEFAULT '',
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id)
            );

            CREATE TABLE IF NOT EXISTS inbound_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER,
                appointment_id INTEGER,
                session_id INTEGER,
                channel TEXT NOT NULL,
                sender TEXT NOT NULL,
                recipient TEXT DEFAULT '',
                subject TEXT DEFAULT '',
                body TEXT NOT NULL,
                provider_message_id TEXT DEFAULT '',
                status TEXT DEFAULT 'received',
                action_taken TEXT DEFAULT '',
                thread_status TEXT DEFAULT 'open',
                owner_user_id INTEGER,
                owner_name TEXT DEFAULT '',
                priority TEXT DEFAULT 'normal',
                claimed_at TEXT DEFAULT '',
                replied_at TEXT DEFAULT '',
                closed_at TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                FOREIGN KEY (owner_user_id) REFERENCES admin_users(id)
            );

            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                email TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                password_hash TEXT NOT NULL,
                require_password_change INTEGER DEFAULT 1,
                failed_login_count INTEGER DEFAULT 0,
                locked_until TEXT DEFAULT '',
                password_changed_at TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS admin_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token TEXT NOT NULL UNIQUE,
                csrf_token TEXT NOT NULL DEFAULT '',
                expires_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES admin_users(id)
            );

            CREATE TABLE IF NOT EXISTS voice_calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER,
                appointment_id INTEGER,
                session_id INTEGER,
                direction TEXT NOT NULL,
                purpose TEXT DEFAULT 'qualification',
                from_number TEXT DEFAULT '',
                to_number TEXT DEFAULT '',
                provider TEXT DEFAULT 'unconfigured',
                provider_call_id TEXT DEFAULT '',
                status TEXT DEFAULT 'queued',
                outcome TEXT DEFAULT '',
                duration_seconds INTEGER DEFAULT 0,
                transcript TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS calendar_event_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                provider TEXT NOT NULL,
                appointment_id INTEGER NOT NULL,
                external_calendar_id TEXT DEFAULT '',
                external_event_id TEXT DEFAULT '',
                external_url TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                payload_json TEXT DEFAULT '{}',
                last_synced_at TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(provider, appointment_id),
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id)
            );

            CREATE TABLE IF NOT EXISTS calendar_sync_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                provider TEXT NOT NULL,
                appointment_id INTEGER,
                action TEXT NOT NULL,
                status TEXT NOT NULL,
                detail TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id)
            );

            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                actor_user_id INTEGER,
                actor_email TEXT DEFAULT '',
                actor_role TEXT DEFAULT '',
                event_type TEXT NOT NULL,
                route TEXT DEFAULT '',
                entity_type TEXT DEFAULT '',
                entity_id TEXT DEFAULT '',
                status TEXT DEFAULT 'ok',
                detail TEXT DEFAULT '',
                ip_address TEXT DEFAULT '',
                user_agent TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (actor_user_id) REFERENCES admin_users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, qualification_status);
            CREATE INDEX IF NOT EXISTS idx_sessions_lead_org ON sessions(lead_id, org_id);
            CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_appointments_org_status_start ON appointments(org_id, status, start_ts);
            CREATE INDEX IF NOT EXISTS idx_outbound_org_status_created ON outbound_messages(org_id, status, created_at);
            CREATE INDEX IF NOT EXISTS idx_inbound_org_created ON inbound_messages(org_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_inbound_lead_created ON inbound_messages(lead_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_inbound_org_thread_status ON inbound_messages(org_id, thread_status, created_at);
            CREATE INDEX IF NOT EXISTS idx_inbound_org_owner ON inbound_messages(org_id, owner_user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
            CREATE INDEX IF NOT EXISTS idx_voice_calls_org_created ON voice_calls(org_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_calendar_links_org_provider ON calendar_event_links(org_id, provider);
            CREATE INDEX IF NOT EXISTS idx_calendar_logs_org_created ON calendar_sync_logs(org_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_audit_events_org_created ON audit_events(org_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_audit_events_type_created ON audit_events(event_type, created_at);
            """
        )

        if table_exists(conn, "organizations"):
            ensure_column(conn, "organizations", "operating_days_json", "TEXT DEFAULT '[1,2,3,4,5]'")
            ensure_column(conn, "organizations", "open_hour", "INTEGER DEFAULT 9")
            ensure_column(conn, "organizations", "close_hour", "INTEGER DEFAULT 17")
            ensure_column(conn, "organizations", "slot_minutes", "INTEGER DEFAULT 30")
            ensure_column(conn, "organizations", "buffer_minutes", "INTEGER DEFAULT 15")
            ensure_column(conn, "organizations", "reminder_lead_hours", "INTEGER DEFAULT 24")
            ensure_column(conn, "organizations", "booking_notice", "TEXT DEFAULT ''")
            ensure_column(conn, "organizations", "default_deposit_cents", "INTEGER DEFAULT 0")
            ensure_column(conn, "organizations", "default_service_price_cents", "INTEGER DEFAULT 0")
            ensure_column(conn, "organizations", "currency", "TEXT DEFAULT 'USD'")
            ensure_column(conn, "organizations", "payment_instructions", "TEXT DEFAULT ''")
        if table_exists(conn, "leads"):
            ensure_column(conn, "leads", "org_id", "INTEGER NOT NULL DEFAULT 1")
            ensure_column(conn, "leads", "assigned_rep_id", "INTEGER")
            ensure_column(conn, "leads", "last_contacted_at", "TEXT DEFAULT ''")
            ensure_column(conn, "leads", "phone_normalized", "TEXT DEFAULT ''")
        if table_exists(conn, "reps"):
            ensure_column(conn, "reps", "commission_rate_bps", "INTEGER DEFAULT 1000")
            ensure_column(conn, "reps", "target_monthly_cents", "INTEGER DEFAULT 0")
            ensure_column(conn, "reps", "payout_notes", "TEXT DEFAULT ''")
        if table_exists(conn, "sessions"):
            ensure_column(conn, "sessions", "org_id", "INTEGER NOT NULL DEFAULT 1")
        if table_exists(conn, "inbound_messages"):
            ensure_column(conn, "inbound_messages", "thread_status", "TEXT DEFAULT 'open'")
            ensure_column(conn, "inbound_messages", "owner_user_id", "INTEGER")
            ensure_column(conn, "inbound_messages", "owner_name", "TEXT DEFAULT ''")
            ensure_column(conn, "inbound_messages", "priority", "TEXT DEFAULT 'normal'")
            ensure_column(conn, "inbound_messages", "claimed_at", "TEXT DEFAULT ''")
            ensure_column(conn, "inbound_messages", "replied_at", "TEXT DEFAULT ''")
            ensure_column(conn, "inbound_messages", "closed_at", "TEXT DEFAULT ''")
        if table_exists(conn, "appointments"):
            ensure_column(conn, "appointments", "org_id", "INTEGER NOT NULL DEFAULT 1")
            ensure_column(conn, "appointments", "reminder_last_queued_at", "TEXT DEFAULT ''")
            ensure_column(conn, "appointments", "reminder_last_sent_at", "TEXT DEFAULT ''")
        if table_exists(conn, "invoices"):
            ensure_column(conn, "invoices", "payment_plan_id", "INTEGER")
            ensure_column(conn, "invoices", "installment_number", "INTEGER DEFAULT 0")
            ensure_column(conn, "invoices", "installment_count", "INTEGER DEFAULT 0")
        if table_exists(conn, "quotes"):
            ensure_column(conn, "quotes", "accepted_title", "TEXT DEFAULT ''")
            ensure_column(conn, "quotes", "accepted_company", "TEXT DEFAULT ''")
            ensure_column(conn, "quotes", "acceptance_signature", "TEXT DEFAULT ''")
        if table_exists(conn, "admin_users"):
            ensure_column(conn, "admin_users", "org_id", "INTEGER NOT NULL DEFAULT 1")
            ensure_column(conn, "admin_users", "require_password_change", "INTEGER DEFAULT 1")
            ensure_column(conn, "admin_users", "failed_login_count", "INTEGER DEFAULT 0")
            ensure_column(conn, "admin_users", "locked_until", "TEXT DEFAULT ''")
            ensure_column(conn, "admin_users", "password_changed_at", "TEXT DEFAULT ''")
        if table_exists(conn, "organizations"):
            ensure_column(conn, "organizations", "autonomy_enabled", "INTEGER DEFAULT 1")
            ensure_column(conn, "organizations", "auto_followup_hours", "INTEGER DEFAULT 24")
            ensure_column(conn, "organizations", "auto_noshow_minutes", "INTEGER DEFAULT 90")
            ensure_column(conn, "organizations", "auto_invoice_followup_hours", "INTEGER DEFAULT 48")
            ensure_column(conn, "organizations", "auto_intake_followup_hours", "INTEGER DEFAULT 24")
        if table_exists(conn, "admin_sessions"):
            ensure_column(conn, "admin_sessions", "csrf_token", "TEXT NOT NULL DEFAULT ''")
        if table_exists(conn, "proof_artifacts"):
            ensure_column(conn, "proof_artifacts", "status", "TEXT DEFAULT 'active'")
            ensure_column(conn, "proof_artifacts", "deleted_at", "TEXT DEFAULT ''")
            ensure_column(conn, "proof_artifacts", "version_group", "TEXT DEFAULT ''")
            ensure_column(conn, "proof_artifacts", "version_number", "INTEGER DEFAULT 1")
            ensure_column(conn, "proof_artifacts", "supersedes_artifact_id", "INTEGER")
            ensure_column(conn, "proof_artifacts", "superseded_by_artifact_id", "INTEGER")

        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS intake_packets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL UNIQUE,
                appointment_id INTEGER,
                status TEXT DEFAULT 'pending',
                business_need TEXT DEFAULT '',
                budget_range TEXT DEFAULT '',
                decision_window TEXT DEFAULT '',
                intake_notes TEXT DEFAULT '',
                waiver_text TEXT DEFAULT 'I confirm that the information I submit is accurate and I approve the appointment preparation steps required by this business.',
                waiver_accepted INTEGER DEFAULT 0,
                waiver_accepted_at TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id)
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                appointment_id INTEGER,
                payment_plan_id INTEGER,
                invoice_code TEXT NOT NULL UNIQUE,
                kind TEXT DEFAULT 'service',
                description TEXT DEFAULT '',
                amount_cents INTEGER NOT NULL DEFAULT 0,
                balance_cents INTEGER NOT NULL DEFAULT 0,
                currency TEXT DEFAULT 'USD',
                status TEXT DEFAULT 'draft',
                due_ts TEXT DEFAULT '',
                installment_number INTEGER DEFAULT 0,
                installment_count INTEGER DEFAULT 0,
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (payment_plan_id) REFERENCES payment_plans(id)
            );

            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                appointment_id INTEGER,
                invoice_id INTEGER,
                amount_cents INTEGER NOT NULL DEFAULT 0,
                method TEXT DEFAULT 'cash',
                reference TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (invoice_id) REFERENCES invoices(id)
            );

            CREATE TABLE IF NOT EXISTS payment_commitments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                appointment_id INTEGER,
                invoice_id INTEGER,
                requester_name TEXT DEFAULT '',
                requested_amount_cents INTEGER NOT NULL DEFAULT 0,
                method TEXT DEFAULT 'ach',
                planned_for_ts TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                notes TEXT DEFAULT '',
                source TEXT DEFAULT 'public_portal',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (invoice_id) REFERENCES invoices(id)
            );

            CREATE TABLE IF NOT EXISTS payment_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                appointment_id INTEGER,
                quote_id INTEGER,
                title TEXT NOT NULL,
                total_cents INTEGER NOT NULL DEFAULT 0,
                deposit_cents INTEGER NOT NULL DEFAULT 0,
                currency TEXT DEFAULT 'USD',
                installment_count INTEGER NOT NULL DEFAULT 1,
                interval_days INTEGER NOT NULL DEFAULT 30,
                first_due_ts TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                notes TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                cancelled_at TEXT DEFAULT '',
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (quote_id) REFERENCES quotes(id)
            );

            CREATE TABLE IF NOT EXISTS recurring_memberships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                appointment_id INTEGER,
                quote_id INTEGER,
                service_id INTEGER,
                package_id INTEGER,
                title TEXT NOT NULL,
                amount_cents INTEGER NOT NULL DEFAULT 0,
                currency TEXT DEFAULT 'USD',
                interval_days INTEGER NOT NULL DEFAULT 30,
                next_invoice_ts TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                last_invoiced_at TEXT DEFAULT '',
                paused_at TEXT DEFAULT '',
                cancelled_at TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (quote_id) REFERENCES quotes(id),
                FOREIGN KEY (service_id) REFERENCES services(id),
                FOREIGN KEY (package_id) REFERENCES packages(id)
            );

            CREATE INDEX IF NOT EXISTS idx_intake_packets_org_lead ON intake_packets(org_id, lead_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_org_lead_status ON invoices(org_id, lead_id, status);
            CREATE INDEX IF NOT EXISTS idx_invoices_payment_plan ON invoices(payment_plan_id, installment_number);
            CREATE INDEX IF NOT EXISTS idx_payments_org_lead_created ON payments(org_id, lead_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_payment_commitments_org_lead_status ON payment_commitments(org_id, lead_id, status);
            CREATE INDEX IF NOT EXISTS idx_payment_commitments_invoice ON payment_commitments(invoice_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_payment_plans_org_lead_status ON payment_plans(org_id, lead_id, status);
            CREATE INDEX IF NOT EXISTS idx_memberships_org_lead_status ON recurring_memberships(org_id, lead_id, status);
            CREATE INDEX IF NOT EXISTS idx_memberships_org_next_invoice ON recurring_memberships(org_id, next_invoice_ts, status);
            """
        )

        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                base_price_cents INTEGER NOT NULL DEFAULT 0,
                deposit_cents INTEGER NOT NULL DEFAULT 0,
                duration_minutes INTEGER NOT NULL DEFAULT 30,
                active INTEGER DEFAULT 1,
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(org_id, slug),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                total_price_cents INTEGER NOT NULL DEFAULT 0,
                deposit_cents INTEGER NOT NULL DEFAULT 0,
                active INTEGER DEFAULT 1,
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(org_id, slug),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                appointment_id INTEGER,
                service_id INTEGER,
                package_id INTEGER,
                quote_code TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                summary TEXT DEFAULT '',
                amount_cents INTEGER NOT NULL DEFAULT 0,
                deposit_cents INTEGER NOT NULL DEFAULT 0,
                currency TEXT DEFAULT 'USD',
                status TEXT DEFAULT 'draft',
                expires_at TEXT DEFAULT '',
                accepted_at TEXT DEFAULT '',
                accepted_name TEXT DEFAULT '',
                accepted_title TEXT DEFAULT '',
                accepted_company TEXT DEFAULT '',
                acceptance_signature TEXT DEFAULT '',
                acceptance_notes TEXT DEFAULT '',
                terms_text TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (service_id) REFERENCES services(id),
                FOREIGN KEY (package_id) REFERENCES packages(id)
            );

            CREATE TABLE IF NOT EXISTS escalations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                session_id INTEGER,
                appointment_id INTEGER,
                priority TEXT DEFAULT 'normal',
                status TEXT DEFAULT 'open',
                reason TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                suggested_reply TEXT DEFAULT '',
                source TEXT DEFAULT 'chat',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                resolved_at TEXT DEFAULT '',
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id)
            );

            CREATE TABLE IF NOT EXISTS lead_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL UNIQUE,
                summary TEXT DEFAULT '',
                last_service_interest TEXT DEFAULT '',
                booked_count INTEGER DEFAULT 0,
                completed_count INTEGER DEFAULT 0,
                no_show_count INTEGER DEFAULT 0,
                paid_cents INTEGER DEFAULT 0,
                outstanding_cents INTEGER DEFAULT 0,
                preferences_json TEXT DEFAULT '[]',
                objections_json TEXT DEFAULT '[]',
                metadata_json TEXT DEFAULT '{}',
                last_seen_at TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id)
            );

            CREATE TABLE IF NOT EXISTS portal_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                appointment_id INTEGER,
                title TEXT NOT NULL,
                body TEXT DEFAULT '',
                kind TEXT DEFAULT 'document',
                required INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                signed_name TEXT DEFAULT '',
                signed_at TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id)
            );

            CREATE TABLE IF NOT EXISTS proof_artifacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER NOT NULL DEFAULT 1,
                lead_id INTEGER NOT NULL,
                appointment_id INTEGER,
                quote_id INTEGER,
                document_id INTEGER,
                category TEXT DEFAULT 'evidence',
                uploader_scope TEXT DEFAULT 'admin',
                visible_to_client INTEGER DEFAULT 1,
                filename TEXT NOT NULL,
                mime_type TEXT DEFAULT 'application/octet-stream',
                size_bytes INTEGER DEFAULT 0,
                content_b64 TEXT NOT NULL,
                notes TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                deleted_at TEXT DEFAULT '',
                version_group TEXT DEFAULT '',
                version_number INTEGER DEFAULT 1,
                supersedes_artifact_id INTEGER,
                superseded_by_artifact_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (lead_id) REFERENCES leads(id),
                FOREIGN KEY (appointment_id) REFERENCES appointments(id),
                FOREIGN KEY (quote_id) REFERENCES quotes(id),
                FOREIGN KEY (document_id) REFERENCES portal_documents(id)
            );

            CREATE INDEX IF NOT EXISTS idx_services_org_active ON services(org_id, active);
            CREATE INDEX IF NOT EXISTS idx_packages_org_active ON packages(org_id, active);
            CREATE INDEX IF NOT EXISTS idx_quotes_org_lead_status ON quotes(org_id, lead_id, status);
            CREATE INDEX IF NOT EXISTS idx_escalations_org_status ON escalations(org_id, status, created_at);
            CREATE TABLE IF NOT EXISTS lead_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER,
                name TEXT NOT NULL,
                filters_json TEXT DEFAULT '{}',
                is_shared INTEGER DEFAULT 1,
                created_by_user_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (created_by_user_id) REFERENCES admin_users(id)
            );

            CREATE TABLE IF NOT EXISTS playbooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id INTEGER,
                name TEXT NOT NULL,
                channel TEXT NOT NULL DEFAULT 'email',
                subject_template TEXT DEFAULT '',
                body_template TEXT NOT NULL,
                tags_json TEXT DEFAULT '[]',
                active INTEGER DEFAULT 1,
                created_by_user_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id),
                FOREIGN KEY (created_by_user_id) REFERENCES admin_users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_lead_memories_org_lead ON lead_memories(org_id, lead_id);
            CREATE INDEX IF NOT EXISTS idx_portal_documents_org_lead ON portal_documents(org_id, lead_id, status);
            CREATE INDEX IF NOT EXISTS idx_proof_artifacts_org_lead ON proof_artifacts(org_id, lead_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_proof_artifacts_version_group ON proof_artifacts(version_group, version_number);
            CREATE INDEX IF NOT EXISTS idx_lead_views_org_name ON lead_views(org_id, name);
            CREATE INDEX IF NOT EXISTS idx_playbooks_org_channel ON playbooks(org_id, channel, active);
            """
        )

        seed_defaults(conn)
        seed_commercial_defaults(conn)
        seed_playbook_defaults(conn)
        conn.commit()



def seed_defaults(conn: sqlite3.Connection) -> None:
    now = utcnow_iso()
    org = conn.execute("SELECT * FROM organizations WHERE slug = ?", (DEFAULT_ORG_SLUG,)).fetchone()
    if not org:
        conn.execute(
            """
            INSERT INTO organizations (
                slug, name, support_email, support_phone, timezone, operating_days_json,
                open_hour, close_hour, slot_minutes, buffer_minutes, reminder_lead_hours,
                booking_notice, default_deposit_cents, default_service_price_cents, currency, payment_instructions, active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 'America/Phoenix', '[1,2,3,4,5]', 9, 17, 30, 15, 24, '', 5000, 15000, 'USD', 'Collect payment manually and record it inside admin.', 1, ?, ?)
            """,
            (DEFAULT_ORG_SLUG, DEFAULT_ORG_NAME, "support@example.com", "(555) 010-2026", now, now),
        )
    org_id = int(conn.execute("SELECT id FROM organizations WHERE slug = ?", (DEFAULT_ORG_SLUG,)).fetchone()[0])

    rep_count = conn.execute("SELECT COUNT(*) FROM reps WHERE org_id = ?", (org_id,)).fetchone()[0]
    if rep_count == 0:
        reps = [
            (org_id, "Founder Desk", "founder@example.com", "(555) 010-2026", "admin", 1, 1, 1200, 0, "Founder-controlled desk", now, now),
            (org_id, "Scheduling Desk A", "setter-a@example.com", "(555) 010-2027", "setter", 1, 2, 1000, 0, "Primary booking desk", now, now),
            (org_id, "Scheduling Desk B", "setter-b@example.com", "(555) 010-2028", "setter", 1, 3, 1000, 0, "Overflow booking desk", now, now),
        ]
        conn.executemany(
            """
            INSERT INTO reps (org_id, name, email, phone, role, is_active, sort_order, commission_rate_bps, target_monthly_cents, payout_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            reps,
        )

    conn.execute(
        "INSERT OR IGNORE INTO routing_state (org_id, last_rep_id, updated_at) VALUES (?, NULL, ?)",
        (org_id, now),
    )

    if table_exists(conn, "leads"):
        conn.execute("UPDATE leads SET org_id = 1 WHERE org_id IS NULL OR org_id = 0")
        rows = conn.execute("SELECT id, phone FROM leads").fetchall()
        for row in rows:
            normalized = normalize_phone(row[1])
            conn.execute("UPDATE leads SET phone_normalized = ? WHERE id = ?", (normalized, int(row[0])))
    if table_exists(conn, "sessions"):
        conn.execute("UPDATE sessions SET org_id = 1 WHERE org_id IS NULL OR org_id = 0")
    if table_exists(conn, "appointments"):
        conn.execute("UPDATE appointments SET org_id = 1 WHERE org_id IS NULL OR org_id = 0")

    for user in default_admin_users():
        exists = conn.execute("SELECT id FROM admin_users WHERE email = ?", (user["email"],)).fetchone()
        if not exists:
            conn.execute(
                """
                INSERT INTO admin_users (
                    org_id, email, display_name, role, password_hash, require_password_change,
                    failed_login_count, locked_until, password_changed_at, is_active, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 0, '', '', 1, ?, ?)
                """,
                (
                    int(user.get("org_id") or org_id),
                    user["email"],
                    user["display_name"],
                    user["role"],
                    user["password_hash"],
                    int(user.get("require_password_change", 1)),
                    now,
                    now,
                ),
            )



def seed_commercial_defaults(conn: sqlite3.Connection) -> None:
    now = utcnow_iso()
    row = conn.execute("SELECT id FROM organizations WHERE slug = ?", (DEFAULT_ORG_SLUG,)).fetchone()
    org_id = int(row[0]) if row else 1
    services = [
        {
            'slug': 'strategy-session',
            'name': 'Strategy Session',
            'description': 'A focused consultation to map the next move and define the service lane.',
            'base_price_cents': 25000,
            'deposit_cents': 7500,
            'duration_minutes': 45,
            'metadata': {'keywords': ['strategy', 'consulting', 'planning'], 'questions': ['What outcome do you need?', 'What timeline matters most?']},
        },
        {
            'slug': 'automation-audit',
            'name': 'Automation Audit',
            'description': 'Workflow and AI review for teams that want operational cleanup or automation depth.',
            'base_price_cents': 65000,
            'deposit_cents': 15000,
            'duration_minutes': 60,
            'metadata': {'keywords': ['automation', 'ai', 'workflow'], 'questions': ['What process is costing you the most time?', 'What systems are already in place?']},
        },
        {
            'slug': 'sales-ops-sprint',
            'name': 'Sales Ops Sprint',
            'description': 'A closer-focused sales and revenue operations lane for teams that need conversions and follow-through.',
            'base_price_cents': 85000,
            'deposit_cents': 20000,
            'duration_minutes': 60,
            'metadata': {'keywords': ['sales', 'closing', 'pipeline'], 'questions': ['Where are deals stalling?', 'What offers are you trying to move?']},
        },
    ]
    for item in services:
        row = conn.execute('SELECT id FROM services WHERE org_id = ? AND slug = ?', (org_id, item['slug'])).fetchone()
        if not row:
            conn.execute(
                'INSERT INTO services (org_id, slug, name, description, base_price_cents, deposit_cents, duration_minutes, active, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
                (org_id, item['slug'], item['name'], item['description'], item['base_price_cents'], item['deposit_cents'], item['duration_minutes'], json.dumps(item['metadata']), now, now),
            )
    packages = [
        {
            'slug': 'starter-launch-pack',
            'name': 'Starter Launch Pack',
            'description': 'A lightweight package for teams that need one call, a working plan, and a booked execution lane.',
            'total_price_cents': 95000,
            'deposit_cents': 20000,
            'metadata': {'included_service_slugs': ['strategy-session']},
        },
        {
            'slug': 'growth-automation-pack',
            'name': 'Growth Automation Pack',
            'description': 'A deeper package for automation, sales follow-up, and conversion cleanup.',
            'total_price_cents': 185000,
            'deposit_cents': 35000,
            'metadata': {'included_service_slugs': ['automation-audit', 'sales-ops-sprint']},
        },
    ]
    for item in packages:
        row = conn.execute('SELECT id FROM packages WHERE org_id = ? AND slug = ?', (org_id, item['slug'])).fetchone()
        if not row:
            conn.execute(
                'INSERT INTO packages (org_id, slug, name, description, total_price_cents, deposit_cents, active, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
                (org_id, item['slug'], item['name'], item['description'], item['total_price_cents'], item['deposit_cents'], json.dumps(item['metadata']), now, now),
            )


def seed_playbook_defaults(conn: sqlite3.Connection) -> None:
    now = utcnow_iso()
    row = conn.execute("SELECT id FROM organizations WHERE slug = ?", (DEFAULT_ORG_SLUG,)).fetchone()
    org_id = int(row[0]) if row else 1
    defaults = [
        {
            'name': 'Fresh lead reachback',
            'channel': 'email',
            'subject_template': 'Quick follow-up for {service_interest}',
            'body_template': 'Hi {lead_name},\n\nI wanted to follow up on your {service_interest} request for {business_name}. The fastest next step is to lock a time here: {manage_url}\n\nIf you want to reply directly, send the best window and we will line it up.\n\n– {assigned_owner}',
            'tags': ['follow-up', 'fresh-lead'],
        },
        {
            'name': 'Same-day SMS nudge',
            'channel': 'sms',
            'subject_template': '',
            'body_template': 'Hi {first_name}, this is {assigned_owner}. I can still help with {service_interest}. Use {manage_url} to pick or manage a slot, or reply with your best time.',
            'tags': ['sms', 'same-day'],
        },
        {
            'name': 'Deposit reminder',
            'channel': 'email',
            'subject_template': 'Deposit reminder for {service_interest}',
            'body_template': 'Hi {lead_name},\n\nYour next step is still open for {service_interest}. Current balance: {outstanding_balance}.\n\nManage the appointment here: {manage_url}\n\nIf you already handled it, just reply and we will mark it cleanly.\n\n– {assigned_owner}',
            'tags': ['billing', 'reminder'],
        },
    ]
    for item in defaults:
        row = conn.execute('SELECT id FROM playbooks WHERE org_id = ? AND name = ?', (org_id, item['name'])).fetchone()
        if not row:
            conn.execute(
                'INSERT INTO playbooks (org_id, name, channel, subject_template, body_template, tags_json, active, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)',
                (org_id, item['name'], item['channel'], item['subject_template'], item['body_template'], json.dumps(item['tags']), now, now),
            )


def list_org_presets() -> list[dict[str, Any]]:
    return [
        {
            'slug': slug,
            'name': str(config.get('name') or slug),
            'description': str(config.get('description') or ''),
            'service_count': len(list(config.get('services') or [])),
            'package_count': len(list(config.get('packages') or [])),
            'playbook_count': len(list(config.get('playbooks') or [])),
            'rep_count': len(list(config.get('reps') or [])),
            'service_names': [str(item.get('name') or '') for item in list(config.get('services') or [])],
            'package_names': [str(item.get('name') or '') for item in list(config.get('packages') or [])],
            'playbook_names': [str(item.get('name') or '') for item in list(config.get('playbooks') or [])],
            'rep_names': [str(item.get('name') or '') for item in list(config.get('reps') or [])],
        }
        for slug, config in ORG_PRESETS.items()
    ]


def get_org_preset(preset_slug: str) -> dict[str, Any] | None:
    return ORG_PRESETS.get(str(preset_slug or '').strip())


def apply_org_preset(org_id: int, preset_slug: str, include_reps: bool = True) -> dict[str, Any]:
    preset = get_org_preset(preset_slug)
    if not preset:
        raise ValueError('Unknown org preset.')
    org = get_org(org_id) or {}
    if not org:
        raise ValueError('Organization not found.')
    applied = {'settings': 0, 'services': 0, 'packages': 0, 'playbooks': 0, 'reps': 0}
    updates = dict(preset.get('org_updates') or {})
    if updates:
        update_org(org_id, updates)
        applied['settings'] = 1
    now = utcnow_iso()
    with connect() as conn:
        for item in list(preset.get('services') or []):
            slug = str(item.get('slug') or '').strip()
            if not slug:
                continue
            row = conn.execute('SELECT id FROM services WHERE org_id = ? AND slug = ?', (org_id, slug)).fetchone()
            if row:
                continue
            conn.execute('INSERT INTO services (org_id, slug, name, description, base_price_cents, deposit_cents, duration_minutes, active, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
                (org_id, slug, str(item.get('name') or '').strip(), str(item.get('description') or '').strip(), int(item.get('base_price_cents') or 0), int(item.get('deposit_cents') or 0), int(item.get('duration_minutes') or 30), json.dumps(item.get('metadata') or {}), now, now))
            applied['services'] += 1
        for item in list(preset.get('packages') or []):
            slug = str(item.get('slug') or '').strip()
            if not slug:
                continue
            row = conn.execute('SELECT id FROM packages WHERE org_id = ? AND slug = ?', (org_id, slug)).fetchone()
            if row:
                continue
            conn.execute('INSERT INTO packages (org_id, slug, name, description, total_price_cents, deposit_cents, active, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
                (org_id, slug, str(item.get('name') or '').strip(), str(item.get('description') or '').strip(), int(item.get('total_price_cents') or 0), int(item.get('deposit_cents') or 0), json.dumps(item.get('metadata') or {}), now, now))
            applied['packages'] += 1
        for item in list(preset.get('playbooks') or []):
            name = str(item.get('name') or '').strip()
            if not name:
                continue
            row = conn.execute('SELECT id FROM playbooks WHERE org_id = ? AND name = ?', (org_id, name)).fetchone()
            if row:
                continue
            conn.execute('INSERT INTO playbooks (org_id, name, channel, subject_template, body_template, tags_json, active, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)',
                (org_id, name, str(item.get('channel') or 'email').strip() or 'email', str(item.get('subject_template') or '').strip(), str(item.get('body_template') or '').strip(), json.dumps(item.get('tags') or []), now, now))
            applied['playbooks'] += 1
        if include_reps:
            existing_reps = {(str(item.get('email') or '').strip().lower(), str(item.get('name') or '').strip().lower()) for item in list_reps(org_id)}
            for item in list(preset.get('reps') or []):
                name = str(item.get('name') or '').strip()
                if not name:
                    continue
                email = str(item.get('email') or '').strip()
                key = (email.lower(), name.lower())
                if key in existing_reps:
                    continue
                conn.execute(
                    """
                    INSERT INTO reps (org_id, name, email, phone, role, is_active, sort_order, commission_rate_bps, target_monthly_cents, payout_notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        org_id,
                        name,
                        email,
                        str(item.get('phone') or '').strip(),
                        str(item.get('role') or 'setter').strip() or 'setter',
                        int(item.get('is_active', 1) or 0),
                        int(item.get('sort_order') or 0),
                        int(item.get('commission_rate_bps') or 1000),
                        int(item.get('target_monthly_cents') or 0),
                        str(item.get('payout_notes') or '').strip(),
                        now,
                        now,
                    ),
                )
                existing_reps.add(key)
                applied['reps'] += 1
    return {'preset': {'slug': preset_slug, 'name': str(preset.get('name') or preset_slug)}, 'applied': applied, 'org': get_org(org_id) or org}


def get_org_onboarding_plan(org_id: int, preset_slug: str = '') -> dict[str, Any]:
    readiness = get_org_readiness(org_id)
    org = readiness.get('org') or {}
    preset_slug = str(preset_slug or '').strip() or 'general-consulting'
    preset = get_org_preset(preset_slug) or {}
    item_map = {str(item.get('key') or ''): item for item in list(readiness.get('items') or [])}

    def stage_for(stage_key: str, title: str, description: str, task_keys: list[str], preset_hint: str = '') -> dict[str, Any]:
        tasks: list[dict[str, Any]] = []
        for key in task_keys:
            item = item_map.get(key) or {}
            tasks.append({
                'key': key,
                'label': str(item.get('label') or key.replace('_', ' ').title()),
                'done': bool(item.get('done')),
                'detail': str(item.get('detail') or ''),
                'autofixable': key != 'support_contact',
            })
        done_count = sum(1 for item in tasks if item.get('done'))
        total_count = len(tasks)
        percent_complete = round((done_count / total_count) * 100) if total_count else 100
        next_actions = [str(item.get('label') or '') for item in tasks if not item.get('done')][:3]
        return {
            'key': stage_key,
            'title': title,
            'description': description,
            'done_count': done_count,
            'total_count': total_count,
            'percent_complete': percent_complete,
            'complete': done_count == total_count,
            'next_actions': next_actions,
            'preset_hint': preset_hint,
            'tasks': tasks,
        }

    preset_name = str(preset.get('name') or preset_slug or 'preset')
    stages = [
        stage_for(
            'foundation',
            'Desk foundation',
            'Lock the operator-facing basics so this desk can accept real bookings cleanly.',
            ['support_contact', 'hours', 'booking_notice', 'payment_instructions'],
            'Autofix can seed hours, booking notice, and payment instructions. Support contact still needs a real desk email or phone.',
        ),
        stage_for(
            'commercial',
            'Commercial catalog',
            f'Seed the sellable surface using the {preset_name} pack so this desk is not empty at launch.',
            ['catalog', 'playbooks'],
            f"Preset pack '{preset_slug}' can seed services, packages, and playbooks for this stage." if preset else 'Preset packs can seed services, packages, and playbooks for this stage.',
        ),
        stage_for(
            'staffing',
            'Desk staffing and autonomy',
            'Make sure the desk has a human owner and the autonomy lane can follow through when people are not actively inside the inbox.',
            ['reps', 'autonomy'],
            'Autofix can seed rep structure and autonomy defaults when those lanes are still missing.',
        ),
    ]
    overall_percent = int(readiness.get('percent_complete') or 0)
    next_focus = list(readiness.get('next_steps') or [])
    summary_lines = [
        f"Desk: {str(org.get('name') or 'Desk').strip()}",
        f"Readiness: {overall_percent}% ({int(readiness.get('completed_count') or 0)}/{int(readiness.get('total_count') or 0)} items)",
        f"Preset lane: {preset_name}",
    ]
    if next_focus:
        summary_lines.append('Next focus: ' + ' · '.join(next_focus))
    return {
        'org': org,
        'preset': {
            'slug': preset_slug,
            'name': preset_name,
            'description': str(preset.get('description') or ''),
            'service_count': len(list(preset.get('services') or [])),
            'package_count': len(list(preset.get('packages') or [])),
            'playbook_count': len(list(preset.get('playbooks') or [])),
            'rep_count': len(list(preset.get('reps') or [])),
        },
        'readiness': readiness,
        'stages': stages,
        'summary_text': '\n'.join(summary_lines),
        'generated_at': utcnow_iso(),
    }

def get_org_readiness(org_id: int) -> dict[str, Any]:
    org = get_org(org_id) or {}
    if not org:
        raise ValueError('Organization not found.')
    services = list_services(org_id)
    packages = list_packages(org_id)
    playbooks = list_playbooks(org_id)
    reps = list_reps(org_id)
    items = [
        {
            'key': 'support_contact',
            'label': 'Support contact is present',
            'done': bool(str(org.get('support_email') or '').strip() or str(org.get('support_phone') or '').strip()),
            'detail': f"{str(org.get('support_email') or '').strip() or 'No support email'} · {str(org.get('support_phone') or '').strip() or 'No support phone'}",
        },
        {
            'key': 'catalog',
            'label': 'Commercial catalog exists',
            'done': bool(services or packages),
            'detail': f"{len(services)} services · {len(packages)} packages",
        },
        {
            'key': 'playbooks',
            'label': 'Outbound playbooks are seeded',
            'done': len(playbooks) > 0,
            'detail': f"{len(playbooks)} playbooks",
        },
        {
            'key': 'reps',
            'label': 'Rep desk is staffed',
            'done': len(reps) > 0,
            'detail': f"{len(reps)} reps",
        },
        {
            'key': 'hours',
            'label': 'Booking hours are configured',
            'done': int(org.get('open_hour') or 0) < int(org.get('close_hour') or 0),
            'detail': f"Open {int(org.get('open_hour') or 0)} · Close {int(org.get('close_hour') or 0)} · Slot {int(org.get('slot_minutes') or 0)} min",
        },
        {
            'key': 'payment_instructions',
            'label': 'Payment instructions are set',
            'done': bool(str(org.get('payment_instructions') or '').strip()),
            'detail': str(org.get('payment_instructions') or '').strip()[:120] or 'No payment instructions yet.',
        },
        {
            'key': 'booking_notice',
            'label': 'Booking notice is set',
            'done': bool(str(org.get('booking_notice') or '').strip()),
            'detail': str(org.get('booking_notice') or '').strip()[:120] or 'No booking notice yet.',
        },
        {
            'key': 'autonomy',
            'label': 'Autonomy follow-up is enabled',
            'done': bool(int(org.get('autonomy_enabled') or 0)),
            'detail': 'Autonomy is active.' if bool(int(org.get('autonomy_enabled') or 0)) else 'Autonomy is off.',
        },
    ]
    completed = sum(1 for item in items if item['done'])
    total = len(items)
    percent = round((completed / total) * 100) if total else 0
    next_steps = [item['label'] for item in items if not item['done']][:4]
    return {
        'org': org,
        'counts': {
            'services': len(services),
            'packages': len(packages),
            'playbooks': len(playbooks),
            'reps': len(reps),
        },
        'settings': {
            'timezone': org.get('timezone') or 'America/Phoenix',
            'currency': org.get('currency') or 'USD',
            'payment_instructions': org.get('payment_instructions') or '',
        },
        'completed_count': completed,
        'total_count': total,
        'percent_complete': percent,
        'items': items,
        'next_steps': next_steps,
    }





def autofix_org_readiness(org_id: int, preset_slug: str = '', seed_reps: bool = True) -> dict[str, Any]:
    org = get_org(org_id) or {}
    if not org:
        raise ValueError('Organization not found.')
    before = get_org_readiness(org_id)
    preset_slug = str(preset_slug or '').strip() or 'general-consulting'
    preset = get_org_preset(preset_slug) or {}
    preset_updates = dict(preset.get('org_updates') or {})
    item_map = {str(item.get('key') or ''): item for item in list(before.get('items') or [])}
    updates: dict[str, Any] = {}
    preset_result = None
    seeded_rep = None
    skipped: list[str] = []

    needs_catalog = not bool((item_map.get('catalog') or {}).get('done'))
    needs_playbooks = not bool((item_map.get('playbooks') or {}).get('done'))
    needs_reps = not bool((item_map.get('reps') or {}).get('done'))
    if needs_catalog or needs_playbooks or (seed_reps and needs_reps):
        try:
            preset_result = apply_org_preset(org_id, preset_slug, include_reps=seed_reps)
        except ValueError:
            skipped.append(f'Preset {preset_slug} could not be applied.')

    if not bool((item_map.get('hours') or {}).get('done')):
        updates['open_hour'] = int(preset_updates.get('open_hour') or 9)
        updates['close_hour'] = int(preset_updates.get('close_hour') or 17)
        updates['slot_minutes'] = int(preset_updates.get('slot_minutes') or 30)
        updates['buffer_minutes'] = int(preset_updates.get('buffer_minutes') or 15)
        updates['reminder_lead_hours'] = int(preset_updates.get('reminder_lead_hours') or 24)
    if not bool((item_map.get('payment_instructions') or {}).get('done')):
        updates['payment_instructions'] = str(preset_updates.get('payment_instructions') or 'Reply to the desk before sending payment so the correct invoice can be matched and marked cleanly.').strip()
    if not bool((item_map.get('booking_notice') or {}).get('done')):
        updates['booking_notice'] = str(preset_updates.get('booking_notice') or 'Bring the exact scope, timing, and decision-maker details you want handled so the desk can route the appointment correctly.').strip()
    if not bool((item_map.get('autonomy') or {}).get('done')):
        updates['autonomy_enabled'] = 1
        updates['auto_followup_hours'] = int(preset_updates.get('auto_followup_hours') or 24)
        updates['auto_noshow_minutes'] = int(preset_updates.get('auto_noshow_minutes') or 90)
        updates['auto_invoice_followup_hours'] = int(preset_updates.get('auto_invoice_followup_hours') or 48)
        updates['auto_intake_followup_hours'] = int(preset_updates.get('auto_intake_followup_hours') or 24)
    if updates:
        update_org(org_id, updates)

    after_preset = get_org_readiness(org_id)
    item_map_after = {str(item.get('key') or ''): item for item in list(after_preset.get('items') or [])}
    if seed_reps and not bool((item_map_after.get('reps') or {}).get('done')):
        seeded_rep = create_rep({
            'org_id': org_id,
            'name': f"{str(org.get('name') or 'Desk').strip()} Operator",
            'email': str(org.get('support_email') or '').strip(),
            'phone': str(org.get('support_phone') or '').strip(),
            'role': 'admin',
            'commission_rate_bps': 0,
            'target_monthly_cents': 0,
            'payout_notes': 'Seeded automatically by readiness autofix.',
            'sort_order': 0,
            'is_active': 1,
        })
    final = get_org_readiness(org_id)
    final_item_map = {str(item.get('key') or ''): item for item in list(final.get('items') or [])}
    if not bool((final_item_map.get('support_contact') or {}).get('done')):
        skipped.append('Support contact still needs a real email or phone.')
    return {
        'org': get_org(org_id) or org,
        'before': before,
        'after': final,
        'preset': {'slug': preset_slug, 'name': str(preset.get('name') or preset_slug)} if preset else None,
        'preset_result': preset_result,
        'settings_applied': updates,
        'seeded_rep': seeded_rep,
        'skipped': skipped,
    }

def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    result = dict(row)
    if "tags_json" in result:
        try:
            result["tags"] = json.loads(result.pop("tags_json") or "[]")
        except json.JSONDecodeError:
            result["tags"] = []
    if "filters_json" in result:
        try:
            result["filters"] = json.loads(result.pop("filters_json") or "{}")
        except json.JSONDecodeError:
            result["filters"] = {}
    if "metadata_json" in result:
        try:
            result["metadata"] = json.loads(result.pop("metadata_json") or "{}")
        except json.JSONDecodeError:
            result["metadata"] = {}
    if "payload_json" in result:
        try:
            result["payload"] = json.loads(result.pop("payload_json") or "{}")
        except json.JSONDecodeError:
            result["payload"] = {}
    if "preferences_json" in result:
        try:
            result["preferences"] = json.loads(result.pop("preferences_json") or "[]")
        except json.JSONDecodeError:
            result["preferences"] = []
    if "objections_json" in result:
        try:
            result["objections"] = json.loads(result.pop("objections_json") or "[]")
        except json.JSONDecodeError:
            result["objections"] = []
    return result



def list_rows(query: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()
    return [row_to_dict(row) for row in rows if row is not None]



def get_row(query: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(query, tuple(params)).fetchone()
    return row_to_dict(row)



def get_default_org_id() -> int:
    org = get_org_by_slug(DEFAULT_ORG_SLUG)
    return int(org["id"]) if org else 1



def get_org(org_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM organizations WHERE id = ?", (org_id,))



def get_org_by_slug(slug: str) -> dict[str, Any] | None:
    slug = slug or DEFAULT_ORG_SLUG
    return get_row("SELECT * FROM organizations WHERE slug = ?", (slug,))



def list_orgs() -> list[dict[str, Any]]:
    return list_rows("SELECT * FROM organizations WHERE active = 1 ORDER BY id ASC")



def create_org(fields: dict[str, Any]) -> dict[str, Any] | None:
    now = utcnow_iso()
    name = str(fields.get('name') or '').strip()
    if not name:
        raise ValueError('Organization name is required.')
    slug_raw = str(fields.get('slug') or name).strip().lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug_raw).strip('-') or f'org-{int(datetime.utcnow().timestamp())}'
    if get_org_by_slug(slug):
        raise ValueError('Organization slug is already in use.')
    support_email = str(fields.get('support_email') or '').strip()
    support_phone = str(fields.get('support_phone') or '').strip()
    timezone = str(fields.get('timezone') or 'America/Phoenix').strip() or 'America/Phoenix'
    operating_days = fields.get('operating_days')
    if not isinstance(operating_days, list):
        operating_days = [1, 2, 3, 4, 5]
    open_hour = int(fields.get('open_hour') or 9)
    close_hour = int(fields.get('close_hour') or 17)
    slot_minutes = int(fields.get('slot_minutes') or 30)
    buffer_minutes = int(fields.get('buffer_minutes') or 15)
    reminder_lead_hours = int(fields.get('reminder_lead_hours') or 24)
    autonomy_enabled = 1 if bool(fields.get('autonomy_enabled', True)) else 0
    auto_followup_hours = int(fields.get('auto_followup_hours') or 24)
    auto_noshow_minutes = int(fields.get('auto_noshow_minutes') or 90)
    auto_invoice_followup_hours = int(fields.get('auto_invoice_followup_hours') or 48)
    auto_intake_followup_hours = int(fields.get('auto_intake_followup_hours') or 24)
    booking_notice = str(fields.get('booking_notice') or '').strip()
    default_deposit_cents = int(fields.get('default_deposit_cents') or 0)
    default_service_price_cents = int(fields.get('default_service_price_cents') or 0)
    currency = str(fields.get('currency') or 'USD').strip() or 'USD'
    payment_instructions = str(fields.get('payment_instructions') or '').strip()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO organizations (
                slug, name, support_email, support_phone, timezone, operating_days_json,
                open_hour, close_hour, slot_minutes, buffer_minutes, reminder_lead_hours,
                autonomy_enabled, auto_followup_hours, auto_noshow_minutes, auto_invoice_followup_hours, auto_intake_followup_hours,
                booking_notice, default_deposit_cents, default_service_price_cents, currency, payment_instructions, active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                slug, name, support_email, support_phone, timezone, json.dumps(operating_days),
                open_hour, close_hour, slot_minutes, buffer_minutes, reminder_lead_hours,
                autonomy_enabled, auto_followup_hours, auto_noshow_minutes, auto_invoice_followup_hours, auto_intake_followup_hours,
                booking_notice, default_deposit_cents, default_service_price_cents, currency, payment_instructions, now, now,
            ),
        )
        org_id = int(cur.lastrowid)
        conn.execute(
            "INSERT OR IGNORE INTO routing_state (org_id, last_rep_id, updated_at) VALUES (?, NULL, ?)",
            (org_id, now),
        )
        conn.execute(
            """
            INSERT INTO reps (org_id, name, email, phone, role, is_active, sort_order, commission_rate_bps, target_monthly_cents, payout_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'admin', 1, 1, 1200, 0, 'Desk owner', ?, ?)
            """,
            (org_id, f'{name} Owner Desk', support_email, support_phone, now, now),
        )
    return get_org(org_id)


def clone_org_template(target_org_id: int, source_org_id: int, options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or {}
    target_org = get_org(target_org_id) or {}
    source_org = get_org(source_org_id) or {}
    if not target_org or not source_org:
        raise ValueError('Both source and target organizations must exist.')
    cloned: dict[str, int] = {'services': 0, 'packages': 0, 'playbooks': 0, 'reps': 0, 'settings': 0}
    if bool(options.get('clone_settings', True)):
        update_org(target_org_id, {
            'support_email': source_org.get('support_email') or target_org.get('support_email') or '',
            'support_phone': source_org.get('support_phone') or target_org.get('support_phone') or '',
            'timezone': source_org.get('timezone') or target_org.get('timezone') or 'America/Phoenix',
            'operating_days_json': json.dumps(source_org.get('operating_days') or [1, 2, 3, 4, 5]),
            'open_hour': int(source_org.get('open_hour') or 9),
            'close_hour': int(source_org.get('close_hour') or 17),
            'slot_minutes': int(source_org.get('slot_minutes') or 30),
            'buffer_minutes': int(source_org.get('buffer_minutes') or 15),
            'reminder_lead_hours': int(source_org.get('reminder_lead_hours') or 24),
            'autonomy_enabled': 1 if bool(source_org.get('autonomy_enabled')) else 0,
            'auto_followup_hours': int(source_org.get('auto_followup_hours') or 24),
            'auto_noshow_minutes': int(source_org.get('auto_noshow_minutes') or 90),
            'auto_invoice_followup_hours': int(source_org.get('auto_invoice_followup_hours') or 48),
            'auto_intake_followup_hours': int(source_org.get('auto_intake_followup_hours') or 24),
            'booking_notice': str(source_org.get('booking_notice') or ''),
            'default_deposit_cents': int(source_org.get('default_deposit_cents') or 0),
            'default_service_price_cents': int(source_org.get('default_service_price_cents') or 0),
            'currency': str(source_org.get('currency') or target_org.get('currency') or 'USD'),
            'payment_instructions': str(source_org.get('payment_instructions') or ''),
        })
        cloned['settings'] = 1
    if bool(options.get('clone_services', True)):
        existing = {str(item.get('slug') or '') for item in list_services(target_org_id)}
        for service in list_services(source_org_id):
            slug = str(service.get('slug') or '').strip()
            if not slug or slug in existing:
                continue
            create_service({
                'org_id': target_org_id,
                'slug': slug,
                'name': service.get('name') or '',
                'description': service.get('description') or '',
                'base_price_cents': int(service.get('base_price_cents') or 0),
                'deposit_cents': int(service.get('deposit_cents') or 0),
                'duration_minutes': int(service.get('duration_minutes') or 30),
                'active': bool(service.get('active', True)),
                'metadata': service.get('metadata') or {},
            })
            existing.add(slug)
            cloned['services'] += 1
    if bool(options.get('clone_packages', True)):
        existing = {str(item.get('slug') or '') for item in list_packages(target_org_id)}
        for package in list_packages(source_org_id):
            slug = str(package.get('slug') or '').strip()
            if not slug or slug in existing:
                continue
            create_package({
                'org_id': target_org_id,
                'slug': slug,
                'name': package.get('name') or '',
                'description': package.get('description') or '',
                'total_price_cents': int(package.get('total_price_cents') or 0),
                'deposit_cents': int(package.get('deposit_cents') or 0),
                'active': bool(package.get('active', True)),
                'metadata': package.get('metadata') or {},
            })
            existing.add(slug)
            cloned['packages'] += 1
    if bool(options.get('clone_playbooks', True)):
        existing = {(str(item.get('name') or '').strip().lower(), str(item.get('channel') or '').strip().lower()) for item in list_playbooks(target_org_id)}
        for playbook in list_playbooks(source_org_id):
            key = (str(playbook.get('name') or '').strip().lower(), str(playbook.get('channel') or '').strip().lower())
            if not key[0] or key in existing:
                continue
            create_playbook({
                'org_id': target_org_id,
                'name': playbook.get('name') or '',
                'channel': playbook.get('channel') or 'email',
                'subject_template': playbook.get('subject_template') or '',
                'body_template': playbook.get('body_template') or '',
                'tags': playbook.get('tags') or [],
                'active': bool(playbook.get('active', True)),
                'created_by_user_id': None,
            })
            existing.add(key)
            cloned['playbooks'] += 1
    if bool(options.get('clone_reps', False)):
        existing = {(str(item.get('email') or '').strip().lower(), str(item.get('name') or '').strip().lower()) for item in list_reps(target_org_id)}
        for rep in list_reps(source_org_id):
            key = (str(rep.get('email') or '').strip().lower(), str(rep.get('name') or '').strip().lower())
            if key in existing:
                continue
            create_rep({
                'org_id': target_org_id,
                'name': rep.get('name') or '',
                'email': rep.get('email') or '',
                'phone': rep.get('phone') or '',
                'role': rep.get('role') or 'setter',
                'is_active': bool(rep.get('is_active', True)),
                'sort_order': int(rep.get('sort_order') or 0),
                'commission_rate_bps': int(rep.get('commission_rate_bps') or 0),
                'target_monthly_cents': int(rep.get('target_monthly_cents') or 0),
                'payout_notes': rep.get('payout_notes') or '',
            })
            existing.add(key)
            cloned['reps'] += 1
    return {
        'target_org_id': target_org_id,
        'source_org_id': source_org_id,
        'cloned': cloned,
    }



def update_org(org_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {
        'name',
        'support_email',
        'support_phone',
        'timezone',
        'operating_days_json',
        'open_hour',
        'close_hour',
        'slot_minutes',
        'buffer_minutes',
        'reminder_lead_hours',
        'autonomy_enabled',
        'auto_followup_hours',
        'auto_noshow_minutes',
        'auto_invoice_followup_hours',
        'auto_intake_followup_hours',
        'booking_notice',
        'default_deposit_cents',
        'default_service_price_cents',
        'currency',
        'payment_instructions',
        'active',
    }
    clean = {key: value for key, value in fields.items() if key in allowed}
    if not clean:
        return get_org(org_id)
    clean['updated_at'] = utcnow_iso()
    assignments = ", ".join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [org_id]
    with connect() as conn:
        conn.execute(f"UPDATE organizations SET {assignments} WHERE id = ?", tuple(params))
    return get_org(org_id)



def resolve_org_id(org_id: int | None = None, org_slug: str | None = None) -> int:
    if org_id:
        return int(org_id)
    if org_slug:
        org = get_org_by_slug(org_slug)
        if org:
            return int(org["id"])
    return get_default_org_id()



def list_reps(org_id: int | None = None) -> list[dict[str, Any]]:
    if org_id:
        return list_rows("SELECT * FROM reps WHERE org_id = ? ORDER BY sort_order ASC, id ASC", (org_id,))
    return list_rows("SELECT * FROM reps ORDER BY org_id ASC, sort_order ASC, id ASC")



def create_rep(fields: dict[str, Any]) -> dict[str, Any] | None:
    now = utcnow_iso()
    org_id = resolve_org_id(fields.get('org_id'), fields.get('org_slug'))
    name = str(fields.get('name') or '').strip()
    if not name:
        raise ValueError('Rep name is required.')
    sort_order = int(fields.get('sort_order') or 0)
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO reps (org_id, name, email, phone, role, is_active, sort_order, commission_rate_bps, target_monthly_cents, payout_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                org_id,
                name,
                str(fields.get('email') or '').strip(),
                str(fields.get('phone') or '').strip(),
                str(fields.get('role') or 'setter').strip() or 'setter',
                int(fields.get('is_active', 1) or 0),
                sort_order,
                int(fields.get('commission_rate_bps') or 1000),
                int(fields.get('target_monthly_cents') or 0),
                str(fields.get('payout_notes') or '').strip(),
                now,
                now,
            ),
        )
        rep_id = int(cur.lastrowid)
    return get_rep(rep_id)



def update_rep(rep_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {'name', 'email', 'phone', 'role', 'is_active', 'sort_order', 'commission_rate_bps', 'target_monthly_cents', 'payout_notes'}
    clean = {key: value for key, value in fields.items() if key in allowed}
    if not clean:
        return get_rep(rep_id)
    clean['updated_at'] = utcnow_iso()
    assignments = ', '.join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [rep_id]
    with connect() as conn:
        conn.execute(f"UPDATE reps SET {assignments} WHERE id = ?", tuple(params))
    return get_rep(rep_id)



def get_rep(rep_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM reps WHERE id = ?", (rep_id,))



def next_rep_for_org(org_id: int) -> dict[str, Any] | None:
    reps = [rep for rep in list_reps(org_id) if int(rep.get("is_active", 1)) == 1]
    if not reps:
        return None
    state = get_row("SELECT * FROM routing_state WHERE org_id = ?", (org_id,)) or {}
    last_rep_id = int(state.get("last_rep_id") or 0)
    next_index = 0
    if last_rep_id:
        for idx, rep in enumerate(reps):
            if int(rep["id"]) == last_rep_id:
                next_index = (idx + 1) % len(reps)
                break
    chosen = reps[next_index]
    with connect() as conn:
        conn.execute(
            "INSERT INTO routing_state (org_id, last_rep_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(org_id) DO UPDATE SET last_rep_id = excluded.last_rep_id, updated_at = excluded.updated_at",
            (org_id, int(chosen["id"]), utcnow_iso()),
        )
    return chosen



def apply_scope(base_query: str, org_id: int | None = None, extra_params: Iterable[Any] = ()) -> tuple[str, tuple[Any, ...]]:
    params = tuple(extra_params)
    if org_id:
        if " WHERE " in base_query.upper():
            return base_query + " AND org_id = ?", params + (org_id,)
        return base_query + " WHERE org_id = ?", params + (org_id,)
    return base_query, params



def create_lead(payload: dict[str, Any]) -> dict[str, Any]:
    now = utcnow_iso()
    tags = payload.get("tags") or []
    org_id = resolve_org_id(payload.get("org_id"), payload.get("org_slug"))
    rep = None
    assigned_rep_id = payload.get("assigned_rep_id")
    assigned_owner = str(payload.get("assigned_owner", "")).strip()
    if assigned_rep_id:
        rep = get_rep(int(assigned_rep_id))
    if rep is None:
        rep = next_rep_for_org(org_id)
    if rep:
        assigned_rep_id = int(rep["id"])
        if not assigned_owner:
            assigned_owner = str(rep.get("name") or "Founder Desk")
    if not assigned_owner:
        assigned_owner = "Founder Desk"

    phone = str(payload.get("phone", "")).strip()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO leads (
                org_id, assigned_rep_id, name, email, phone, phone_normalized, business_name, service_interest, urgency,
                preferred_schedule, timezone, qualification_status, source, notes, tags_json,
                assigned_owner, last_contacted_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                org_id,
                assigned_rep_id,
                str(payload.get("name", "")).strip(),
                str(payload.get("email", "")).strip(),
                phone,
                normalize_phone(phone),
                str(payload.get("business_name", "")).strip(),
                str(payload.get("service_interest", "")).strip(),
                str(payload.get("urgency", "")).strip(),
                str(payload.get("preferred_schedule", "")).strip(),
                str(payload.get("timezone", "America/Phoenix")).strip() or "America/Phoenix",
                str(payload.get("qualification_status", "new")),
                str(payload.get("source", "website")).strip() or "website",
                str(payload.get("notes", "")).strip(),
                json.dumps(tags),
                assigned_owner,
                now,
                now,
                now,
            ),
        )
        lead_id = cur.lastrowid
    return get_lead(int(lead_id))  # type: ignore[arg-type]



def get_lead(lead_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM leads WHERE id = ?", (lead_id,))



def get_lead_by_phone(phone: str) -> dict[str, Any] | None:
    normalized = normalize_phone(phone)
    if not normalized:
        return None
    return get_row("SELECT * FROM leads WHERE phone_normalized = ? ORDER BY id DESC LIMIT 1", (normalized,))


def create_lead_view(fields: dict[str, Any]) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO lead_views (org_id, name, filters_json, is_shared, created_by_user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(fields.get('org_id') or 0) or None,
                str(fields.get('name') or '').strip(),
                json.dumps(fields.get('filters') or {}),
                1 if bool(fields.get('is_shared', True)) else 0,
                int(fields.get('created_by_user_id') or 0) or None,
                now,
                now,
            ),
        )
        view_id = cur.lastrowid
    return get_lead_view(int(view_id))


def get_lead_view(view_id: int) -> dict[str, Any] | None:
    return get_row('SELECT * FROM lead_views WHERE id = ?', (view_id,))


def list_lead_views(org_id: int | None = None, created_by_user_id: int | None = None) -> list[dict[str, Any]]:
    clauses = []
    params: list[Any] = []
    if org_id:
        clauses.append('(org_id = ? OR org_id IS NULL)')
        params.append(org_id)
    if created_by_user_id:
        clauses.append('(is_shared = 1 OR created_by_user_id = ?)')
        params.append(created_by_user_id)
    query = 'SELECT * FROM lead_views'
    if clauses:
        query += ' WHERE ' + ' AND '.join(clauses)
    query += ' ORDER BY name COLLATE NOCASE ASC, id DESC'
    return list_rows(query, tuple(params))


def delete_lead_view(view_id: int) -> None:
    with connect() as conn:
        conn.execute('DELETE FROM lead_views WHERE id = ?', (view_id,))


def create_playbook(fields: dict[str, Any]) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO playbooks (org_id, name, channel, subject_template, body_template, tags_json, active, created_by_user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(fields.get('org_id') or 0) or None,
                str(fields.get('name') or '').strip(),
                str(fields.get('channel') or 'email').strip() or 'email',
                str(fields.get('subject_template') or '').strip(),
                str(fields.get('body_template') or '').strip(),
                json.dumps(fields.get('tags') or []),
                1 if bool(fields.get('active', True)) else 0,
                int(fields.get('created_by_user_id') or 0) or None,
                now,
                now,
            ),
        )
        playbook_id = cur.lastrowid
    return get_playbook(int(playbook_id))


def get_playbook(playbook_id: int) -> dict[str, Any] | None:
    return get_row('SELECT * FROM playbooks WHERE id = ?', (playbook_id,))


def list_playbooks(org_id: int | None = None, created_by_user_id: int | None = None, active_only: bool = False) -> list[dict[str, Any]]:
    clauses = []
    params: list[Any] = []
    if org_id:
        clauses.append('(org_id = ? OR org_id IS NULL)')
        params.append(org_id)
    if created_by_user_id:
        clauses.append('(active = 1 OR created_by_user_id = ?)')
        params.append(created_by_user_id)
    if active_only:
        clauses.append('active = 1')
    query = 'SELECT * FROM playbooks'
    if clauses:
        query += ' WHERE ' + ' AND '.join(clauses)
    query += ' ORDER BY name COLLATE NOCASE ASC, id DESC'
    return list_rows(query, tuple(params))


def delete_playbook(playbook_id: int) -> None:
    with connect() as conn:
        conn.execute('DELETE FROM playbooks WHERE id = ?', (playbook_id,))


def list_leads(org_id: int | None = None) -> list[dict[str, Any]]:
    query, params = apply_scope("SELECT * FROM leads", org_id)
    query += " ORDER BY id DESC"
    return list_rows(query, params)



def update_lead(lead_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    if not fields:
        return get_lead(lead_id)
    allowed = {
        "org_id",
        "assigned_rep_id",
        "name",
        "email",
        "phone",
        "business_name",
        "service_interest",
        "urgency",
        "preferred_schedule",
        "timezone",
        "qualification_status",
        "source",
        "notes",
        "assigned_owner",
        "tags",
        "last_contacted_at",
    }
    sets: list[str] = []
    values: list[Any] = []
    for key, value in fields.items():
        if key not in allowed:
            continue
        if key == "tags":
            sets.append("tags_json = ?")
            values.append(json.dumps(value or []))
        elif key == "phone":
            sets.append("phone = ?")
            values.append(value)
            sets.append("phone_normalized = ?")
            values.append(normalize_phone(str(value)))
        else:
            sets.append(f"{key} = ?")
            values.append(value)
    if not sets:
        return get_lead(lead_id)
    sets.append("updated_at = ?")
    values.append(utcnow_iso())
    values.append(lead_id)
    with connect() as conn:
        conn.execute(f"UPDATE leads SET {', '.join(sets)} WHERE id = ?", tuple(values))
    return get_lead(lead_id)



def create_session(lead_id: int, org_id: int | None = None) -> dict[str, Any] | None:
    now = utcnow_iso()
    lead = get_lead(lead_id) or {}
    org_id = org_id or int(lead.get("org_id") or get_default_org_id())
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO sessions (lead_id, org_id, status, created_at, updated_at) VALUES (?, ?, 'open', ?, ?)",
            (lead_id, org_id, now, now),
        )
        session_id = cur.lastrowid
    return get_session(int(session_id))  # type: ignore[arg-type]



def get_session(session_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM sessions WHERE id = ?", (session_id,))



def get_latest_session_for_lead(lead_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM sessions WHERE lead_id = ? ORDER BY id DESC LIMIT 1", (lead_id,))



def touch_session(session_id: int) -> None:
    with connect() as conn:
        conn.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (utcnow_iso(), session_id))



def add_message(session_id: int, role: str, text: str, metadata: dict[str, Any] | None = None) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO messages (session_id, role, text, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (session_id, role, text, json.dumps(metadata or {}), now),
        )
        message_id = cur.lastrowid
        session = conn.execute("SELECT lead_id FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if session:
            conn.execute("UPDATE leads SET last_contacted_at = ?, updated_at = ? WHERE id = ?", (now, now, int(session[0])))
    touch_session(session_id)
    return get_row("SELECT * FROM messages WHERE id = ?", (int(message_id),))



def list_messages(session_id: int) -> list[dict[str, Any]]:
    return list_rows("SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC", (session_id,))



def get_conversation_for_lead(lead_id: int) -> list[dict[str, Any]]:
    session = get_latest_session_for_lead(lead_id)
    if not session:
        return []
    return list_messages(int(session["id"]))



def create_appointment(payload: dict[str, Any]) -> dict[str, Any] | None:
    now = utcnow_iso()
    org_id = int(payload.get("org_id") or resolve_org_id(None, None))
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO appointments (
                org_id, lead_id, session_id, start_ts, end_ts, timezone, status,
                notes, confirmation_code, reminder_last_queued_at, reminder_last_sent_at,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                org_id,
                payload["lead_id"],
                payload.get("session_id"),
                payload["start_ts"],
                payload["end_ts"],
                payload.get("timezone", "America/Phoenix"),
                payload.get("status", "booked"),
                payload.get("notes", ""),
                payload["confirmation_code"],
                payload.get("reminder_last_queued_at", ""),
                payload.get("reminder_last_sent_at", ""),
                now,
                now,
            ),
        )
        appointment_id = cur.lastrowid
    return get_appointment(int(appointment_id))  # type: ignore[arg-type]



def get_appointment(appointment_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM appointments WHERE id = ?", (appointment_id,))



def get_appointment_by_confirmation_code(code: str) -> dict[str, Any] | None:
    return get_row("SELECT * FROM appointments WHERE confirmation_code = ? ORDER BY id DESC LIMIT 1", (code,))



def update_appointment(appointment_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    if not fields:
        return get_appointment(appointment_id)
    allowed = {
        "org_id",
        "start_ts",
        "end_ts",
        "timezone",
        "status",
        "notes",
        "reminder_last_queued_at",
        "reminder_last_sent_at",
    }
    sets: list[str] = []
    values: list[Any] = []
    for key, value in fields.items():
        if key not in allowed:
            continue
        sets.append(f"{key} = ?")
        values.append(value)
    if not sets:
        return get_appointment(appointment_id)
    sets.append("updated_at = ?")
    values.append(utcnow_iso())
    values.append(appointment_id)
    with connect() as conn:
        conn.execute(f"UPDATE appointments SET {', '.join(sets)} WHERE id = ?", tuple(values))
    return get_appointment(appointment_id)



def list_appointments(org_id: int | None = None) -> list[dict[str, Any]]:
    query, params = apply_scope("SELECT * FROM appointments", org_id)
    query += " ORDER BY start_ts ASC"
    return list_rows(query, params)



def list_active_appointments_between(start_ts: str, end_ts: str, org_id: int | None = None) -> list[dict[str, Any]]:
    query = (
        "SELECT * FROM appointments WHERE status IN ('booked', 'confirmed') "
        "AND start_ts < ? AND end_ts > ?"
    )
    params: list[Any] = [end_ts, start_ts]
    if org_id:
        query += " AND org_id = ?"
        params.append(org_id)
    query += " ORDER BY start_ts ASC"
    return list_rows(query, tuple(params))



def get_summary(org_id: int | None = None) -> dict[str, Any]:
    with connect() as conn:
        def count(query: str, params: tuple[Any, ...] = ()) -> int:
            return int(conn.execute(query, params).fetchone()[0])
        if org_id:
            leads = count("SELECT COUNT(*) FROM leads WHERE org_id = ?", (org_id,))
            qualified = count("SELECT COUNT(*) FROM leads WHERE org_id = ? AND qualification_status IN ('qualified', 'booked')", (org_id,))
            booked = count("SELECT COUNT(*) FROM appointments WHERE org_id = ? AND status IN ('booked', 'confirmed')", (org_id,))
            cancelled = count("SELECT COUNT(*) FROM appointments WHERE org_id = ? AND status = 'cancelled'", (org_id,))
            queued = count("SELECT COUNT(*) FROM outbound_messages WHERE org_id = ? AND status = 'queued'", (org_id,))
            sent = count("SELECT COUNT(*) FROM outbound_messages WHERE org_id = ? AND status = 'sent'", (org_id,))
            inbound = count("SELECT COUNT(*) FROM inbound_messages WHERE org_id = ?", (org_id,))
            voice = count("SELECT COUNT(*) FROM voice_calls WHERE org_id = ?", (org_id,))
            calendar_links = count("SELECT COUNT(*) FROM calendar_event_links WHERE org_id = ?", (org_id,))
            invoiced_cents = int(conn.execute("SELECT COALESCE(SUM(amount_cents), 0) FROM invoices WHERE org_id = ? AND status != 'void'", (org_id,)).fetchone()[0])
            paid_cents = int(conn.execute("SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE org_id = ?", (org_id,)).fetchone()[0])
            outstanding_cents = int(conn.execute("SELECT COALESCE(SUM(balance_cents), 0) FROM invoices WHERE org_id = ? AND status NOT IN ('void','written_off')", (org_id,)).fetchone()[0])
        else:
            leads = count("SELECT COUNT(*) FROM leads")
            qualified = count("SELECT COUNT(*) FROM leads WHERE qualification_status IN ('qualified', 'booked')")
            booked = count("SELECT COUNT(*) FROM appointments WHERE status IN ('booked', 'confirmed')")
            cancelled = count("SELECT COUNT(*) FROM appointments WHERE status = 'cancelled'")
            queued = count("SELECT COUNT(*) FROM outbound_messages WHERE status = 'queued'")
            sent = count("SELECT COUNT(*) FROM outbound_messages WHERE status = 'sent'")
            inbound = count("SELECT COUNT(*) FROM inbound_messages")
            voice = count("SELECT COUNT(*) FROM voice_calls")
            calendar_links = count("SELECT COUNT(*) FROM calendar_event_links")
            invoiced_cents = int(conn.execute("SELECT COALESCE(SUM(amount_cents), 0) FROM invoices WHERE status != 'void'").fetchone()[0])
            paid_cents = int(conn.execute("SELECT COALESCE(SUM(amount_cents), 0) FROM payments").fetchone()[0])
            outstanding_cents = int(conn.execute("SELECT COALESCE(SUM(balance_cents), 0) FROM invoices WHERE status NOT IN ('void','written_off')").fetchone()[0])
    return {
        "lead_count": leads,
        "qualified_count": qualified,
        "booked_count": booked,
        "cancelled_count": cancelled,
        "queued_outbound_count": queued,
        "sent_outbound_count": sent,
        "inbound_message_count": inbound,
        "voice_call_count": voice,
        "calendar_link_count": calendar_links,
        "invoiced_cents": invoiced_cents,
        "paid_cents": paid_cents,
        "outstanding_cents": outstanding_cents,
    }



def get_analytics(org_id: int | None = None) -> dict[str, Any]:
    leads = list_leads(org_id)
    appointments = list_appointments(org_id)
    reps = list_reps(org_id)
    booked = [appt for appt in appointments if appt.get('status') in {'booked', 'confirmed', 'completed'}]
    cancelled = [appt for appt in appointments if appt.get('status') == 'cancelled']
    qualified = [lead for lead in leads if lead.get('qualification_status') in {'qualified', 'booked'}]

    service_breakdown: dict[str, int] = {}
    urgency_breakdown: dict[str, int] = {}
    rep_breakdown: dict[str, int] = {}
    source_breakdown: dict[str, dict[str, Any]] = {}
    appointments_by_lead: dict[int, list[dict[str, Any]]] = {}
    for appt in appointments:
        appointments_by_lead.setdefault(int(appt.get('lead_id') or 0), []).append(appt)
    billing_by_lead: dict[int, dict[str, int]] = {}
    for lead in leads:
        billing = get_billing_snapshot_for_lead(int(lead['id']))
        billing_by_lead[int(lead['id'])] = billing.get('totals', {})
    rep_scorecards: list[dict[str, Any]] = []
    rep_index: dict[int, dict[str, Any]] = {}
    for rep in reps:
        rep_id = int(rep.get('id') or 0)
        rep_index[rep_id] = rep
        rep_scorecards.append({
            'rep_id': rep_id,
            'name': str(rep.get('name') or 'Unassigned'),
            'role': str(rep.get('role') or 'setter'),
            'assigned_leads': 0,
            'qualified_leads': 0,
            'booked_appointments': 0,
            'confirmed_appointments': 0,
            'completed_appointments': 0,
            'cancelled_appointments': 0,
            'no_show_appointments': 0,
            'paid_cents': 0,
            'outstanding_cents': 0,
            'commission_rate_bps': int(rep.get('commission_rate_bps') or 0),
            'estimated_commission_cents': 0,
            'target_monthly_cents': int(rep.get('target_monthly_cents') or 0),
            'target_attainment_pct': 0.0,
        })
    scorecard_by_rep = {item['rep_id']: item for item in rep_scorecards}

    for lead in leads:
        service_key = str(lead.get('service_interest') or 'Unknown')
        urgency_key = str(lead.get('urgency') or 'Unknown')
        owner_key = str(lead.get('assigned_owner') or 'Unassigned')
        source_key = str(lead.get('source') or 'unknown').strip() or 'unknown'
        service_breakdown[service_key] = service_breakdown.get(service_key, 0) + 1
        urgency_breakdown[urgency_key] = urgency_breakdown.get(urgency_key, 0) + 1
        rep_breakdown[owner_key] = rep_breakdown.get(owner_key, 0) + 1
        source_entry = source_breakdown.setdefault(source_key, {
            'source': source_key,
            'lead_count': 0,
            'qualified_count': 0,
            'booked_count': 0,
            'completed_count': 0,
            'paid_cents': 0,
            'outstanding_cents': 0,
        })
        source_entry['lead_count'] += 1
        if lead.get('qualification_status') in {'qualified', 'booked'}:
            source_entry['qualified_count'] += 1
        lead_appts = appointments_by_lead.get(int(lead['id']), [])
        if any(appt.get('status') in {'booked', 'confirmed', 'completed'} for appt in lead_appts):
            source_entry['booked_count'] += 1
        if any(appt.get('status') == 'completed' for appt in lead_appts):
            source_entry['completed_count'] += 1
        totals = billing_by_lead.get(int(lead['id']), {})
        source_entry['paid_cents'] += int(totals.get('paid_cents') or 0)
        source_entry['outstanding_cents'] += int(totals.get('outstanding_cents') or 0)
        rep_id = int(lead.get('assigned_rep_id') or 0)
        scorecard = scorecard_by_rep.get(rep_id)
        if scorecard:
            scorecard['assigned_leads'] += 1
            if lead.get('qualification_status') in {'qualified', 'booked'}:
                scorecard['qualified_leads'] += 1
            scorecard['paid_cents'] += int(totals.get('paid_cents') or 0)
            scorecard['outstanding_cents'] += int(totals.get('outstanding_cents') or 0)
            for appt in lead_appts:
                status = str(appt.get('status') or '')
                if status in {'booked', 'confirmed', 'completed'}:
                    scorecard['booked_appointments'] += 1
                if status == 'confirmed':
                    scorecard['confirmed_appointments'] += 1
                if status == 'completed':
                    scorecard['completed_appointments'] += 1
                if status == 'cancelled':
                    scorecard['cancelled_appointments'] += 1
                if status == 'no_show':
                    scorecard['no_show_appointments'] += 1

    booked_rate = round((len(booked) / len(leads) * 100), 2) if leads else 0.0
    qualification_rate = round((len(qualified) / len(leads) * 100), 2) if leads else 0.0
    cancellation_rate = round((len(cancelled) / len(appointments) * 100), 2) if appointments else 0.0

    for item in rep_scorecards:
        item['estimated_commission_cents'] = round(int(item['paid_cents']) * (int(item['commission_rate_bps']) / 10000))
        target = int(item.get('target_monthly_cents') or 0)
        item['target_attainment_pct'] = round((int(item['paid_cents']) / target * 100), 2) if target else 0.0
        item['lead_to_booked_rate'] = round((int(item['booked_appointments']) / int(item['assigned_leads']) * 100), 2) if int(item['assigned_leads']) else 0.0
    rep_scorecards.sort(key=lambda item: (int(item['paid_cents']), int(item['booked_appointments']), int(item['assigned_leads'])), reverse=True)

    source_rows = list(source_breakdown.values())
    for item in source_rows:
        item['lead_to_booked_rate'] = round((int(item['booked_count']) / int(item['lead_count']) * 100), 2) if int(item['lead_count']) else 0.0
        item['lead_to_completed_rate'] = round((int(item['completed_count']) / int(item['lead_count']) * 100), 2) if int(item['lead_count']) else 0.0
    source_rows.sort(key=lambda item: (int(item['paid_cents']), int(item['booked_count']), int(item['lead_count'])), reverse=True)

    return {
        'booked_rate': booked_rate,
        'qualification_rate': qualification_rate,
        'cancellation_rate': cancellation_rate,
        'service_breakdown': service_breakdown,
        'urgency_breakdown': urgency_breakdown,
        'rep_load': rep_breakdown,
        'org_count': len({int(lead.get('org_id') or 0) for lead in leads}) if leads else len(list_orgs()),
        'rep_count': len(reps),
        'voice_call_count': len(list_voice_calls(org_id)),
        'calendar_synced_count': len(list_calendar_event_links(org_id)),
        'rep_scorecards': rep_scorecards,
        'source_attribution': source_rows,
    }



def enqueue_outbound_message(
    org_id: int,
    lead_id: int | None,
    appointment_id: int | None,
    channel: str,
    recipient: str,
    body: str,
    subject: str = "",
    transport: str = "unconfigured",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO outbound_messages (
                org_id, lead_id, appointment_id, channel, recipient, subject, body,
                transport, status, provider_message_id, error_text, metadata_json,
                created_at, updated_at, dispatched_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', '', '', ?, ?, ?, '')
            """,
            (
                org_id,
                lead_id,
                appointment_id,
                channel,
                recipient,
                subject,
                body,
                transport,
                json.dumps(metadata or {}),
                now,
                now,
            ),
        )
        message_id = cur.lastrowid
    return get_outbound_message(int(message_id))  # type: ignore[arg-type]



def get_outbound_message(message_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM outbound_messages WHERE id = ?", (message_id,))



def list_outbound_messages(org_id: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
    query = "SELECT * FROM outbound_messages"
    params: list[Any] = []
    if org_id:
        query += " WHERE org_id = ?"
        params.append(org_id)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    return list_rows(query, tuple(params))



def list_pending_outbound_messages(org_id: int | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM outbound_messages WHERE status = 'queued'"
    params: list[Any] = []
    if org_id:
        query += " AND org_id = ?"
        params.append(org_id)
    query += " ORDER BY id ASC"
    return list_rows(query, tuple(params))



def update_outbound_message(message_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    if not fields:
        return get_outbound_message(message_id)
    allowed = {
        "transport",
        "status",
        "provider_message_id",
        "error_text",
        "dispatched_at",
        "metadata_json",
    }
    sets: list[str] = []
    values: list[Any] = []
    for key, value in fields.items():
        if key not in allowed:
            continue
        sets.append(f"{key} = ?")
        values.append(value)
    if not sets:
        return get_outbound_message(message_id)
    sets.append("updated_at = ?")
    values.append(utcnow_iso())
    values.append(message_id)
    with connect() as conn:
        conn.execute(f"UPDATE outbound_messages SET {', '.join(sets)} WHERE id = ?", tuple(values))
    return get_outbound_message(message_id)



def create_inbound_message(payload: dict[str, Any]) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO inbound_messages (
                org_id, lead_id, appointment_id, session_id, channel, sender, recipient,
                subject, body, provider_message_id, status, action_taken, thread_status, owner_user_id, owner_name, priority, claimed_at, replied_at, closed_at, metadata_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(payload.get("org_id") or get_default_org_id()),
                payload.get("lead_id"),
                payload.get("appointment_id"),
                payload.get("session_id"),
                str(payload.get("channel") or "email"),
                str(payload.get("sender") or ""),
                str(payload.get("recipient") or ""),
                str(payload.get("subject") or ""),
                str(payload.get("body") or ""),
                str(payload.get("provider_message_id") or ""),
                str(payload.get("status") or "received"),
                str(payload.get("action_taken") or ""),
                str(payload.get("thread_status") or "open"),
                int(payload.get("owner_user_id") or 0) or None,
                str(payload.get("owner_name") or ""),
                str(payload.get("priority") or "normal"),
                str(payload.get("claimed_at") or ""),
                str(payload.get("replied_at") or ""),
                str(payload.get("closed_at") or ""),
                json.dumps(payload.get("metadata") or {}),
                now,
                now,
            ),
        )
        inbound_id = cur.lastrowid
    return get_inbound_message(int(inbound_id))  # type: ignore[arg-type]



def get_inbound_message(message_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM inbound_messages WHERE id = ?", (message_id,))



def update_inbound_message(message_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    if not fields:
        return get_inbound_message(message_id)
    allowed = {"status", "action_taken", "metadata_json", "appointment_id", "session_id", "lead_id", "thread_status", "owner_user_id", "owner_name", "priority", "claimed_at", "replied_at", "closed_at"}
    sets: list[str] = []
    values: list[Any] = []
    for key, value in fields.items():
        if key not in allowed:
            continue
        sets.append(f"{key} = ?")
        values.append(value)
    if not sets:
        return get_inbound_message(message_id)
    sets.append("updated_at = ?")
    values.append(utcnow_iso())
    values.append(message_id)
    with connect() as conn:
        conn.execute(f"UPDATE inbound_messages SET {', '.join(sets)} WHERE id = ?", tuple(values))
    return get_inbound_message(message_id)



def list_inbound_messages(org_id: int | None = None, limit: int = 100, lead_id: int | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM inbound_messages"
    params: list[Any] = []
    clauses: list[str] = []
    if org_id:
        clauses.append("org_id = ?")
        params.append(org_id)
    if lead_id:
        clauses.append("lead_id = ?")
        params.append(lead_id)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    return list_rows(query, tuple(params))



def list_inbound_messages_for_lead(lead_id: int, limit: int = 100) -> list[dict[str, Any]]:
    return list_inbound_messages(None, limit=limit, lead_id=lead_id)


def get_latest_inbound_message(lead_id: int, channel: str | None = None) -> dict[str, Any] | None:
    query = 'SELECT * FROM inbound_messages WHERE lead_id = ?'
    params: list[Any] = [lead_id]
    if channel:
        query += ' AND channel = ?'
        params.append(str(channel))
    query += ' ORDER BY id DESC LIMIT 1'
    return get_row(query, tuple(params))


def update_latest_inbound_thread_for_lead(lead_id: int, channel: str | None = None, fields: dict[str, Any] | None = None) -> dict[str, Any] | None:
    latest = get_latest_inbound_message(lead_id, channel) or {}
    if not latest:
        return None
    return update_inbound_message(int(latest.get('id') or 0), fields or {})



def get_admin_user(user_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM admin_users WHERE id = ?", (user_id,))



def get_admin_user_by_email(email: str) -> dict[str, Any] | None:
    return get_row("SELECT * FROM admin_users WHERE lower(email) = lower(?)", (email.strip(),))



def list_admin_users(org_id: int | None = None) -> list[dict[str, Any]]:
    query, params = apply_scope(
        "SELECT id, org_id, email, display_name, role, require_password_change, failed_login_count, locked_until, is_active, created_at, updated_at FROM admin_users",
        org_id,
    )
    query += " ORDER BY id ASC"
    return list_rows(query, params)



def create_admin_session(user_id: int, session_token: str, csrf_token: str, ttl_hours: int) -> dict[str, Any] | None:
    now = utcnow_iso()
    expires_at = (datetime.utcnow() + timedelta(hours=ttl_hours)).replace(microsecond=0).isoformat() + "Z"
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO admin_sessions (user_id, session_token, csrf_token, expires_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, session_token, csrf_token, expires_at, now, now),
        )
        session_id = cur.lastrowid
    return get_admin_session_by_id(int(session_id))



def get_admin_session_by_id(session_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM admin_sessions WHERE id = ?", (session_id,))



def get_admin_session(token: str) -> dict[str, Any] | None:
    row = get_row(
        """
        SELECT s.*, u.email, u.display_name, u.role, u.org_id, u.require_password_change, u.failed_login_count, u.locked_until, u.is_active
        FROM admin_sessions s
        JOIN admin_users u ON u.id = s.user_id
        WHERE s.session_token = ?
        """,
        (token,),
    )
    if not row:
        return None
    if row.get("is_active") != 1:
        delete_admin_session(token)
        return None
    expires_at = str(row.get("expires_at") or "")
    if expires_at and expires_at < utcnow_iso():
        delete_admin_session(token)
        return None
    return row



def touch_admin_session(token: str) -> None:
    with connect() as conn:
        conn.execute("UPDATE admin_sessions SET last_seen_at = ? WHERE session_token = ?", (utcnow_iso(), token))



def delete_admin_session(token: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM admin_sessions WHERE session_token = ?", (token,))



def prune_admin_sessions() -> None:
    with connect() as conn:
        conn.execute("DELETE FROM admin_sessions WHERE expires_at < ?", (utcnow_iso(),))



def reset_login_failures(user_id: int) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE admin_users SET failed_login_count = 0, locked_until = '', updated_at = ? WHERE id = ?",
            (utcnow_iso(), user_id),
        )



def increment_login_failure(user_id: int, lock_until: str = "") -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE admin_users SET failed_login_count = COALESCE(failed_login_count, 0) + 1, locked_until = ?, updated_at = ? WHERE id = ?",
            (lock_until, utcnow_iso(), user_id),
        )



def update_admin_password(user_id: int, password_hash: str, require_password_change: int = 0) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        conn.execute(
            """
            UPDATE admin_users
            SET password_hash = ?, require_password_change = ?, failed_login_count = 0, locked_until = '', password_changed_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (password_hash, int(require_password_change), now, now, user_id),
        )
    return get_admin_user(user_id)



def user_locked(user: dict[str, Any] | None) -> bool:
    if not user:
        return False
    locked_until = str(user.get("locked_until") or "")
    return bool(locked_until and locked_until > utcnow_iso())



def clear_runtime_data() -> None:
    with connect() as conn:
        for table in [
            "messages",
            "outbound_messages",
            "inbound_messages",
            "payments",
            "payment_commitments",
            "invoices",
            "payment_plans",
            "recurring_memberships",
            "proof_artifacts",
            "quotes",
            "escalations",
            "lead_views",
            "playbooks",
            "lead_memories",
            "portal_documents",
            "voice_calls",
            "calendar_event_links",
            "calendar_sync_logs",
            "audit_events",
            "intake_packets",
            "appointments",
            "sessions",
            "leads",
            "admin_sessions",
        ]:
            conn.execute(f"DELETE FROM {table}")
        conn.execute("UPDATE routing_state SET last_rep_id = NULL, updated_at = ?", (utcnow_iso(),))
        conn.execute(
            "UPDATE admin_users SET failed_login_count = 0, locked_until = '', require_password_change = 1, updated_at = ?",
            (utcnow_iso(),),
        )
        conn.commit()



def create_voice_call(payload: dict[str, Any]) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO voice_calls (
                org_id, lead_id, appointment_id, session_id, direction, purpose, from_number, to_number,
                provider, provider_call_id, status, outcome, duration_seconds, transcript, metadata_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(payload.get("org_id") or get_default_org_id()),
                payload.get("lead_id"),
                payload.get("appointment_id"),
                payload.get("session_id"),
                str(payload.get("direction") or "outbound"),
                str(payload.get("purpose") or "qualification"),
                str(payload.get("from_number") or ""),
                str(payload.get("to_number") or ""),
                str(payload.get("provider") or "unconfigured"),
                str(payload.get("provider_call_id") or ""),
                str(payload.get("status") or "queued"),
                str(payload.get("outcome") or ""),
                int(payload.get("duration_seconds") or 0),
                str(payload.get("transcript") or ""),
                json.dumps(payload.get("metadata") or {}),
                now,
                now,
            ),
        )
        voice_id = cur.lastrowid
    return get_voice_call(int(voice_id))  # type: ignore[arg-type]



def get_voice_call(voice_call_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM voice_calls WHERE id = ?", (voice_call_id,))



def update_voice_call(voice_call_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    if not fields:
        return get_voice_call(voice_call_id)
    allowed = {
        "lead_id",
        "appointment_id",
        "session_id",
        "provider",
        "provider_call_id",
        "status",
        "outcome",
        "duration_seconds",
        "transcript",
        "metadata",
    }
    sets: list[str] = []
    values: list[Any] = []
    for key, value in fields.items():
        if key not in allowed:
            continue
        if key == "metadata":
            sets.append("metadata_json = ?")
            values.append(json.dumps(value or {}))
        else:
            sets.append(f"{key} = ?")
            values.append(value)
    if not sets:
        return get_voice_call(voice_call_id)
    sets.append("updated_at = ?")
    values.append(utcnow_iso())
    values.append(voice_call_id)
    with connect() as conn:
        conn.execute(f"UPDATE voice_calls SET {', '.join(sets)} WHERE id = ?", tuple(values))
    return get_voice_call(voice_call_id)



def list_voice_calls(org_id: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
    query = "SELECT * FROM voice_calls"
    params: list[Any] = []
    if org_id:
        query += " WHERE org_id = ?"
        params.append(org_id)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    return list_rows(query, tuple(params))



def list_appointments_for_lead(lead_id: int) -> list[dict[str, Any]]:
    return list_rows("SELECT * FROM appointments WHERE lead_id = ? ORDER BY start_ts DESC", (lead_id,))



def get_next_active_appointment_for_lead(lead_id: int) -> dict[str, Any] | None:
    return get_row(
        "SELECT * FROM appointments WHERE lead_id = ? AND status IN ('booked', 'confirmed') ORDER BY start_ts ASC LIMIT 1",
        (lead_id,),
    )



def list_outbound_messages_for_lead(lead_id: int, limit: int = 100) -> list[dict[str, Any]]:
    return list_rows(
        "SELECT * FROM outbound_messages WHERE lead_id = ? ORDER BY id DESC LIMIT ?",
        (lead_id, limit),
    )



def list_voice_calls_for_lead(lead_id: int, limit: int = 100) -> list[dict[str, Any]]:
    return list_rows(
        "SELECT * FROM voice_calls WHERE lead_id = ? ORDER BY id DESC LIMIT ?",
        (lead_id, limit),
    )



def lead_activity_timeline(lead_id: int, limit: int = 150) -> list[dict[str, Any]]:
    lead = get_lead(lead_id) or {}
    items: list[dict[str, Any]] = []

    for message in get_conversation_for_lead(lead_id):
        items.append(
            {
                'kind': 'message',
                'created_at': message.get('created_at') or '',
                'title': f"Conversation · {message.get('role') or 'message'}",
                'detail': str(message.get('text') or ''),
                'status': '',
                'entity_id': message.get('id'),
                'metadata': message.get('metadata') or {},
            }
        )

    for appointment in list_appointments_for_lead(lead_id):
        items.append(
            {
                'kind': 'appointment',
                'created_at': appointment.get('updated_at') or appointment.get('created_at') or '',
                'title': f"Appointment · {appointment.get('status') or 'booked'}",
                'detail': f"{appointment.get('start_ts') or ''} · code {appointment.get('confirmation_code') or ''}",
                'status': appointment.get('status') or '',
                'entity_id': appointment.get('id'),
                'metadata': {'appointment_id': appointment.get('id')},
            }
        )

    for outbound in list_outbound_messages_for_lead(lead_id):
        body = str(outbound.get('body') or '')
        items.append(
            {
                'kind': 'outbound',
                'created_at': outbound.get('dispatched_at') or outbound.get('created_at') or '',
                'title': f"Outbound · {outbound.get('channel') or 'message'}",
                'detail': body[:220] + ('…' if len(body) > 220 else ''),
                'status': outbound.get('status') or '',
                'entity_id': outbound.get('id'),
                'metadata': {'recipient': outbound.get('recipient') or '', 'transport': outbound.get('transport') or ''},
            }
        )

    for inbound in list_inbound_messages_for_lead(lead_id):
        body = str(inbound.get('body') or '')
        items.append(
            {
                'kind': 'inbound',
                'created_at': inbound.get('created_at') or '',
                'title': f"Inbound · {inbound.get('channel') or 'message'}",
                'detail': body[:220] + ('…' if len(body) > 220 else ''),
                'status': inbound.get('status') or '',
                'entity_id': inbound.get('id'),
                'metadata': {'sender': inbound.get('sender') or '', 'action_taken': inbound.get('action_taken') or ''},
            }
        )

    for call in list_voice_calls_for_lead(lead_id):
        transcript = str(call.get('transcript') or '')
        items.append(
            {
                'kind': 'voice',
                'created_at': call.get('updated_at') or call.get('created_at') or '',
                'title': f"Voice · {call.get('purpose') or 'call'}",
                'detail': transcript[:220] + ('…' if len(transcript) > 220 else ''),
                'status': call.get('status') or '',
                'entity_id': call.get('id'),
                'metadata': {'to': call.get('to_number') or '', 'outcome': call.get('outcome') or ''},
            }
        )

    if lead:
        items.append(
            {
                'kind': 'lead',
                'created_at': lead.get('updated_at') or lead.get('created_at') or '',
                'title': 'Lead record',
                'detail': str(lead.get('notes') or 'Lead saved.'),
                'status': lead.get('qualification_status') or '',
                'entity_id': lead.get('id'),
                'metadata': {'owner': lead.get('assigned_owner') or ''},
            }
        )

    items.sort(key=lambda item: str(item.get('created_at') or ''), reverse=True)
    return items[: max(1, int(limit))]




def get_calendar_event_link(provider: str, appointment_id: int) -> dict[str, Any] | None:
    return get_row(
        "SELECT * FROM calendar_event_links WHERE provider = ? AND appointment_id = ?",
        (provider, appointment_id),
    )



def upsert_calendar_event_link(
    org_id: int,
    provider: str,
    appointment_id: int,
    external_calendar_id: str,
    external_event_id: str,
    external_url: str,
    status: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO calendar_event_links (
                org_id, provider, appointment_id, external_calendar_id, external_event_id,
                external_url, status, payload_json, last_synced_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(provider, appointment_id) DO UPDATE SET
                external_calendar_id = excluded.external_calendar_id,
                external_event_id = excluded.external_event_id,
                external_url = excluded.external_url,
                status = excluded.status,
                payload_json = excluded.payload_json,
                last_synced_at = excluded.last_synced_at,
                updated_at = excluded.updated_at
            """,
            (
                org_id,
                provider,
                appointment_id,
                external_calendar_id,
                external_event_id,
                external_url,
                status,
                json.dumps(payload or {}),
                now,
                now,
                now,
            ),
        )
    return get_calendar_event_link(provider, appointment_id)



def list_calendar_event_links(org_id: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
    query = "SELECT * FROM calendar_event_links"
    params: list[Any] = []
    if org_id:
        query += " WHERE org_id = ?"
        params.append(org_id)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    return list_rows(query, tuple(params))



def log_calendar_sync(org_id: int, provider: str, action: str, status: str, detail: str = "", appointment_id: int | None = None) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO calendar_sync_logs (org_id, provider, appointment_id, action, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (org_id, provider, appointment_id, action, status, detail, now),
        )
        log_id = cur.lastrowid
    return get_row("SELECT * FROM calendar_sync_logs WHERE id = ?", (int(log_id),))



def list_calendar_sync_logs(org_id: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
    query = "SELECT * FROM calendar_sync_logs"
    params: list[Any] = []
    if org_id:
        query += " WHERE org_id = ?"
        params.append(org_id)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    return list_rows(query, tuple(params))



def log_audit_event(
    event_type: str,
    *,
    org_id: int | None = None,
    actor_user_id: int | None = None,
    actor_email: str = '',
    actor_role: str = '',
    route: str = '',
    entity_type: str = '',
    entity_id: str | int | None = None,
    status: str = 'ok',
    detail: str = '',
    ip_address: str = '',
    user_agent: str = '',
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    now = utcnow_iso()
    resolved_org_id = int(org_id or get_default_org_id())
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO audit_events (
                org_id, actor_user_id, actor_email, actor_role, event_type, route, entity_type, entity_id,
                status, detail, ip_address, user_agent, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                resolved_org_id,
                actor_user_id,
                actor_email,
                actor_role,
                str(event_type),
                str(route or ''),
                str(entity_type or ''),
                str(entity_id or ''),
                str(status or 'ok'),
                str(detail or ''),
                str(ip_address or ''),
                str(user_agent or ''),
                json.dumps(metadata or {}),
                now,
            ),
        )
        event_id = cur.lastrowid
    return get_row('SELECT * FROM audit_events WHERE id = ?', (int(event_id),))


def list_audit_events(org_id: int | None = None, limit: int = 200) -> list[dict[str, Any]]:
    query = 'SELECT * FROM audit_events'
    params: list[Any] = []
    if org_id:
        query += ' WHERE org_id = ?'
        params.append(org_id)
    query += ' ORDER BY id DESC LIMIT ?'
    params.append(limit)
    return list_rows(query, tuple(params))


def count_audit_events(org_id: int | None = None) -> int:
    query = 'SELECT COUNT(*) as count FROM audit_events'
    params: tuple[Any, ...] = ()
    if org_id:
        query += ' WHERE org_id = ?'
        params = (org_id,)
    row = get_row(query, params)
    return int(row.get('count') or 0) if row else 0


def prune_audit_events(older_than_days: int = 30) -> int:
    cutoff = (datetime.utcnow() - timedelta(days=max(1, int(older_than_days)))).replace(microsecond=0).isoformat() + 'Z'
    with connect() as conn:
        cur = conn.execute('DELETE FROM audit_events WHERE created_at < ?', (cutoff,))
        return int(cur.rowcount or 0)


def runtime_snapshot(org_id: int | None = None) -> dict[str, Any]:
    summary = get_summary(org_id)
    return {
        'db_path': str(DB_PATH),
        'db_exists': DB_PATH.exists(),
        'db_size_bytes': DB_PATH.stat().st_size if DB_PATH.exists() else 0,
        'org_scope': int(org_id) if org_id else None,
        'lead_count': int(summary.get('lead_count') or 0),
        'booked_count': int(summary.get('booked_count') or 0),
        'queued_outbound_count': int(summary.get('queued_outbound_count') or 0),
        'sent_outbound_count': int(summary.get('sent_outbound_count') or 0),
        'inbound_message_count': int(summary.get('inbound_message_count') or 0),
        'voice_call_count': int(summary.get('voice_call_count') or 0),
        'calendar_link_count': int(summary.get('calendar_link_count') or 0),
        'invoiced_cents': int(summary.get('invoiced_cents') or 0),
        'paid_cents': int(summary.get('paid_cents') or 0),
        'outstanding_cents': int(summary.get('outstanding_cents') or 0),
        'audit_event_count': count_audit_events(org_id),
    }


def create_sqlite_backup(destination: str | Path) -> str:
    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with connect() as source_conn:
        target = sqlite3.connect(destination_path)
        try:
            source_conn.backup(target)
        finally:
            target.close()
    return str(destination_path)



def cents_to_currency_value(amount_cents: int | None) -> float:
    return round((int(amount_cents or 0)) / 100.0, 2)



def get_intake_packet_for_lead(lead_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM intake_packets WHERE lead_id = ?", (lead_id,))



def get_intake_packet_for_confirmation_code(code: str) -> dict[str, Any] | None:
    appointment = get_appointment_by_confirmation_code(code)
    if not appointment:
        return None
    packet = get_intake_packet_for_lead(int(appointment.get("lead_id") or 0))
    if packet:
        return packet
    return get_or_create_intake_packet(int(appointment.get("lead_id") or 0), int(appointment.get("id") or 0), int(appointment.get("org_id") or get_default_org_id()))



def get_or_create_intake_packet(lead_id: int, appointment_id: int | None = None, org_id: int | None = None) -> dict[str, Any] | None:
    existing = get_intake_packet_for_lead(lead_id)
    if existing:
        updates: dict[str, Any] = {}
        if appointment_id and not existing.get("appointment_id"):
            updates["appointment_id"] = appointment_id
        if updates:
            return upsert_intake_packet(lead_id, updates)
        return existing
    lead = get_lead(lead_id) or {}
    resolved_org_id = int(org_id or lead.get("org_id") or get_default_org_id())
    now = utcnow_iso()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO intake_packets (
                org_id, lead_id, appointment_id, status, business_need, budget_range, decision_window,
                intake_notes, waiver_text, waiver_accepted, waiver_accepted_at, created_at, updated_at
            ) VALUES (?, ?, ?, 'pending', '', '', '', '',
                'I confirm that the information I submit is accurate and I approve the appointment preparation steps required by this business.',
                0, '', ?, ?)
            """,
            (resolved_org_id, lead_id, appointment_id, now, now),
        )
    return get_intake_packet_for_lead(lead_id)



def upsert_intake_packet(lead_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    packet = get_or_create_intake_packet(lead_id)
    if not packet:
        return None
    allowed = {
        "org_id", "appointment_id", "status", "business_need", "budget_range",
        "decision_window", "intake_notes", "waiver_text", "waiver_accepted", "waiver_accepted_at"
    }
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in allowed:
            continue
        clean[key] = value
    if "waiver_accepted" in clean:
        clean["waiver_accepted"] = 1 if clean["waiver_accepted"] else 0
        if clean["waiver_accepted"] and not clean.get("waiver_accepted_at"):
            clean["waiver_accepted_at"] = utcnow_iso()
    if not clean:
        return packet
    clean["updated_at"] = utcnow_iso()
    assignments = ", ".join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [lead_id]
    with connect() as conn:
        conn.execute(f"UPDATE intake_packets SET {assignments} WHERE lead_id = ?", tuple(params))
    return get_intake_packet_for_lead(lead_id)



def next_invoice_code(prefix: str = "INV") -> str:
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:-3]
    return f"{prefix}-{stamp}"



def get_invoice(invoice_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM invoices WHERE id = ?", (invoice_id,))



def list_invoices_for_lead(lead_id: int) -> list[dict[str, Any]]:
    return list_rows("SELECT * FROM invoices WHERE lead_id = ? ORDER BY id DESC", (lead_id,))



def list_payments_for_lead(lead_id: int) -> list[dict[str, Any]]:
    return list_rows("SELECT * FROM payments WHERE lead_id = ? ORDER BY id DESC", (lead_id,))



def get_payment_commitment(commitment_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM payment_commitments WHERE id = ?", (commitment_id,))



def list_payment_commitments_for_lead(lead_id: int) -> list[dict[str, Any]]:
    return list_rows("SELECT * FROM payment_commitments WHERE lead_id = ? ORDER BY id DESC", (lead_id,))



def create_payment_commitment(payload: dict[str, Any]) -> dict[str, Any] | None:
    lead_id = int(payload.get("lead_id") or 0)
    if not lead_id:
        raise ValueError("lead_id is required")
    lead = get_lead(lead_id) or {}
    if not lead:
        raise ValueError("Lead not found.")
    invoice_id = int(payload.get("invoice_id") or 0) or None
    invoice = get_invoice(invoice_id) if invoice_id else None
    if invoice_id and not invoice:
        raise ValueError("Invoice not found.")
    org_id = int(payload.get("org_id") or lead.get("org_id") or (invoice or {}).get("org_id") or get_default_org_id())
    appointment_id = int(payload.get("appointment_id") or (invoice or {}).get("appointment_id") or 0) or None
    requested_amount_cents = max(0, int(payload.get("requested_amount_cents") or payload.get("amount_cents") or (invoice or {}).get("balance_cents") or 0))
    if requested_amount_cents <= 0:
        raise ValueError("requested_amount_cents must be greater than zero.")
    planned_for_ts = str(payload.get("planned_for_ts") or '').strip()
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO payment_commitments (
                org_id, lead_id, appointment_id, invoice_id, requester_name, requested_amount_cents,
                method, planned_for_ts, status, notes, source, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                org_id,
                lead_id,
                appointment_id,
                invoice_id,
                str(payload.get("requester_name") or '').strip(),
                requested_amount_cents,
                str(payload.get("method") or 'ach').strip() or 'ach',
                planned_for_ts,
                str(payload.get("status") or 'pending').strip() or 'pending',
                str(payload.get("notes") or '').strip(),
                str(payload.get("source") or 'public_portal').strip() or 'public_portal',
                now,
                now,
            ),
        )
        commitment_id = cur.lastrowid
    return get_payment_commitment(int(commitment_id))



def update_payment_commitment(commitment_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {"requester_name", "requested_amount_cents", "method", "planned_for_ts", "status", "notes", "source"}
    clean = {k: v for k, v in fields.items() if k in allowed}
    if not clean:
        return get_payment_commitment(commitment_id)
    clean["updated_at"] = utcnow_iso()
    assignments = ", ".join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [commitment_id]
    with connect() as conn:
        conn.execute(f"UPDATE payment_commitments SET {assignments} WHERE id = ?", tuple(params))
    return get_payment_commitment(commitment_id)



def apply_payment_commitment_action(commitment_id: int, action: str, note: str = '') -> dict[str, Any] | None:
    commitment = get_payment_commitment(commitment_id) or {}
    if not commitment:
        raise ValueError('Payment commitment not found.')
    action = str(action or '').strip().lower()
    current_notes = str(commitment.get('notes') or '')
    if action == 'confirm':
        return update_payment_commitment(commitment_id, {
            'status': 'confirmed',
            'notes': _append_invoice_note(current_notes, 'payment commitment confirmed', note),
        })
    if action == 'cancel':
        return update_payment_commitment(commitment_id, {
            'status': 'cancelled',
            'notes': _append_invoice_note(current_notes, 'payment commitment cancelled', note),
        })
    if action == 'reopen':
        return update_payment_commitment(commitment_id, {
            'status': 'pending',
            'notes': _append_invoice_note(current_notes, 'payment commitment reopened', note),
        })
    if action == 'mark_paid':
        invoice_id = int(commitment.get('invoice_id') or 0)
        invoice = get_invoice(invoice_id) or {}
        if not invoice_id or not invoice:
            raise ValueError('Payment commitment must be attached to a live invoice before it can be marked paid.')
        open_balance = max(0, int(invoice.get('balance_cents') or 0))
        amount_cents = min(open_balance, max(0, int(commitment.get('requested_amount_cents') or 0))) or open_balance
        if amount_cents <= 0:
            raise ValueError('Invoice has no open balance left to record.')
        payment_result = record_payment({
            'invoice_id': invoice_id,
            'amount_cents': amount_cents,
            'method': str(commitment.get('method') or 'other').strip() or 'other',
            'reference': f'commitment:{commitment_id}',
            'notes': f'Auto-recorded from payment commitment {commitment_id}. {str(note or '').strip()}'.strip(),
        })
        updated = update_payment_commitment(commitment_id, {
            'status': 'paid',
            'notes': _append_invoice_note(current_notes, 'payment commitment marked paid', note),
        })
        return {
            'commitment': updated,
            'payment': payment_result.get('payment'),
            'invoice': payment_result.get('invoice'),
        }
    raise ValueError('Unsupported payment commitment action.')



def create_invoice(payload: dict[str, Any]) -> dict[str, Any] | None:
    lead_id = int(payload.get("lead_id") or 0)
    if not lead_id:
        raise ValueError("lead_id is required")
    lead = get_lead(lead_id) or {}
    org_id = int(payload.get("org_id") or lead.get("org_id") or get_default_org_id())
    invoice_code = str(payload.get("invoice_code") or "").strip() or next_invoice_code("INV")
    amount_cents = int(payload.get("amount_cents") or 0)
    if amount_cents == 0:
        raise ValueError("amount_cents must not be zero")
    if amount_cents > 0:
        balance_cents = max(0, int(payload.get("balance_cents") or amount_cents))
    else:
        balance_cents = 0
    currency = str(payload.get("currency") or "USD").strip() or "USD"
    status = str(payload.get("status") or ("paid" if balance_cents == 0 else "sent")).strip() or ("paid" if balance_cents == 0 else "sent")
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO invoices (
                org_id, lead_id, appointment_id, payment_plan_id, invoice_code, kind, description,
                amount_cents, balance_cents, currency, status, due_ts, installment_number, installment_count, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                org_id,
                lead_id,
                int(payload.get("appointment_id") or 0) or None,
                int(payload.get("payment_plan_id") or 0) or None,
                invoice_code,
                str(payload.get("kind") or "service"),
                str(payload.get("description") or "").strip(),
                amount_cents,
                balance_cents,
                currency,
                status,
                str(payload.get("due_ts") or "").strip(),
                int(payload.get("installment_number") or 0),
                int(payload.get("installment_count") or 0),
                str(payload.get("notes") or "").strip(),
                now,
                now,
            ),
        )
        invoice_id = cur.lastrowid
    return get_invoice(int(invoice_id))



def update_invoice(invoice_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {"appointment_id", "payment_plan_id", "description", "amount_cents", "balance_cents", "currency", "status", "due_ts", "installment_number", "installment_count", "notes", "kind"}
    clean = {k: v for k, v in fields.items() if k in allowed}
    if not clean:
        return get_invoice(invoice_id)
    clean["updated_at"] = utcnow_iso()
    assignments = ", ".join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [invoice_id]
    with connect() as conn:
        conn.execute(f"UPDATE invoices SET {assignments} WHERE id = ?", tuple(params))
    return get_invoice(invoice_id)



def _append_invoice_note(existing: str, action: str, note: str = '') -> str:
    stamp = utcnow_iso()
    line = f"[{stamp}] {action}"
    note = str(note or '').strip()
    if note:
        line += f": {note}"
    existing = str(existing or '').strip()
    return f"{existing}\n{line}".strip() if existing else line


def apply_invoice_action(invoice_id: int, action: str, note: str = '') -> dict[str, Any] | None:
    invoice = get_invoice(invoice_id) or {}
    if not invoice:
        raise ValueError('Invoice not found.')
    action = str(action or '').strip().lower()
    if not action:
        raise ValueError('action is required')
    current_notes = str(invoice.get('notes') or '')
    if action == 'void':
        return update_invoice(invoice_id, {
            'status': 'void',
            'balance_cents': 0,
            'notes': _append_invoice_note(current_notes, 'voided', note),
        })
    if action == 'write_off':
        return update_invoice(invoice_id, {
            'status': 'written_off',
            'balance_cents': 0,
            'notes': _append_invoice_note(current_notes, 'written off', note),
        })
    if action == 'mark_paid':
        return update_invoice(invoice_id, {
            'status': 'paid',
            'balance_cents': 0,
            'notes': _append_invoice_note(current_notes, 'marked paid', note),
        })
    if action in {'reopen', 'mark_sent'}:
        with connect() as conn:
            paid_cents = int(conn.execute('SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE invoice_id = ?', (invoice_id,)).fetchone()[0])
            credited_cents = int(conn.execute("SELECT COALESCE(SUM(ABS(amount_cents)), 0) FROM invoices WHERE kind = 'credit_memo' AND notes LIKE ?", (f'%source_invoice_id:{invoice_id}%',)).fetchone()[0])
        amount_cents = int(invoice.get('amount_cents') or 0)
        new_balance = max(0, amount_cents - paid_cents - credited_cents)
        new_status = 'paid' if new_balance == 0 else 'sent'
        label = 'reopened' if action == 'reopen' else 'marked sent'
        return update_invoice(invoice_id, {
            'status': new_status,
            'balance_cents': new_balance,
            'notes': _append_invoice_note(current_notes, label, note),
        })
    raise ValueError('Unsupported invoice action.')


def create_credit_memo(invoice_id: int, amount_cents: int, note: str = '') -> dict[str, Any]:
    invoice = get_invoice(invoice_id) or {}
    if not invoice:
        raise ValueError('Invoice not found.')
    amount_cents = max(0, int(amount_cents or 0))
    if amount_cents <= 0:
        raise ValueError('amount_cents must be greater than zero.')
    current_balance = int(invoice.get('balance_cents') or 0)
    credit_cents = min(current_balance, amount_cents)
    if credit_cents <= 0:
        raise ValueError('Invoice has no open balance to credit.')
    memo = create_invoice({
        'org_id': int(invoice.get('org_id') or get_default_org_id()),
        'lead_id': int(invoice.get('lead_id') or 0),
        'appointment_id': int(invoice.get('appointment_id') or 0) or None,
        'kind': 'credit_memo',
        'description': f"Credit memo against {invoice.get('invoice_code') or invoice_id}",
        'amount_cents': -credit_cents,
        'balance_cents': 0,
        'currency': str(invoice.get('currency') or 'USD'),
        'status': 'paid',
        'due_ts': '',
        'notes': f"source_invoice_id:{invoice_id}\n{str(note or '').strip()}".strip(),
    }) or {}
    new_balance = max(0, current_balance - credit_cents)
    new_status = 'paid' if new_balance == 0 else 'partial'
    updated_invoice = update_invoice(invoice_id, {
        'balance_cents': new_balance,
        'status': new_status,
        'notes': _append_invoice_note(str(invoice.get('notes') or ''), 'credit memo applied', f"{credit_cents/100:.2f} {invoice.get('currency') or 'USD'} {note}".strip()),
    }) or invoice
    return {'credit_invoice': memo, 'invoice': updated_invoice}


def record_payment(payload: dict[str, Any]) -> dict[str, Any]:
    invoice_id = int(payload.get("invoice_id") or 0)
    invoice = get_invoice(invoice_id) or {}
    if not invoice:
        raise ValueError("Invoice not found.")
    amount_cents = max(0, int(payload.get("amount_cents") or 0))
    if amount_cents <= 0:
        raise ValueError("amount_cents must be greater than zero.")
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO payments (
                org_id, lead_id, appointment_id, invoice_id, amount_cents, method, reference, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(invoice.get("org_id") or get_default_org_id()),
                int(invoice.get("lead_id") or 0),
                int(invoice.get("appointment_id") or 0) or None,
                invoice_id,
                amount_cents,
                str(payload.get("method") or "cash").strip() or "cash",
                str(payload.get("reference") or "").strip(),
                str(payload.get("notes") or "").strip(),
                now,
            ),
        )
        payment_id = cur.lastrowid
    new_balance = max(0, int(invoice.get("balance_cents") or 0) - amount_cents)
    new_status = "paid" if new_balance == 0 else "partial"
    updated_invoice = update_invoice(invoice_id, {"balance_cents": new_balance, "status": new_status}) or invoice
    payment = get_row("SELECT * FROM payments WHERE id = ?", (int(payment_id),)) or {}
    return {"payment": payment, "invoice": updated_invoice}





def get_payment_plan(plan_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM payment_plans WHERE id = ?", (plan_id,))


def list_payment_plans_for_lead(lead_id: int) -> list[dict[str, Any]]:
    plans = list_rows("SELECT * FROM payment_plans WHERE lead_id = ? ORDER BY id DESC", (lead_id,))
    for plan in plans:
        plan_id = int(plan.get("id") or 0)
        invoices = list_rows("SELECT * FROM invoices WHERE payment_plan_id = ? ORDER BY installment_number ASC, id ASC", (plan_id,))
        plan["invoices"] = invoices
        plan["generated_invoice_count"] = len(invoices)
        plan["paid_cents"] = sum(int(item.get("amount_cents") or 0) - int(item.get("balance_cents") or 0) for item in invoices if int(item.get("amount_cents") or 0) > 0)
        plan["outstanding_cents"] = sum(int(item.get("balance_cents") or 0) for item in invoices if str(item.get("status") or "") not in {"void", "written_off"})
    return plans


def create_payment_plan(payload: dict[str, Any]) -> dict[str, Any]:
    lead_id = int(payload.get("lead_id") or 0)
    if not lead_id:
        raise ValueError("lead_id is required")
    lead = get_lead(lead_id) or {}
    org_id = int(payload.get("org_id") or lead.get("org_id") or get_default_org_id())
    total_cents = max(0, int(payload.get("total_cents") or 0))
    deposit_cents = max(0, int(payload.get("deposit_cents") or 0))
    installment_count = max(1, int(payload.get("installment_count") or 1))
    interval_days = max(1, int(payload.get("interval_days") or 30))
    if total_cents <= 0:
        raise ValueError("total_cents must be greater than zero")
    if deposit_cents > total_cents:
        raise ValueError("deposit_cents cannot exceed total_cents")
    title = str(payload.get("title") or "Payment plan").strip()
    if not title:
        raise ValueError("title is required")
    first_due_ts = str(payload.get("first_due_ts") or "").strip()
    currency = str(payload.get("currency") or "USD").strip() or "USD"
    notes = str(payload.get("notes") or "").strip()
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO payment_plans (
                org_id, lead_id, appointment_id, quote_id, title, total_cents, deposit_cents, currency,
                installment_count, interval_days, first_due_ts, status, notes, metadata_json, created_at, updated_at, cancelled_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                org_id,
                lead_id,
                int(payload.get("appointment_id") or 0) or None,
                int(payload.get("quote_id") or 0) or None,
                title,
                total_cents,
                deposit_cents,
                currency,
                installment_count,
                interval_days,
                first_due_ts,
                str(payload.get("status") or "active").strip() or "active",
                notes,
                json.dumps(payload.get("metadata") or {}),
                now,
                now,
                '',
            ),
        )
        plan_id = int(cur.lastrowid)
    return get_payment_plan(plan_id) or {}


def update_payment_plan(plan_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {"appointment_id", "quote_id", "title", "total_cents", "deposit_cents", "currency", "installment_count", "interval_days", "first_due_ts", "status", "notes", "cancelled_at", "metadata_json"}
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in allowed and key != "metadata":
            continue
        if key == "metadata":
            clean["metadata_json"] = json.dumps(value or {})
        else:
            clean[key] = value
    if not clean:
        return get_payment_plan(plan_id)
    clean["updated_at"] = utcnow_iso()
    assignments = ", ".join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [plan_id]
    with connect() as conn:
        conn.execute(f"UPDATE payment_plans SET {assignments} WHERE id = ?", tuple(params))
    return get_payment_plan(plan_id)


def generate_invoices_for_payment_plan(plan_id: int, invoice_status: str = "sent") -> dict[str, Any]:
    plan = get_payment_plan(plan_id) or {}
    if not plan:
        raise ValueError("Payment plan not found.")
    if str(plan.get("status") or "").lower() in {"cancelled", "void"}:
        raise ValueError("Cancelled plans cannot generate invoices.")
    existing = list_rows("SELECT * FROM invoices WHERE payment_plan_id = ? ORDER BY installment_number ASC, id ASC", (plan_id,))
    if existing:
        return {"plan": plan, "invoices": existing, "created_count": 0}
    total_cents = int(plan.get("total_cents") or 0)
    deposit_cents = max(0, min(total_cents, int(plan.get("deposit_cents") or 0)))
    installment_count = max(1, int(plan.get("installment_count") or 1))
    interval_days = max(1, int(plan.get("interval_days") or 30))
    currency = str(plan.get("currency") or "USD")
    due_raw = str(plan.get("first_due_ts") or "").strip()
    if due_raw:
        try:
            due_base = datetime.fromisoformat(due_raw.replace('Z', '+00:00'))
        except ValueError:
            due_base = datetime.utcnow()
    else:
        due_base = datetime.utcnow()
    created: list[dict[str, Any]] = []
    if deposit_cents > 0:
        created.append(create_invoice({
            "org_id": int(plan.get("org_id") or get_default_org_id()),
            "lead_id": int(plan.get("lead_id") or 0),
            "appointment_id": int(plan.get("appointment_id") or 0) or None,
            "payment_plan_id": plan_id,
            "kind": "deposit",
            "description": f"{plan.get('title') or 'Payment plan'} deposit",
            "amount_cents": deposit_cents,
            "balance_cents": deposit_cents,
            "currency": currency,
            "status": invoice_status,
            "due_ts": due_base.replace(microsecond=0).isoformat() + ("Z" if due_base.tzinfo is None else ""),
            "installment_number": 0,
            "installment_count": installment_count,
            "notes": f"payment plan deposit for plan_id:{plan_id}",
        }) or {})
    remainder = max(0, total_cents - deposit_cents)
    base = remainder // installment_count
    extra = remainder % installment_count
    for idx in range(1, installment_count + 1):
        amount = base + (1 if idx <= extra else 0)
        if amount <= 0:
            continue
        due_at = due_base + timedelta(days=interval_days * (idx - 1))
        created.append(create_invoice({
            "org_id": int(plan.get("org_id") or get_default_org_id()),
            "lead_id": int(plan.get("lead_id") or 0),
            "appointment_id": int(plan.get("appointment_id") or 0) or None,
            "payment_plan_id": plan_id,
            "kind": "service",
            "description": f"{plan.get('title') or 'Payment plan'} installment {idx}/{installment_count}",
            "amount_cents": amount,
            "balance_cents": amount,
            "currency": currency,
            "status": invoice_status,
            "due_ts": due_at.replace(microsecond=0).isoformat() + ("Z" if due_at.tzinfo is None else ""),
            "installment_number": idx,
            "installment_count": installment_count,
            "notes": f"payment plan installment {idx}/{installment_count} for plan_id:{plan_id}",
        }) or {})
    return {"plan": get_payment_plan(plan_id) or plan, "invoices": created, "created_count": len(created)}


def cancel_payment_plan(plan_id: int, note: str = '') -> dict[str, Any] | None:
    plan = get_payment_plan(plan_id) or {}
    if not plan:
        raise ValueError('Payment plan not found.')
    note = str(note or '').strip()
    notes = str(plan.get('notes') or '').strip()
    if note:
        notes = (notes + "\n" + note).strip() if notes else note
    return update_payment_plan(plan_id, {"status": "cancelled", "cancelled_at": utcnow_iso(), "notes": notes})


def get_recurring_membership(membership_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM recurring_memberships WHERE id = ?", (membership_id,))



def list_recurring_memberships(org_id: int | None = None, lead_id: int | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM recurring_memberships"
    params: list[Any] = []
    clauses: list[str] = []
    if org_id:
        clauses.append("org_id = ?")
        params.append(org_id)
    if lead_id:
        clauses.append("lead_id = ?")
        params.append(lead_id)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY id DESC"
    memberships = list_rows(query, tuple(params))
    for membership in memberships:
        membership_id = int(membership.get('id') or 0)
        membership['recent_invoices'] = list_rows(
            "SELECT * FROM invoices WHERE kind = 'membership' AND lead_id = ? AND notes LIKE ? ORDER BY id DESC LIMIT 6",
            (int(membership.get('lead_id') or 0), f"%membership_id:{membership_id}%"),
        )
        membership['recent_invoice_count'] = len(membership['recent_invoices'])
    return memberships



def create_recurring_membership(payload: dict[str, Any]) -> dict[str, Any]:
    lead_id = int(payload.get('lead_id') or 0)
    if not lead_id:
        raise ValueError('lead_id is required')
    lead = get_lead(lead_id) or {}
    if not lead:
        raise ValueError('Lead not found.')
    amount_cents = max(0, int(payload.get('amount_cents') or 0))
    if amount_cents <= 0:
        raise ValueError('amount_cents must be greater than zero')
    title = str(payload.get('title') or '').strip()
    if not title:
        raise ValueError('title is required')
    interval_days = max(1, int(payload.get('interval_days') or 30))
    next_invoice_ts = str(payload.get('next_invoice_ts') or '').strip() or utcnow_iso()
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO recurring_memberships (
                org_id, lead_id, appointment_id, quote_id, service_id, package_id, title, amount_cents,
                currency, interval_days, next_invoice_ts, status, last_invoiced_at, paused_at, cancelled_at,
                notes, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?, ?)
            """,
            (
                int(payload.get('org_id') or lead.get('org_id') or get_default_org_id()),
                lead_id,
                int(payload.get('appointment_id') or 0) or None,
                int(payload.get('quote_id') or 0) or None,
                int(payload.get('service_id') or 0) or None,
                int(payload.get('package_id') or 0) or None,
                title,
                amount_cents,
                str(payload.get('currency') or ((get_org(int(lead.get('org_id') or get_default_org_id())) or {}).get('currency') or 'USD')).strip() or 'USD',
                interval_days,
                next_invoice_ts,
                str(payload.get('status') or 'active').strip() or 'active',
                str(payload.get('notes') or '').strip(),
                json.dumps(payload.get('metadata') or {}),
                now,
                now,
            ),
        )
        membership_id = int(cur.lastrowid)
    return get_recurring_membership(membership_id) or {}



def update_recurring_membership(membership_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {'appointment_id', 'quote_id', 'service_id', 'package_id', 'title', 'amount_cents', 'currency', 'interval_days', 'next_invoice_ts', 'status', 'last_invoiced_at', 'paused_at', 'cancelled_at', 'notes', 'metadata_json'}
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in allowed and key != 'metadata':
            continue
        if key == 'metadata':
            clean['metadata_json'] = json.dumps(value or {})
        else:
            clean[key] = value
    if not clean:
        return get_recurring_membership(membership_id)
    clean['updated_at'] = utcnow_iso()
    assignments = ', '.join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [membership_id]
    with connect() as conn:
        conn.execute(f"UPDATE recurring_memberships SET {assignments} WHERE id = ?", tuple(params))
    return get_recurring_membership(membership_id)



def _membership_cycle_key(membership: dict[str, Any], due_ts: str) -> str:
    return f"membership_id:{int(membership.get('id') or 0)}|due:{due_ts}"



def create_membership_invoice(membership_id: int, invoice_status: str = 'sent', due_ts: str | None = None) -> dict[str, Any]:
    membership = get_recurring_membership(membership_id) or {}
    if not membership:
        raise ValueError('Membership not found.')
    status = str(membership.get('status') or '').lower()
    if status in {'cancelled', 'void'}:
        raise ValueError('Cancelled memberships cannot bill.')
    if status == 'paused':
        raise ValueError('Paused memberships cannot bill.')
    target_due = str(due_ts or membership.get('next_invoice_ts') or '').strip() or utcnow_iso()
    cycle_key = _membership_cycle_key(membership, target_due)
    existing = get_row(
        "SELECT * FROM invoices WHERE kind = 'membership' AND lead_id = ? AND notes LIKE ? ORDER BY id DESC LIMIT 1",
        (int(membership.get('lead_id') or 0), f"%{cycle_key}%"),
    )
    if existing:
        return {'membership': membership, 'invoice': existing, 'created': False}
    invoice = create_invoice({
        'org_id': int(membership.get('org_id') or get_default_org_id()),
        'lead_id': int(membership.get('lead_id') or 0),
        'appointment_id': int(membership.get('appointment_id') or 0) or None,
        'quote_id': int(membership.get('quote_id') or 0) or None,
        'kind': 'membership',
        'description': f"{membership.get('title') or 'Membership'} recurring charge",
        'amount_cents': int(membership.get('amount_cents') or 0),
        'balance_cents': int(membership.get('amount_cents') or 0),
        'currency': str(membership.get('currency') or 'USD').strip() or 'USD',
        'status': invoice_status,
        'due_ts': target_due,
        'notes': f"recurring membership charge | {cycle_key}",
    }) or {}
    try:
        due_dt = datetime.fromisoformat(target_due.replace('Z', '+00:00'))
    except ValueError:
        due_dt = datetime.utcnow()
    next_due = due_dt + timedelta(days=max(1, int(membership.get('interval_days') or 30)))
    updated = update_recurring_membership(membership_id, {
        'last_invoiced_at': utcnow_iso(),
        'next_invoice_ts': next_due.replace(microsecond=0).isoformat() + ('Z' if next_due.tzinfo is None else ''),
    }) or membership
    return {'membership': updated, 'invoice': invoice, 'created': True}



def run_due_membership_invoices(org_id: int | None = None, invoice_status: str = 'sent') -> list[dict[str, Any]]:
    now = utcnow_iso()
    query = "SELECT * FROM recurring_memberships WHERE status = 'active' AND next_invoice_ts != '' AND next_invoice_ts <= ?"
    params: list[Any] = [now]
    if org_id:
        query += ' AND org_id = ?'
        params.append(org_id)
    query += ' ORDER BY next_invoice_ts ASC, id ASC'
    memberships = list_rows(query, tuple(params))
    generated: list[dict[str, Any]] = []
    for membership in memberships:
        try:
            result = create_membership_invoice(int(membership.get('id') or 0), invoice_status=invoice_status)
        except ValueError:
            continue
        if result.get('invoice'):
            generated.append(result)
    return generated



def advance_membership_cycle(membership_id: int) -> dict[str, Any] | None:
    membership = get_recurring_membership(membership_id) or {}
    if not membership:
        raise ValueError('Membership not found.')
    due_raw = str(membership.get('next_invoice_ts') or '').strip() or utcnow_iso()
    try:
        due_dt = datetime.fromisoformat(due_raw.replace('Z', '+00:00'))
    except ValueError:
        due_dt = datetime.utcnow()
    next_due = due_dt + timedelta(days=max(1, int(membership.get('interval_days') or 30)))
    return update_recurring_membership(membership_id, {'next_invoice_ts': next_due.replace(microsecond=0).isoformat() + ('Z' if next_due.tzinfo is None else '')})



def pause_membership(membership_id: int, note: str = '') -> dict[str, Any] | None:
    membership = get_recurring_membership(membership_id) or {}
    if not membership:
        raise ValueError('Membership not found.')
    notes = str(membership.get('notes') or '').strip()
    note = str(note or '').strip()
    if note:
        notes = (notes + '\n' + note).strip() if notes else note
    return update_recurring_membership(membership_id, {'status': 'paused', 'paused_at': utcnow_iso(), 'notes': notes})



def resume_membership(membership_id: int, next_invoice_ts: str = '') -> dict[str, Any] | None:
    membership = get_recurring_membership(membership_id) or {}
    if not membership:
        raise ValueError('Membership not found.')
    next_due = str(next_invoice_ts or membership.get('next_invoice_ts') or '').strip() or utcnow_iso()
    return update_recurring_membership(membership_id, {'status': 'active', 'paused_at': '', 'next_invoice_ts': next_due})



def cancel_membership(membership_id: int, note: str = '') -> dict[str, Any] | None:
    membership = get_recurring_membership(membership_id) or {}
    if not membership:
        raise ValueError('Membership not found.')
    notes = str(membership.get('notes') or '').strip()
    note = str(note or '').strip()
    if note:
        notes = (notes + '\n' + note).strip() if notes else note
    return update_recurring_membership(membership_id, {'status': 'cancelled', 'cancelled_at': utcnow_iso(), 'notes': notes})


def get_billing_snapshot_for_lead(lead_id: int) -> dict[str, Any]:
    invoices = list_invoices_for_lead(lead_id)
    payments = list_payments_for_lead(lead_id)
    payment_commitments = list_payment_commitments_for_lead(lead_id)
    payment_plans = list_payment_plans_for_lead(lead_id)
    memberships = list_recurring_memberships(lead_id=lead_id)
    invoiced_cents = sum(int(item.get("amount_cents") or 0) for item in invoices)
    outstanding_cents = sum(int(item.get("balance_cents") or 0) for item in invoices if str(item.get("status") or "") not in {"void", "written_off"})
    paid_cents = sum(int(item.get("amount_cents") or 0) for item in payments)
    committed_cents = sum(int(item.get("requested_amount_cents") or 0) for item in payment_commitments if str(item.get("status") or '') in {"pending", "confirmed"})
    return {
        "invoices": invoices,
        "payments": payments,
        "payment_commitments": payment_commitments,
        "payment_plans": payment_plans,
        "memberships": memberships,
        "totals": {
            "invoice_count": len(invoices),
            "payment_count": len(payments),
            "payment_commitment_count": len(payment_commitments),
            "payment_plan_count": len(payment_plans),
            "membership_count": len(memberships),
            "active_membership_count": sum(1 for item in memberships if str(item.get('status') or '') == 'active'),
            "invoiced_cents": invoiced_cents,
            "paid_cents": paid_cents,
            "outstanding_cents": outstanding_cents,
            "committed_cents": committed_cents,
            "invoiced": cents_to_currency_value(invoiced_cents),
            "paid": cents_to_currency_value(paid_cents),
            "outstanding": cents_to_currency_value(outstanding_cents),
            "committed": cents_to_currency_value(committed_cents),
        },
    }



def next_quote_code(prefix: str = "Q") -> str:
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:-3]
    return f"{prefix}-{stamp}"


def list_services(org_id: int | None = None, active_only: bool = False) -> list[dict[str, Any]]:
    query, params = apply_scope('SELECT * FROM services', org_id)
    if active_only:
        query += ' AND active = 1'
    query += ' ORDER BY active DESC, name COLLATE NOCASE ASC'
    return list_rows(query, params)


def get_service(service_id: int) -> dict[str, Any] | None:
    return get_row('SELECT * FROM services WHERE id = ?', (service_id,))


def create_service(fields: dict[str, Any]) -> dict[str, Any] | None:
    org_id = int(fields.get('org_id') or get_default_org_id())
    slug = str(fields.get('slug') or '').strip()
    if not slug:
        raise ValueError('slug is required')
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            'INSERT INTO services (org_id, slug, name, description, base_price_cents, deposit_cents, duration_minutes, active, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (org_id, slug, str(fields.get('name') or '').strip(), str(fields.get('description') or '').strip(), int(fields.get('base_price_cents') or 0), int(fields.get('deposit_cents') or 0), int(fields.get('duration_minutes') or 30), 1 if bool(fields.get('active', True)) else 0, json.dumps(fields.get('metadata') or {}), now, now),
        )
        service_id = cur.lastrowid
    return get_service(int(service_id))


def update_service(service_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {'slug', 'name', 'description', 'base_price_cents', 'deposit_cents', 'duration_minutes', 'active', 'metadata_json'}
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in allowed and key != 'metadata':
            continue
        if key == 'metadata':
            clean['metadata_json'] = json.dumps(value or {})
        elif key == 'active':
            clean[key] = 1 if bool(value) else 0
        else:
            clean[key] = value
    if not clean:
        return get_service(service_id)
    clean['updated_at'] = utcnow_iso()
    assignments = ', '.join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [service_id]
    with connect() as conn:
        conn.execute(f'UPDATE services SET {assignments} WHERE id = ?', tuple(params))
    return get_service(service_id)


def list_packages(org_id: int | None = None, active_only: bool = False) -> list[dict[str, Any]]:
    query, params = apply_scope('SELECT * FROM packages', org_id)
    if active_only:
        query += ' AND active = 1'
    query += ' ORDER BY active DESC, name COLLATE NOCASE ASC'
    return list_rows(query, params)


def get_package(package_id: int) -> dict[str, Any] | None:
    return get_row('SELECT * FROM packages WHERE id = ?', (package_id,))


def create_package(fields: dict[str, Any]) -> dict[str, Any] | None:
    org_id = int(fields.get('org_id') or get_default_org_id())
    slug = str(fields.get('slug') or '').strip()
    if not slug:
        raise ValueError('slug is required')
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            'INSERT INTO packages (org_id, slug, name, description, total_price_cents, deposit_cents, active, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (org_id, slug, str(fields.get('name') or '').strip(), str(fields.get('description') or '').strip(), int(fields.get('total_price_cents') or 0), int(fields.get('deposit_cents') or 0), 1 if bool(fields.get('active', True)) else 0, json.dumps(fields.get('metadata') or {}), now, now),
        )
        package_id = cur.lastrowid
    return get_package(int(package_id))


def update_package(package_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {'slug', 'name', 'description', 'total_price_cents', 'deposit_cents', 'active', 'metadata_json'}
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in allowed and key != 'metadata':
            continue
        if key == 'metadata':
            clean['metadata_json'] = json.dumps(value or {})
        elif key == 'active':
            clean[key] = 1 if bool(value) else 0
        else:
            clean[key] = value
    if not clean:
        return get_package(package_id)
    clean['updated_at'] = utcnow_iso()
    assignments = ', '.join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [package_id]
    with connect() as conn:
        conn.execute(f'UPDATE packages SET {assignments} WHERE id = ?', tuple(params))
    return get_package(package_id)


def get_quote(quote_id: int) -> dict[str, Any] | None:
    return get_row('SELECT * FROM quotes WHERE id = ?', (quote_id,))


def get_quote_by_code(quote_code: str) -> dict[str, Any] | None:
    return get_row('SELECT * FROM quotes WHERE quote_code = ?', (quote_code,))


def list_quotes(org_id: int | None = None, lead_id: int | None = None) -> list[dict[str, Any]]:
    query, params = apply_scope('SELECT * FROM quotes', org_id)
    if lead_id:
        query += ' AND lead_id = ?'
        params = tuple(list(params) + [lead_id])
    query += ' ORDER BY id DESC'
    return list_rows(query, params)


def create_quote(fields: dict[str, Any]) -> dict[str, Any] | None:
    lead_id = int(fields.get('lead_id') or 0)
    if not lead_id:
        raise ValueError('lead_id is required')
    lead = get_lead(lead_id) or {}
    org_id = int(fields.get('org_id') or lead.get('org_id') or get_default_org_id())
    quote_code = str(fields.get('quote_code') or '').strip() or next_quote_code('Q')
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            'INSERT INTO quotes (org_id, lead_id, appointment_id, service_id, package_id, quote_code, title, summary, amount_cents, deposit_cents, currency, status, expires_at, accepted_at, accepted_name, accepted_title, accepted_company, acceptance_signature, acceptance_notes, terms_text, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (org_id, lead_id, int(fields.get('appointment_id') or 0) or None, int(fields.get('service_id') or 0) or None, int(fields.get('package_id') or 0) or None, quote_code, str(fields.get('title') or '').strip(), str(fields.get('summary') or '').strip(), int(fields.get('amount_cents') or 0), int(fields.get('deposit_cents') or 0), str(fields.get('currency') or 'USD').strip() or 'USD', str(fields.get('status') or 'draft').strip() or 'draft', str(fields.get('expires_at') or '').strip(), str(fields.get('accepted_at') or '').strip(), str(fields.get('accepted_name') or '').strip(), str(fields.get('accepted_title') or '').strip(), str(fields.get('accepted_company') or '').strip(), str(fields.get('acceptance_signature') or '').strip(), str(fields.get('acceptance_notes') or '').strip(), str(fields.get('terms_text') or '').strip(), json.dumps(fields.get('metadata') or {}), now, now),
        )
        quote_id = cur.lastrowid
    return get_quote(int(quote_id))


def update_quote(quote_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {'appointment_id','service_id','package_id','title','summary','amount_cents','deposit_cents','currency','status','expires_at','accepted_at','accepted_name','accepted_title','accepted_company','acceptance_signature','acceptance_notes','terms_text','metadata_json'}
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in allowed and key != 'metadata':
            continue
        if key == 'metadata':
            clean['metadata_json'] = json.dumps(value or {})
        else:
            clean[key] = value
    if not clean:
        return get_quote(quote_id)
    clean['updated_at'] = utcnow_iso()
    assignments = ', '.join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [quote_id]
    with connect() as conn:
        conn.execute(f'UPDATE quotes SET {assignments} WHERE id = ?', tuple(params))
    return get_quote(quote_id)


def get_open_quote_for_lead(lead_id: int) -> dict[str, Any] | None:
    return get_row("SELECT * FROM quotes WHERE lead_id = ? AND status IN ('draft','sent','accepted') ORDER BY id DESC LIMIT 1", (lead_id,))


def create_escalation(fields: dict[str, Any]) -> dict[str, Any] | None:
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            'INSERT INTO escalations (org_id, lead_id, session_id, appointment_id, priority, status, reason, summary, suggested_reply, source, created_at, updated_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (int(fields.get('org_id') or get_default_org_id()), int(fields.get('lead_id') or 0), int(fields.get('session_id') or 0) or None, int(fields.get('appointment_id') or 0) or None, str(fields.get('priority') or 'normal'), str(fields.get('status') or 'open'), str(fields.get('reason') or '').strip(), str(fields.get('summary') or '').strip(), str(fields.get('suggested_reply') or '').strip(), str(fields.get('source') or 'chat').strip(), now, now, str(fields.get('resolved_at') or '').strip()),
        )
        esc_id = cur.lastrowid
    return get_row('SELECT * FROM escalations WHERE id = ?', (int(esc_id),))


def list_escalations(org_id: int | None = None, status: str | None = None) -> list[dict[str, Any]]:
    query, params = apply_scope('SELECT * FROM escalations', org_id)
    if status:
        query += ' AND status = ?'
        params = tuple(list(params) + [status])
    query += ' ORDER BY CASE priority WHEN "urgent" THEN 3 WHEN "high" THEN 2 ELSE 1 END DESC, id DESC'
    return list_rows(query, params)


def update_escalation(escalation_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {'priority','status','reason','summary','suggested_reply','resolved_at'}
    clean = {k:v for k,v in fields.items() if k in allowed}
    if not clean:
        return get_row('SELECT * FROM escalations WHERE id = ?', (escalation_id,))
    clean['updated_at'] = utcnow_iso()
    assignments = ', '.join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [escalation_id]
    with connect() as conn:
        conn.execute(f'UPDATE escalations SET {assignments} WHERE id = ?', tuple(params))
    return get_row('SELECT * FROM escalations WHERE id = ?', (escalation_id,))


def get_lead_memory(lead_id: int) -> dict[str, Any] | None:
    return get_row('SELECT * FROM lead_memories WHERE lead_id = ?', (lead_id,))


def upsert_lead_memory(lead_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    existing = get_lead_memory(lead_id)
    now = utcnow_iso()
    lead = get_lead(lead_id) or {}
    if existing:
        allowed = {'summary','last_service_interest','booked_count','completed_count','no_show_count','paid_cents','outstanding_cents','preferences_json','objections_json','metadata_json','last_seen_at'}
        clean: dict[str, Any] = {}
        for key, value in fields.items():
            if key not in allowed and key not in {'preferences','objections','metadata'}:
                continue
            if key == 'preferences':
                clean['preferences_json'] = json.dumps(value or [])
            elif key == 'objections':
                clean['objections_json'] = json.dumps(value or [])
            elif key == 'metadata':
                clean['metadata_json'] = json.dumps(value or {})
            else:
                clean[key] = value
        clean['updated_at'] = now
        assignments = ', '.join(f"{column} = ?" for column in clean)
        params = list(clean.values()) + [lead_id]
        with connect() as conn:
            conn.execute(f'UPDATE lead_memories SET {assignments} WHERE lead_id = ?', tuple(params))
    else:
        with connect() as conn:
            conn.execute(
                'INSERT INTO lead_memories (org_id, lead_id, summary, last_service_interest, booked_count, completed_count, no_show_count, paid_cents, outstanding_cents, preferences_json, objections_json, metadata_json, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (int(lead.get('org_id') or get_default_org_id()), lead_id, str(fields.get('summary') or '').strip(), str(fields.get('last_service_interest') or '').strip(), int(fields.get('booked_count') or 0), int(fields.get('completed_count') or 0), int(fields.get('no_show_count') or 0), int(fields.get('paid_cents') or 0), int(fields.get('outstanding_cents') or 0), json.dumps(fields.get('preferences') or []), json.dumps(fields.get('objections') or []), json.dumps(fields.get('metadata') or {}), str(fields.get('last_seen_at') or now), now, now),
            )
    return get_lead_memory(lead_id)


def refresh_lead_memory(lead_id: int) -> dict[str, Any] | None:
    lead = get_lead(lead_id) or {}
    if not lead:
        return None
    appointments = list_appointments_for_lead(lead_id)
    billing = get_billing_snapshot_for_lead(lead_id)
    messages = get_conversation_for_lead(lead_id)
    existing = get_lead_memory(lead_id) or {}
    preferences = existing.get('preferences') or []
    preferred_schedule = str(lead.get('preferred_schedule') or '').strip()
    if preferred_schedule and preferred_schedule not in preferences:
        preferences = list(preferences) + [preferred_schedule]
    objections = list(existing.get('objections') or [])
    for msg in messages[-10:]:
        text = str(msg.get('text') or '').lower()
        for token, label in [('price', 'price objection'), ('budget', 'budget objection'), ('later', 'timing hesitation'), ('not sure', 'uncertainty'), ('human', 'human requested')]:
            if token in text and label not in objections:
                objections.append(label)
    booked_count = sum(1 for a in appointments if str(a.get('status') or '') in {'booked','confirmed','completed','no_show'})
    completed_count = sum(1 for a in appointments if str(a.get('status') or '') == 'completed')
    no_show_count = sum(1 for a in appointments if str(a.get('status') or '') == 'no_show')
    summary_parts = []
    if lead.get('service_interest'):
        summary_parts.append(f"Interested in {lead.get('service_interest')}")
    if preferred_schedule:
        summary_parts.append(f"Prefers {preferred_schedule}")
    if objections:
        summary_parts.append('Recent objections: ' + ', '.join(objections[:3]))
    if booked_count:
        summary_parts.append(f"Booking history {booked_count} total / {completed_count} completed / {no_show_count} no-show")
    summary = '. '.join(summary_parts).strip()
    return upsert_lead_memory(lead_id, {
        'summary': summary,
        'last_service_interest': str(lead.get('service_interest') or ''),
        'booked_count': booked_count,
        'completed_count': completed_count,
        'no_show_count': no_show_count,
        'paid_cents': int((billing.get('totals') or {}).get('paid_cents') or 0),
        'outstanding_cents': int((billing.get('totals') or {}).get('outstanding_cents') or 0),
        'preferences': preferences[:10],
        'objections': objections[:10],
        'metadata': {'last_quote_status': (get_open_quote_for_lead(lead_id) or {}).get('status') or ''},
        'last_seen_at': utcnow_iso(),
    })


def list_portal_documents_for_lead(lead_id: int) -> list[dict[str, Any]]:
    return list_rows('SELECT * FROM portal_documents WHERE lead_id = ? ORDER BY required DESC, id ASC', (lead_id,))


def create_portal_document(fields: dict[str, Any]) -> dict[str, Any] | None:
    lead_id = int(fields.get('lead_id') or 0)
    if not lead_id:
        raise ValueError('lead_id is required')
    lead = get_lead(lead_id) or {}
    if not lead:
        raise ValueError('Lead not found.')
    title = str(fields.get('title') or '').strip()
    if not title:
        raise ValueError('title is required')
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            'INSERT INTO portal_documents (org_id, lead_id, appointment_id, title, body, kind, required, status, signed_name, signed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                int(fields.get('org_id') or lead.get('org_id') or get_default_org_id()),
                lead_id,
                int(fields.get('appointment_id') or 0) or None,
                title,
                str(fields.get('body') or '').strip(),
                str(fields.get('kind') or 'document').strip() or 'document',
                1 if bool(fields.get('required')) else 0,
                str(fields.get('status') or 'pending').strip() or 'pending',
                str(fields.get('signed_name') or '').strip(),
                str(fields.get('signed_at') or '').strip(),
                now,
                now,
            ),
        )
        document_id = int(cur.lastrowid)
    return get_row('SELECT * FROM portal_documents WHERE id = ?', (document_id,))


def update_portal_document(document_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {'appointment_id', 'title', 'body', 'kind', 'required', 'status', 'signed_name', 'signed_at'}
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in allowed:
            continue
        if key == 'required':
            clean[key] = 1 if bool(value) else 0
        else:
            clean[key] = value
    if 'status' in clean and str(clean.get('status') or '') != 'signed':
        clean['signed_name'] = ''
        clean['signed_at'] = ''
    if not clean:
        return get_row('SELECT * FROM portal_documents WHERE id = ?', (document_id,))
    clean['updated_at'] = utcnow_iso()
    assignments = ', '.join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [document_id]
    with connect() as conn:
        conn.execute(f'UPDATE portal_documents SET {assignments} WHERE id = ?', tuple(params))
    return get_row('SELECT * FROM portal_documents WHERE id = ?', (document_id,))


def get_or_create_portal_documents_for_lead(lead_id: int, appointment_id: int | None = None, org_id: int | None = None) -> list[dict[str, Any]]:
    lead = get_lead(lead_id) or {}
    resolved_org_id = int(org_id or lead.get('org_id') or get_default_org_id())
    settings = get_org(resolved_org_id) or {}
    defaults = [
        ('service-prep', 'Service Preparation Terms', f"You agree to arrive prepared for the scheduled service discussion and provide accurate intake information. {settings.get('booking_notice') or ''}", 1),
        ('payment-terms', 'Payment Terms', f"Any required deposit or open invoice remains due according to the desk instructions. {settings.get('payment_instructions') or ''}", 0),
    ]
    now = utcnow_iso()
    with connect() as conn:
        for kind, title, body, required in defaults:
            row = conn.execute('SELECT id FROM portal_documents WHERE lead_id = ? AND kind = ?', (lead_id, kind)).fetchone()
            if not row:
                conn.execute('INSERT INTO portal_documents (org_id, lead_id, appointment_id, title, body, kind, required, status, signed_name, signed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    (resolved_org_id, lead_id, appointment_id, title, body.strip(), kind, required, 'pending', '', '', now, now))
    return list_portal_documents_for_lead(lead_id)


def sign_portal_document(document_id: int, signed_name: str) -> dict[str, Any] | None:
    stamp = utcnow_iso()
    with connect() as conn:
        conn.execute('UPDATE portal_documents SET status = ?, signed_name = ?, signed_at = ?, updated_at = ? WHERE id = ?', ('signed', signed_name.strip(), stamp, stamp, document_id))
    return get_row('SELECT * FROM portal_documents WHERE id = ?', (document_id,))


def _artifact_metadata_columns() -> str:
    return 'id, org_id, lead_id, appointment_id, quote_id, document_id, category, uploader_scope, visible_to_client, filename, mime_type, size_bytes, notes, status, deleted_at, version_group, version_number, supersedes_artifact_id, superseded_by_artifact_id, created_at, updated_at'


def list_artifact_versions(version_group: str, include_deleted: bool = False) -> list[dict[str, Any]]:
    group = str(version_group or '').strip()
    if not group:
        return []
    query = f'SELECT {_artifact_metadata_columns()} FROM proof_artifacts WHERE version_group = ?'
    params: list[Any] = [group]
    if not include_deleted:
        query += " AND status != 'deleted'"
    query += ' ORDER BY version_number DESC, id DESC'
    return list_rows(query, tuple(params))


def list_artifacts_for_lead(lead_id: int, visible_to_client: bool | None = None, include_archived: bool = False, include_deleted: bool = False) -> list[dict[str, Any]]:
    query = f'SELECT {_artifact_metadata_columns()} FROM proof_artifacts WHERE lead_id = ?'
    params: list[Any] = [lead_id]
    if visible_to_client is not None:
        query += ' AND visible_to_client = ?'
        params.append(1 if visible_to_client else 0)
    if include_deleted:
        pass
    elif not include_archived:
        query += " AND status = 'active'"
    else:
        query += " AND status != 'deleted'"
    query += ' ORDER BY created_at DESC, id DESC'
    artifacts = list_rows(query, tuple(params))
    for artifact in artifacts:
        group = str(artifact.get('version_group') or '').strip()
        if not group:
            group = f"artifact-{int(artifact.get('id') or 0)}"
            artifact['version_group'] = group
        versions = list_artifact_versions(group, include_deleted=include_deleted)
        artifact['versions'] = versions
        artifact['version_count'] = len(versions)
        artifact['is_latest_version'] = bool(versions and int(versions[0].get('id') or 0) == int(artifact.get('id') or 0))
    return artifacts


def get_artifact(artifact_id: int, include_content: bool = False) -> dict[str, Any] | None:
    columns = '*' if include_content else _artifact_metadata_columns()
    artifact = get_row(f'SELECT {columns} FROM proof_artifacts WHERE id = ?', (artifact_id,))
    if artifact:
        group = str(artifact.get('version_group') or '').strip()
        if not group:
            group = f"artifact-{artifact_id}"
            artifact['version_group'] = group
        artifact['versions'] = list_artifact_versions(group, include_deleted=False)
        artifact['version_count'] = len(artifact['versions'])
        artifact['is_latest_version'] = bool(artifact['versions'] and int(artifact['versions'][0].get('id') or 0) == artifact_id)
    return artifact


def create_artifact(fields: dict[str, Any]) -> dict[str, Any] | None:
    lead_id = int(fields.get('lead_id') or 0)
    if not lead_id:
        raise ValueError('lead_id is required')
    lead = get_lead(lead_id) or {}
    if not lead:
        raise ValueError('Lead not found.')
    filename = str(fields.get('filename') or '').strip()
    content_b64 = str(fields.get('content_b64') or '').strip()
    if not filename:
        raise ValueError('filename is required')
    if not content_b64:
        raise ValueError('content_b64 is required')
    version_group = str(fields.get('version_group') or '').strip() or f"artifact-{uuid.uuid4().hex}"
    version_number = max(1, int(fields.get('version_number') or 1))
    now = utcnow_iso()
    with connect() as conn:
        cur = conn.execute(
            'INSERT INTO proof_artifacts (org_id, lead_id, appointment_id, quote_id, document_id, category, uploader_scope, visible_to_client, filename, mime_type, size_bytes, content_b64, notes, status, deleted_at, version_group, version_number, supersedes_artifact_id, superseded_by_artifact_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                int(fields.get('org_id') or lead.get('org_id') or get_default_org_id()),
                lead_id,
                int(fields.get('appointment_id') or 0) or None,
                int(fields.get('quote_id') or 0) or None,
                int(fields.get('document_id') or 0) or None,
                str(fields.get('category') or 'evidence').strip() or 'evidence',
                str(fields.get('uploader_scope') or 'admin').strip() or 'admin',
                1 if bool(fields.get('visible_to_client', True)) else 0,
                filename,
                str(fields.get('mime_type') or 'application/octet-stream').strip() or 'application/octet-stream',
                int(fields.get('size_bytes') or 0),
                content_b64,
                str(fields.get('notes') or '').strip(),
                str(fields.get('status') or 'active').strip() or 'active',
                str(fields.get('deleted_at') or '').strip(),
                version_group,
                version_number,
                int(fields.get('supersedes_artifact_id') or 0) or None,
                int(fields.get('superseded_by_artifact_id') or 0) or None,
                now,
                now,
            ),
        )
        artifact_id = int(cur.lastrowid)
    return get_artifact(artifact_id)


def update_artifact(artifact_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {'category', 'visible_to_client', 'notes', 'status', 'deleted_at', 'superseded_by_artifact_id', 'filename', 'mime_type', 'size_bytes', 'content_b64'}
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in allowed:
            continue
        if key == 'visible_to_client':
            clean[key] = 1 if bool(value) else 0
        else:
            clean[key] = value
    if not clean:
        return get_artifact(artifact_id)
    clean['updated_at'] = utcnow_iso()
    assignments = ', '.join(f"{column} = ?" for column in clean)
    params = list(clean.values()) + [artifact_id]
    with connect() as conn:
        conn.execute(f'UPDATE proof_artifacts SET {assignments} WHERE id = ?', tuple(params))
    return get_artifact(artifact_id)


def replace_artifact(artifact_id: int, fields: dict[str, Any]) -> dict[str, Any]:
    current = get_artifact(artifact_id, include_content=True) or {}
    if not current or str(current.get('status') or '') == 'deleted':
        raise ValueError('Artifact not found.')
    version_group = str(current.get('version_group') or '').strip() or f"artifact-{artifact_id}"
    versions = list_artifact_versions(version_group, include_deleted=True)
    next_version = max([int(item.get('version_number') or 1) for item in versions] + [1]) + 1
    created = create_artifact({
        'org_id': int(current.get('org_id') or get_default_org_id()),
        'lead_id': int(current.get('lead_id') or 0),
        'appointment_id': int(fields.get('appointment_id') or current.get('appointment_id') or 0) or None,
        'quote_id': int(fields.get('quote_id') or current.get('quote_id') or 0) or None,
        'document_id': int(fields.get('document_id') or current.get('document_id') or 0) or None,
        'category': str(fields.get('category') or current.get('category') or 'evidence').strip() or 'evidence',
        'uploader_scope': str(fields.get('uploader_scope') or current.get('uploader_scope') or 'admin').strip() or 'admin',
        'visible_to_client': bool(fields.get('visible_to_client')) if fields.get('visible_to_client') is not None else bool(current.get('visible_to_client')),
        'filename': str(fields.get('filename') or '').strip(),
        'mime_type': str(fields.get('mime_type') or current.get('mime_type') or 'application/octet-stream').strip() or 'application/octet-stream',
        'size_bytes': int(fields.get('size_bytes') or 0),
        'content_b64': str(fields.get('content_b64') or '').strip(),
        'notes': str(fields.get('notes') or current.get('notes') or '').strip(),
        'version_group': version_group,
        'version_number': next_version,
        'supersedes_artifact_id': artifact_id,
    }) or {}
    update_artifact(artifact_id, {'status': 'superseded', 'superseded_by_artifact_id': int(created.get('id') or 0) or None})
    refreshed = get_artifact(int(created.get('id') or 0)) or created
    return {'artifact': refreshed, 'replaced': get_artifact(artifact_id), 'versions': list_artifact_versions(version_group, include_deleted=False)}


def delete_artifact(artifact_id: int) -> dict[str, Any] | None:
    current = get_artifact(artifact_id) or {}
    if not current:
        raise ValueError('Artifact not found.')
    if str(current.get('status') or '') == 'deleted':
        return current
    return update_artifact(artifact_id, {'status': 'deleted', 'deleted_at': utcnow_iso(), 'visible_to_client': False})


def restore_artifact(artifact_id: int) -> dict[str, Any] | None:
    current = get_row(f'SELECT {_artifact_metadata_columns()} FROM proof_artifacts WHERE id = ?', (artifact_id,)) or {}
    if not current:
        raise ValueError('Artifact not found.')
    if str(current.get('status') or '') != 'deleted':
        return get_artifact(artifact_id)
    version_group = str(current.get('version_group') or '').strip() or f'artifact-{artifact_id}'
    active_sibling = get_row('SELECT id FROM proof_artifacts WHERE version_group = ? AND status = ? AND id != ? ORDER BY version_number DESC, id DESC LIMIT 1', (version_group, 'active', artifact_id))
    if active_sibling:
        raise ValueError('A live version already exists for this artifact. Replace the live version instead of restoring the deleted copy.')
    return update_artifact(artifact_id, {'status': 'active', 'deleted_at': ''})


def batch_update_artifacts(artifact_ids: list[int], action: str) -> dict[str, Any]:
    unique_ids = []
    seen: set[int] = set()
    for raw in artifact_ids:
        item_id = int(raw or 0)
        if not item_id or item_id in seen:
            continue
        seen.add(item_id)
        unique_ids.append(item_id)
    updated: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for artifact_id in unique_ids:
        try:
            if action == 'delete':
                item = delete_artifact(artifact_id)
            elif action == 'restore':
                item = restore_artifact(artifact_id)
            elif action == 'make_visible':
                item = update_artifact(artifact_id, {'visible_to_client': True})
            elif action == 'make_internal':
                item = update_artifact(artifact_id, {'visible_to_client': False})
            else:
                raise ValueError('Unsupported artifact action.')
            if item:
                updated.append(item)
        except ValueError as exc:
            errors.append({'id': artifact_id, 'error': str(exc)})
    return {'updated': updated, 'errors': errors}



def build_quote_acceptance_receipt(quote_id: int) -> dict[str, Any]:
    quote = get_quote(quote_id) or {}
    if not quote:
        raise ValueError('Quote not found.')
    lead = get_lead(int(quote.get('lead_id') or 0)) or {}
    org = get_org(int(quote.get('org_id') or get_default_org_id())) or {}
    appointment = get_appointment(int(quote.get('appointment_id') or 0)) if int(quote.get('appointment_id') or 0) else None
    invoice = get_row(
        "SELECT * FROM invoices WHERE lead_id = ? AND appointment_id IS ? AND kind = 'quote_deposit' ORDER BY id DESC LIMIT 1",
        (int(quote.get('lead_id') or 0), int(quote.get('appointment_id') or 0) or None),
    )
    metadata = dict(quote.get('metadata') or {})
    acceptance = {
        'accepted_at': str(quote.get('accepted_at') or ''),
        'accepted_name': str(quote.get('accepted_name') or ''),
        'accepted_title': str(quote.get('accepted_title') or ''),
        'accepted_company': str(quote.get('accepted_company') or ''),
        'acceptance_signature': str(quote.get('acceptance_signature') or ''),
        'acceptance_notes': str(quote.get('acceptance_notes') or ''),
    }
    return {
        'quote': quote,
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
            'support_email': org.get('support_email') or '',
            'support_phone': org.get('support_phone') or '',
            'currency': org.get('currency') or quote.get('currency') or 'USD',
            'payment_instructions': org.get('payment_instructions') or '',
        },
        'appointment': {
            'id': (appointment or {}).get('id'),
            'confirmation_code': (appointment or {}).get('confirmation_code') or '',
            'start_ts': (appointment or {}).get('start_ts') or '',
            'end_ts': (appointment or {}).get('end_ts') or '',
            'status': (appointment or {}).get('status') or '',
        },
        'deposit_invoice': invoice or {},
        'acceptance': acceptance,
        'metadata': metadata,
        'generated_at': utcnow_iso(),
    }


def render_quote_acceptance_receipt_text(quote_id: int) -> str:
    receipt = build_quote_acceptance_receipt(quote_id)
    quote = receipt.get('quote') or {}
    lead = receipt.get('lead') or {}
    org = receipt.get('org') or {}
    appointment = receipt.get('appointment') or {}
    acceptance = receipt.get('acceptance') or {}
    invoice = receipt.get('deposit_invoice') or {}
    lines = [
        'QUOTE ACCEPTANCE RECEIPT',
        '======================',
        f"Generated: {receipt.get('generated_at') or ''}",
        '',
        f"Desk: {org.get('name') or ''}",
        f"Support: {org.get('support_email') or ''} {org.get('support_phone') or ''}",
        '',
        f"Quote: {quote.get('quote_code') or ''}",
        f"Title: {quote.get('title') or ''}",
        f"Status: {quote.get('status') or ''}",
        f"Total: {cents_to_currency_value(int(quote.get('amount_cents') or 0)):.2f} {quote.get('currency') or 'USD'}",
        f"Deposit: {cents_to_currency_value(int(quote.get('deposit_cents') or 0)):.2f} {quote.get('currency') or 'USD'}",
        '',
        f"Accepted by: {acceptance.get('accepted_name') or ''}",
        f"Title: {acceptance.get('accepted_title') or ''}",
        f"Company: {acceptance.get('accepted_company') or ''}",
        f"Signature: {acceptance.get('acceptance_signature') or ''}",
        f"Accepted at: {acceptance.get('accepted_at') or ''}",
        '',
        f"Lead: {lead.get('name') or ''}",
        f"Business: {lead.get('business_name') or ''}",
        f"Email: {lead.get('email') or ''}",
        f"Phone: {lead.get('phone') or ''}",
        '',
        f"Appointment code: {appointment.get('confirmation_code') or ''}",
        f"Appointment time: {appointment.get('start_ts') or ''}",
    ]
    if quote.get('terms_text'):
        lines.extend(['', 'Terms', '-----', str(quote.get('terms_text') or '')])
    if acceptance.get('acceptance_notes'):
        lines.extend(['', 'Acceptance notes', '----------------', str(acceptance.get('acceptance_notes') or '')])
    if invoice:
        lines.extend([
            '',
            'Deposit invoice',
            '---------------',
            f"Invoice: {invoice.get('invoice_code') or ''}",
            f"Status: {invoice.get('status') or ''}",
            f"Balance: {cents_to_currency_value(int(invoice.get('balance_cents') or 0)):.2f} {invoice.get('currency') or quote.get('currency') or 'USD'}",
            f"Due: {invoice.get('due_ts') or ''}",
        ])
    if org.get('payment_instructions'):
        lines.extend(['', 'Payment instructions', '--------------------', str(org.get('payment_instructions') or '')])
    return '\n'.join(lines).strip() + '\n'


def render_org_onboarding_runbook_markdown(org_id: int, preset_slug: str = '') -> str:
    plan = get_org_onboarding_plan(org_id, preset_slug)
    org = plan.get('org') or {}
    readiness = plan.get('readiness') or {}
    preset = plan.get('preset') or {}
    lines = [
        f"# Desk Onboarding Runbook · {org.get('name') or 'Desk'}",
        '',
        f"Generated: {plan.get('generated_at') or utcnow_iso()}",
        f"Preset: {preset.get('name') or preset.get('slug') or ''}",
        f"Readiness: {readiness.get('percent_complete') or 0}% ({readiness.get('completed_count') or 0}/{readiness.get('total_count') or 0})",
        '',
        '## Desk basics',
        '',
        f"- Name: {org.get('name') or ''}",
        f"- Slug: {org.get('slug') or ''}",
        f"- Support email: {org.get('support_email') or ''}",
        f"- Support phone: {org.get('support_phone') or ''}",
        f"- Timezone: {org.get('timezone') or ''}",
        f"- Currency: {org.get('currency') or ''}",
        '',
    ]
    next_steps = list(readiness.get('next_steps') or [])
    if next_steps:
        lines.extend(['## Next focus', ''])
        lines.extend([f"- {step}" for step in next_steps])
        lines.append('')
    for stage in list(plan.get('stages') or []):
        lines.extend([
            f"## {stage.get('title') or stage.get('key') or 'Stage'}",
            '',
            str(stage.get('description') or ''),
            '',
            f"Stage progress: {stage.get('percent_complete') or 0}% ({stage.get('done_count') or 0}/{stage.get('total_count') or 0})",
            '',
        ])
        if stage.get('preset_hint'):
            lines.extend([f"> {stage.get('preset_hint')}", ''])
        for task in list(stage.get('tasks') or []):
            mark = 'x' if task.get('done') else ' '
            lines.append(f"- [{mark}] {task.get('label') or task.get('key') or 'Task'} — {task.get('detail') or ''}")
        lines.append('')
    lines.extend(['## Summary text', '', str(plan.get('summary_text') or ''), ''])
    return '\n'.join(lines).strip() + '\n'
