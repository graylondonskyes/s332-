from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

HOST = "127.0.0.1"
PORT = 8123
MOCK_PORT = 8124
BASE = f"http://{HOST}:{PORT}"
MOCK_BASE = f"http://{HOST}:{MOCK_PORT}"
REPORT_PATH = ROOT_DIR / "smoke" / "last_smoke_report.json"

os.environ["APP_ENV"] = "development"
os.environ["SESSION_COOKIE_SECURE"] = "false"
os.environ["ENABLE_BACKGROUND_WORKER"] = "true"
os.environ["BACKGROUND_WORKER_INTERVAL_SECONDS"] = "5"
os.environ["VOICE_WEBHOOK_URL"] = f"{MOCK_BASE}/voice"
os.environ["EMAIL_WEBHOOK_URL"] = f"{MOCK_BASE}/email"
os.environ["SMS_WEBHOOK_URL"] = f"{MOCK_BASE}/sms"
os.environ["SMS_INBOUND_SECRET"] = "sms-secret-123"
os.environ["EMAIL_INBOUND_SECRET"] = "email-secret-123"
os.environ["GOOGLE_CALENDAR_ACCESS_TOKEN"] = "test-google"
os.environ["GOOGLE_CALENDAR_API_BASE"] = f"{MOCK_BASE}/google"
os.environ["GOOGLE_CALENDAR_ID"] = "primary"
os.environ["MICROSOFT_CALENDAR_ACCESS_TOKEN"] = "test-ms"
os.environ["MICROSOFT_GRAPH_BASE"] = f"{MOCK_BASE}/microsoft"
os.environ["MICROSOFT_CALENDAR_ID"] = "primary"

from app import db  # noqa: E402
from server import create_server  # noqa: E402


MOCK_STATE = {
    "google_events": {},
    "microsoft_events": {},
    "voice_calls": [],
    "next_google": 1,
    "next_microsoft": 1,
}


class MockHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return

    def _json(self, payload: dict | list, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8")) if raw else {}

    def do_POST(self) -> None:
        path = self.path
        if path == "/voice":
            payload = self._read()
            MOCK_STATE["voice_calls"].append(payload)
            self._json(
                {
                    "provider": "voice-mock",
                    "status": "completed",
                    "id": f"voice-{len(MOCK_STATE['voice_calls'])}",
                    "transcript": f"Voice mock completed for {payload.get('to')}",
                    "outcome": "connected",
                    "duration_seconds": 51,
                }
            )
            return
        if path in {"/email", "/sms"}:
            payload = self._read()
            self._json({"id": f"{path.strip('/')}-msg-{int(time.time()*1000)}", "accepted": True, "payload": payload})
            return
        if path == "/google/freeBusy":
            payload = self._read()
            busy = []
            for event in MOCK_STATE["google_events"].values():
                if event.get("status") == "cancelled":
                    continue
                busy.append({"start": event["start"]["dateTime"], "end": event["end"]["dateTime"]})
            self._json({"calendars": {payload["items"][0]["id"]: {"busy": busy}}})
            return
        if path == "/google/calendars/primary/events":
            payload = self._read()
            event_id = f"g{MOCK_STATE['next_google']}"
            MOCK_STATE["next_google"] += 1
            payload["id"] = event_id
            payload["htmlLink"] = f"{MOCK_BASE}/google/event/{event_id}"
            MOCK_STATE["google_events"][event_id] = payload
            self._json(payload)
            return
        if path == "/microsoft/me/calendar/events":
            payload = self._read()
            event_id = f"m{MOCK_STATE['next_microsoft']}"
            MOCK_STATE["next_microsoft"] += 1
            payload["id"] = event_id
            payload["webLink"] = f"{MOCK_BASE}/microsoft/event/{event_id}"
            MOCK_STATE["microsoft_events"][event_id] = payload
            self._json(payload)
            return
        self._json({"error": "not found"}, status=404)

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/microsoft/me/calendarView":
            events = []
            for event in MOCK_STATE["microsoft_events"].values():
                if event.get("isCancelled"):
                    continue
                events.append(event)
            self._json({"value": events})
            return
        self._json({"error": "not found"}, status=404)

    def do_PUT(self) -> None:
        if self.path.startswith("/google/calendars/primary/events/"):
            payload = self._read()
            event_id = self.path.rsplit("/", 1)[-1]
            payload["id"] = event_id
            payload["htmlLink"] = f"{MOCK_BASE}/google/event/{event_id}"
            MOCK_STATE["google_events"][event_id] = payload
            self._json(payload)
            return
        self._json({"error": "not found"}, status=404)

    def do_PATCH(self) -> None:
        if self.path.startswith("/microsoft/me/calendar/events/"):
            event_id = self.path.rsplit("/", 1)[-1]
            payload = self._read()
            current = MOCK_STATE["microsoft_events"].get(event_id, {})
            current.update(payload)
            current["id"] = event_id
            current.setdefault("webLink", f"{MOCK_BASE}/microsoft/event/{event_id}")
            MOCK_STATE["microsoft_events"][event_id] = current
            self._json(current)
            return
        self._json({"error": "not found"}, status=404)

    def do_DELETE(self) -> None:
        if self.path.startswith("/google/calendars/primary/events/"):
            event_id = self.path.rsplit("/", 1)[-1]
            if event_id in MOCK_STATE["google_events"]:
                MOCK_STATE["google_events"][event_id]["status"] = "cancelled"
            self.send_response(204)
            self.end_headers()
            return
        if self.path.startswith("/microsoft/me/calendar/events/"):
            event_id = self.path.rsplit("/", 1)[-1]
            if event_id in MOCK_STATE["microsoft_events"]:
                MOCK_STATE["microsoft_events"][event_id]["isCancelled"] = True
            self.send_response(204)
            self.end_headers()
            return
        self._json({"error": "not found"}, status=404)



def request_json(path: str, method: str = "GET", payload: dict | None = None, headers: dict[str, str] | None = None) -> tuple[dict, dict]:
    data = None
    req_headers = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=12) as resp:
        body = json.loads(resp.read().decode("utf-8"))
        return body, dict(resp.headers.items())


def request_text(path: str, headers: dict[str, str] | None = None) -> tuple[str, dict]:
    req = urllib.request.Request(f"{BASE}{path}", headers=dict(headers or {}), method="GET")
    with urllib.request.urlopen(req, timeout=12) as resp:
        body = resp.read().decode("utf-8")
        return body, dict(resp.headers.items())


def request_bytes(path: str, headers: dict[str, str] | None = None) -> tuple[bytes, dict]:
    req = urllib.request.Request(f"{BASE}{path}", headers=dict(headers or {}), method="GET")
    with urllib.request.urlopen(req, timeout=12) as resp:
        body = resp.read()
        return body, dict(resp.headers.items())



def main() -> None:
    if db.DB_PATH.exists():
        db.DB_PATH.unlink()
    db.init_db()

    mock_server = ThreadingHTTPServer((HOST, MOCK_PORT), MockHandler)
    mock_thread = Thread(target=mock_server.serve_forever, daemon=True)
    mock_thread.start()

    server = create_server(HOST, PORT)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.4)

    steps: list[dict] = []

    def record(name: str, ok: bool, detail: dict | str) -> None:
        steps.append({"name": name, "ok": ok, "detail": detail})

    try:
        health, _ = request_json("/api/health")
        assert health["ok"] is True
        assert len(health["calendar_providers"]) >= 2
        record("health", True, health)

        public_config, _ = request_json("/api/public/config")
        assert public_config["features"]["voice"] is True
        assert public_config["features"]["calendar"] is True
        assert public_config["features"]["outbound"] is True
        assert public_config["features"]["inbound"] is True
        record("feature_flags", True, public_config["features"])

        login, login_headers = request_json(
            "/api/auth/login",
            method="POST",
            payload={"email": "owner@example.com", "password": "change-me-now"},
        )
        assert login["ok"] is True
        assert login["user"]["must_change_password"] is True
        cookie = login_headers.get("Set-Cookie", "")
        csrf = login.get("csrf_token", "")
        auth_headers = {"Cookie": cookie, "X-CSRF-Token": csrf}
        changed, _ = request_json(
            "/api/auth/change-password",
            method="POST",
            payload={
                "current_password": "change-me-now",
                "new_password": "Change-Me-Now!42",
                "confirm_password": "Change-Me-Now!42",
            },
            headers=auth_headers,
        )
        assert changed["ok"] is True
        me, _ = request_json("/api/auth/me", headers={"Cookie": cookie})
        csrf = me.get("csrf_token", "")
        auth_headers = {"Cookie": cookie, "X-CSRF-Token": csrf}
        assert me["user"]["role"] == "admin"
        assert me["user"]["must_change_password"] is False
        record("admin_login_and_password_rotation", True, me)

        orgs, _ = request_json("/api/admin/orgs", headers={"Cookie": cookie})
        reps, _ = request_json("/api/admin/reps", headers={"Cookie": cookie})
        assert orgs["orgs"]
        assert reps["reps"]
        record("orgs_and_reps", True, {"org_count": len(orgs["orgs"]), "rep_count": len(reps["reps"])})

        cloned_org, _ = request_json(
            "/api/admin/orgs",
            method="POST",
            payload={
                "name": "Branch Clone Desk",
                "slug": "branch-clone-desk",
                "support_email": "branch@example.com",
                "timezone": "America/Phoenix",
                "currency": "USD",
                "clone_from_org_id": int(orgs["orgs"][0]["id"]),
                "clone_settings": True,
                "clone_services": True,
                "clone_packages": True,
                "clone_playbooks": True,
                "clone_reps": True,
            },
            headers=auth_headers,
        )
        assert cloned_org["ok"] is True
        assert (cloned_org.get("clone") or {}).get("cloned", {}).get("services", 0) >= 1
        record("org_clone_template", True, cloned_org.get("clone") or {})

        created_org, _ = request_json(
            "/api/admin/orgs",
            method="POST",
            payload={
                "name": "Scottsdale Desk",
                "slug": "scottsdale-desk",
                "support_email": "scottsdale@example.com",
                "support_phone": "555-444-2026",
                "timezone": "America/Phoenix",
                "currency": "USD",
            },
            headers=auth_headers,
        )
        assert created_org["org"]["slug"] == "scottsdale-desk"
        assert len(created_org["orgs"]) >= 2
        record("create_org_desk", True, {"org_id": created_org["org"]["id"], "org_count": len(created_org["orgs"])})

        preset_org, _ = request_json(
            "/api/admin/orgs",
            method="POST",
            payload={
                "name": "Executive Chauffeur Desk",
                "slug": "executive-chauffeur-desk",
                "support_email": "chauffeur@example.com",
                "support_phone": "555-666-2026",
                "timezone": "America/Phoenix",
                "currency": "USD",
                "preset_slug": "white-glove-chauffeur",
                "seed_rep_name": "Sky Concierge",
                "seed_rep_email": "concierge@example.com",
                "seed_rep_role": "admin",
            },
            headers=auth_headers,
        )
        preset_org_id = int(preset_org["org"]["id"])
        preset_services, _ = request_json(f"/api/admin/services?org_id={preset_org_id}", headers={"Cookie": cookie})
        preset_packages, _ = request_json(f"/api/admin/packages?org_id={preset_org_id}", headers={"Cookie": cookie})
        preset_playbooks, _ = request_json(f"/api/admin/playbooks?org_id={preset_org_id}", headers={"Cookie": cookie})
        preset_reps, _ = request_json(f"/api/admin/reps?org_id={preset_org_id}", headers={"Cookie": cookie})
        assert (preset_org.get("preset") or {}).get("applied", {}).get("services", 0) >= 1
        assert (preset_org.get("preset") or {}).get("applied", {}).get("reps", 0) >= 1
        assert any(item.get("slug") == "executive-transfer" for item in preset_services["services"])
        assert any(item.get("slug") == "executive-day-block" for item in preset_packages["packages"])
        assert any("Chauffeur" in str(item.get("name") or '') or "Itinerary" in str(item.get("name") or '') for item in preset_playbooks["playbooks"])
        assert any("Concierge" in str(item.get("name") or '') for item in preset_reps["reps"])
        assert (preset_org.get("seeded_rep") or {}).get("name") == "Sky Concierge"
        record("org_preset_rollout", True, {"org_id": preset_org_id, "preset": preset_org.get("preset"), "service_count": len(preset_services["services"]), "package_count": len(preset_packages["packages"]), "playbook_count": len(preset_playbooks["playbooks"]), "rep_count": len(preset_reps["reps"]), "seeded_rep": preset_org.get("seeded_rep")})

        readiness, _ = request_json(f"/api/admin/orgs/{preset_org_id}/readiness", headers={"Cookie": cookie})
        assert readiness["readiness"]["percent_complete"] >= 75
        assert readiness["readiness"]["counts"]["services"] >= 1
        record("org_readiness", True, readiness["readiness"])
        onboarding_plan, _ = request_json(f"/api/admin/orgs/{preset_org_id}/onboarding-plan?preset_slug=white-glove-chauffeur", headers={"Cookie": cookie})
        assert (onboarding_plan.get("plan") or {}).get("stages")
        assert len((onboarding_plan.get("plan") or {}).get("stages") or []) >= 3
        assert "Chauffeur" in str(((onboarding_plan.get("plan") or {}).get("preset") or {}).get("name") or '') or "white-glove" in str(((onboarding_plan.get("plan") or {}).get("preset") or {}).get("slug") or '')
        record("org_onboarding_plan", True, onboarding_plan.get("plan") or {})
        readiness_seeded, _ = request_json(
            "/api/admin/orgs",
            method="POST",
            payload={
                "name": "Bare Bones Desk",
                "slug": "bare-bones-desk",
                "support_email": "",
                "support_phone": "",
                "timezone": "America/Phoenix",
                "currency": "USD",
            },
            headers=auth_headers,
        )
        bare_org_id = int(readiness_seeded["org"]["id"])
        readiness_before, _ = request_json(f"/api/admin/orgs/{bare_org_id}/readiness", headers={"Cookie": cookie})
        autofix, _ = request_json(
            f"/api/admin/orgs/{bare_org_id}/autofix",
            method="POST",
            payload={"preset_slug": "general-consulting", "seed_reps": True},
            headers=auth_headers,
        )
        readiness_after = (autofix.get("result") or {}).get("after") or {}
        assert readiness_after.get("percent_complete", 0) > readiness_before["readiness"].get("percent_complete", 0)
        assert readiness_after.get("counts", {}).get("services", 0) >= 1
        assert readiness_after.get("counts", {}).get("reps", 0) >= 1
        record("org_readiness_autofix", True, {"org_id": bare_org_id, "before": readiness_before["readiness"], "after": readiness_after})

        created_rep, _ = request_json(
            "/api/admin/reps",
            method="POST",
            payload={
                "org_id": 1,
                "name": "Closer Prime",
                "email": "closer@example.com",
                "phone": "555-333-2026",
                "role": "closer",
                "commission_rate_bps": 1500,
                "target_monthly_cents": 200000,
                "payout_notes": "Primary closer lane",
            },
            headers=auth_headers,
        )
        created_rep_id = created_rep["rep"]["id"]
        assert created_rep["rep"]["name"] == "Closer Prime"
        updated_rep, _ = request_json(
            f"/api/admin/reps/{created_rep_id}",
            method="POST",
            payload={
                "name": "Closer Prime",
                "email": "closer@example.com",
                "phone": "555-333-2026",
                "role": "closer",
                "commission_rate_bps": 1800,
                "target_monthly_cents": 250000,
                "payout_notes": "Primary closer lane updated",
                "is_active": True,
            },
            headers=auth_headers,
        )
        assert updated_rep["rep"]["commission_rate_bps"] == 1800
        record("create_and_update_rep", True, {"rep_id": created_rep_id, "commission_rate_bps": updated_rep["rep"]["commission_rate_bps"]})

        settings_saved, _ = request_json(
            "/api/admin/settings",
            method="POST",
            payload={
                "support_email": "desk@example.com",
                "support_phone": "555-222-1000",
                "timezone": "America/Phoenix",
                "operating_days": [0, 1, 2, 3, 4],
                "open_hour": 10,
                "close_hour": 18,
                "slot_minutes": 45,
                "buffer_minutes": 15,
                "reminder_lead_hours": 168,
                "autonomy_enabled": True,
                "auto_followup_hours": 24,
                "auto_noshow_minutes": 60,
                "auto_invoice_followup_hours": 48,
                "auto_intake_followup_hours": 24,
                "booking_notice": "Please arrive ready to confirm your scope.",
                "default_deposit_cents": 7500,
                "default_service_price_cents": 25000,
                "currency": "USD",
                "payment_instructions": "Collect payment manually and record it inside admin.",
            },
            headers=auth_headers,
        )
        assert settings_saved["ok"] is True
        settings_read, _ = request_json("/api/admin/settings", headers={"Cookie": cookie})
        assert settings_read["settings"]["slot_minutes"] == 45
        assert settings_read["settings"]["reminder_lead_hours"] == 168
        assert settings_read["settings"]["autonomy_enabled"] is True
        assert settings_read["settings"]["default_deposit_cents"] == 7500
        record("settings_save", True, settings_read["settings"])

        stale_lead = db.create_lead({
            "name": "Autonomy Lead",
            "email": "autonomy@example.com",
            "phone": "555-777-1000",
            "service_interest": "Autonomous booking",
            "timezone": "America/Phoenix",
            "source": "autonomy-test",
        })
        db.create_session(int(stale_lead["id"]), int(stale_lead["org_id"]))
        db.update_lead(int(stale_lead["id"]), {"last_contacted_at": (datetime.now(ZoneInfo("UTC")) - timedelta(hours=72)).isoformat()})
        db.create_invoice({
            "lead_id": int(stale_lead["id"]),
            "description": "Outstanding consultation balance",
            "amount_cents": 15000,
            "balance_cents": 15000,
            "currency": "USD",
            "status": "sent",
            "due_ts": (datetime.now(ZoneInfo("UTC")) - timedelta(hours=1)).isoformat(),
        })

        intake_lead = db.create_lead({
            "name": "Intake Lead",
            "email": "intake@example.com",
            "phone": "555-777-2000",
            "service_interest": "Implementation",
            "timezone": "America/Phoenix",
            "source": "autonomy-test",
        })
        intake_session = db.create_session(int(intake_lead["id"]), int(intake_lead["org_id"]))
        upcoming_start = (datetime.now(ZoneInfo("UTC")) + timedelta(hours=6)).isoformat()
        upcoming_end = (datetime.now(ZoneInfo("UTC")) + timedelta(hours=7)).isoformat()
        intake_appt = db.create_appointment({
            "org_id": int(intake_lead["org_id"]),
            "lead_id": int(intake_lead["id"]),
            "session_id": int(intake_session["id"]),
            "start_ts": upcoming_start,
            "end_ts": upcoming_end,
            "timezone": "America/Phoenix",
            "status": "booked",
            "notes": "Autonomy intake reminder test",
            "confirmation_code": "AUTO-INTAKE-1",
        })
        db.get_or_create_intake_packet(int(intake_lead["id"]), int(intake_appt["id"]), int(intake_lead["org_id"]))

        noshow_lead = db.create_lead({
            "name": "No Show Lead",
            "email": "noshow@example.com",
            "phone": "555-777-3000",
            "service_interest": "Strategy",
            "timezone": "America/Phoenix",
            "source": "autonomy-test",
        })
        noshow_session = db.create_session(int(noshow_lead["id"]), int(noshow_lead["org_id"]))
        past_start = (datetime.now(ZoneInfo("UTC")) - timedelta(hours=3)).isoformat()
        past_end = (datetime.now(ZoneInfo("UTC")) - timedelta(hours=2, minutes=30)).isoformat()
        db.create_appointment({
            "org_id": int(noshow_lead["org_id"]),
            "lead_id": int(noshow_lead["id"]),
            "session_id": int(noshow_session["id"]),
            "start_ts": past_start,
            "end_ts": past_end,
            "timezone": "America/Phoenix",
            "status": "booked",
            "notes": "Autonomy no-show test",
            "confirmation_code": "AUTO-NOSHOW-1",
        })

        autonomy_run, _ = request_json(
            "/api/admin/autonomy/run",
            method="POST",
            payload={"org_id": 1},
            headers=auth_headers,
        )
        assert autonomy_run["result"]["auto_followups"] >= 1
        assert autonomy_run["result"]["invoice_reminders"] >= 1
        assert autonomy_run["result"]["intake_reminders"] >= 1
        assert autonomy_run["result"]["no_show_recoveries"] >= 1
        record("autonomy_run", True, autonomy_run["result"])

        admin_created, _ = request_json(
            "/api/admin/leads",
            method="POST",
            payload={
                "name": "Taylor Quinn",
                "email": "taylor@example.com",
                "phone": "555-333-4444",
                "business_name": "Quinn Studio",
                "service_interest": "Automation",
                "urgency": "medium",
                "preferred_schedule": "Tuesday morning",
                "notes": "Created from admin lane.",
                "qualification_status": "qualified",
                "assigned_rep_id": created_rep_id,
            },
            headers=auth_headers,
        )
        admin_lead_id = admin_created["lead"]["id"]
        assert admin_created["lead"]["source"] == "admin"
        assert int(admin_created["lead"]["assigned_rep_id"] or 0) == created_rep_id
        record("admin_create_lead", True, {"lead_id": admin_lead_id, "assigned_rep_id": created_rep_id})

        admin_updated, _ = request_json(
            f"/api/admin/leads/{admin_lead_id}",
            method="POST",
            payload={
                "name": "Taylor Quinn",
                "email": "taylor@example.com",
                "phone": "555-333-4444",
                "business_name": "Quinn Studio",
                "service_interest": "AI automation",
                "urgency": "high",
                "preferred_schedule": "Tuesday morning",
                "notes": "Priority lead updated from admin lane.",
                "qualification_status": "qualified",
                "assigned_rep_id": created_rep_id,
            },
            headers=auth_headers,
        )
        assert admin_updated["lead"]["service_interest"] == "AI automation"
        assert admin_updated["lead"]["urgency"] == "high"
        record("admin_update_lead", True, admin_updated["lead"])

        tagged_update, _ = request_json(
            f"/api/admin/leads/{admin_lead_id}",
            method="POST",
            payload={
                "name": "Taylor Quinn",
                "email": "taylor@example.com",
                "phone": "555-333-4444",
                "business_name": "Quinn Studio",
                "service_interest": "AI automation",
                "urgency": "high",
                "preferred_schedule": "Tuesday morning",
                "notes": "Priority lead updated from admin lane.",
                "qualification_status": "qualified",
                "assigned_rep_id": created_rep_id,
                "source": "founder-referral",
                "tags": ["priority", "automation"],
            },
            headers=auth_headers,
        )
        assert tagged_update["lead"]["source"] == "founder-referral"
        assert set(tagged_update["lead"]["tags"]) == {"priority", "automation"}
        record("lead_source_and_tags", True, tagged_update["lead"])

        bulk_updated, _ = request_json(
            "/api/admin/leads/bulk-update",
            method="POST",
            payload={
                "lead_ids": [admin_lead_id, int(stale_lead["id"])],
                "qualification_status": "qualified",
                "assigned_rep_id": created_rep_id,
                "source": "branch-sweep",
                "add_tags": ["priority", "follow-up"],
                "remove_tags": ["automation"],
                "touch_last_contacted": True,
            },
            headers=auth_headers,
        )
        assert bulk_updated["updated_count"] == 2
        leads_after_bulk, _ = request_json("/api/admin/leads", headers={"Cookie": cookie})
        admin_lead_after_bulk = next(item for item in leads_after_bulk["leads"] if item["id"] == admin_lead_id)
        stale_lead_after_bulk = next(item for item in leads_after_bulk["leads"] if item["id"] == int(stale_lead["id"]))
        assert admin_lead_after_bulk["source"] == "branch-sweep"
        assert stale_lead_after_bulk["source"] == "branch-sweep"
        assert "priority" in admin_lead_after_bulk["tags"]
        assert "follow-up" in stale_lead_after_bulk["tags"]
        assert "automation" not in admin_lead_after_bulk["tags"]
        record("bulk_lead_update", True, {"updated_count": bulk_updated["updated_count"], "admin_tags": admin_lead_after_bulk["tags"]})

        saved_view_created, _ = request_json(
            "/api/admin/lead-views",
            method="POST",
            payload={
                "name": "Branch sweep qualified",
                "org_id": 1,
                "filters": {
                    "query": "",
                    "status": "qualified",
                    "source": "branch-sweep",
                    "rep": str(created_rep_id),
                    "tag": "priority",
                },
            },
            headers=auth_headers,
        )
        assert saved_view_created["view"]["name"] == "Branch sweep qualified"
        saved_views, _ = request_json("/api/admin/lead-views", headers={"Cookie": cookie})
        assert any(item["id"] == saved_view_created["view"]["id"] for item in saved_views["views"])
        deleted_view, _ = request_json(
            f"/api/admin/lead-views/{saved_view_created['view']['id']}/delete",
            method="POST",
            payload={},
            headers=auth_headers,
        )
        assert deleted_view["ok"] is True
        saved_views_after_delete, _ = request_json("/api/admin/lead-views", headers={"Cookie": cookie})
        assert all(item["id"] != saved_view_created["view"]["id"] for item in saved_views_after_delete["views"])
        record("saved_views_crud", True, {"created_id": saved_view_created["view"]["id"], "remaining": len(saved_views_after_delete["views"])})

        seeded_playbooks, _ = request_json("/api/admin/playbooks", headers={"Cookie": cookie})
        assert len(seeded_playbooks["playbooks"]) >= 3
        record("seeded_playbooks", True, {"count": len(seeded_playbooks["playbooks"])})

        custom_playbook, _ = request_json(
            "/api/admin/playbooks",
            method="POST",
            payload={
                "org_id": 1,
                "name": "Founder branch follow-up",
                "channel": "email",
                "subject_template": "Follow-up for {service_interest}",
                "body_template": "Hello {first_name},\n\nWe have you marked as {qualification_status}. Use {manage_url} to manage your appointment.",
                "tags": ["founder", "follow-up"],
            },
            headers=auth_headers,
        )
        assert custom_playbook["playbook"]["name"] == "Founder branch follow-up"
        record("custom_playbook_create", True, custom_playbook["playbook"])

        admin_slots, _ = request_json("/api/availability?days=7&timezone=America/Phoenix&org_id=1&preferred=Tuesday+morning")
        assert admin_slots["slots"]
        admin_manual_book, _ = request_json(
            "/api/admin/appointments/manual",
            method="POST",
            payload={
                "lead_id": admin_lead_id,
                "start": admin_slots["slots"][0]["start"],
                "timezone": admin_slots["slots"][0]["timezone"],
                "notes": "Manual admin booking",
            },
            headers=auth_headers,
        )
        admin_appointment_id = admin_manual_book["appointment"]["id"]
        assert admin_manual_book["ok"] is True
        record("admin_manual_booking", True, {"appointment_id": admin_appointment_id, "confirmation": admin_manual_book["appointment"]["confirmation_code"]})

        manual_outbound, _ = request_json(
            "/api/admin/outbound/manual",
            method="POST",
            payload={
                "lead_id": admin_lead_id,
                "channel": "email",
                "subject": "Your appointment details",
                "body": "This is a direct desk-side follow-up.",
                "send_now": True,
            },
            headers=auth_headers,
        )
        assert manual_outbound["message"]["status"] == "sent"
        record("manual_outbound_send", True, {"message_id": manual_outbound["message"]["id"], "status": manual_outbound["message"]["status"]})

        queued_playbook, _ = request_json(
            f"/api/admin/playbooks/{custom_playbook['playbook']['id']}/queue",
            method="POST",
            payload={
                "lead_id": admin_lead_id,
                "appointment_id": admin_appointment_id,
                "send_now": False,
            },
            headers=auth_headers,
        )
        assert queued_playbook["message"]["status"] == "queued"
        assert "manage" in queued_playbook["rendered"]["body"].lower()
        sent_playbook, _ = request_json(
            f"/api/admin/playbooks/{custom_playbook['playbook']['id']}/queue",
            method="POST",
            payload={
                "lead_id": admin_lead_id,
                "appointment_id": admin_appointment_id,
                "send_now": True,
            },
            headers=auth_headers,
        )
        assert sent_playbook["message"]["status"] == "sent"
        assert "Taylor" in sent_playbook["rendered"]["body"]
        record("playbook_queue_and_send", True, {"queued_id": queued_playbook["message"]["id"], "sent_id": sent_playbook["message"]["id"]})

        admin_timeline, _ = request_json(f"/api/admin/leads/{admin_lead_id}/timeline?limit=20", headers={"Cookie": cookie})
        kinds = {item.get("kind") for item in admin_timeline["timeline"]}
        assert "appointment" in kinds
        assert "outbound" in kinds
        record("lead_timeline", True, {"item_count": len(admin_timeline["timeline"]), "kinds": sorted(kinds)})


        admin_intake, _ = request_json(
            f"/api/admin/leads/{admin_lead_id}/intake",
            method="POST",
            payload={
                "status": "reviewed",
                "business_need": "Needs an AI automation scope and implementation plan.",
                "budget_range": "$2,500-$5,000",
                "decision_window": "Within 2 weeks",
                "intake_notes": "Bring current funnel numbers and examples.",
                "waiver_accepted": True,
            },
            headers=auth_headers,
        )
        assert admin_intake["intake"]["status"] == "reviewed"
        assert int(admin_intake["intake"]["waiver_accepted"] or 0) == 1
        record("admin_intake_update", True, admin_intake["intake"])

        admin_invoice, _ = request_json(
            f"/api/admin/leads/{admin_lead_id}/invoices",
            method="POST",
            payload={
                "kind": "service",
                "description": "Implementation package",
                "amount_cents": 125000,
                "balance_cents": 125000,
                "currency": "USD",
                "status": "sent",
            },
            headers=auth_headers,
        )
        invoice_id = admin_invoice["invoice"]["id"]
        assert admin_invoice["invoice"]["amount_cents"] == 125000
        payment_recorded, _ = request_json(
            f"/api/admin/invoices/{invoice_id}/payments",
            method="POST",
            payload={
                "amount_cents": 50000,
                "method": "ach",
                "reference": "ACH-50000",
            },
            headers=auth_headers,
        )
        assert payment_recorded["invoice"]["balance_cents"] == 75000
        record("admin_invoice_and_payment", True, {"invoice": admin_invoice["invoice"], "payment": payment_recorded["payment"]})

        admin_documents, _ = request_json(
            f"/api/admin/leads/{admin_lead_id}/documents",
            headers={"Cookie": cookie},
        )
        assert len(admin_documents["documents"]) >= 2
        created_document, _ = request_json(
            f"/api/admin/leads/{admin_lead_id}/documents",
            method="POST",
            payload={
                "title": "Implementation Checklist",
                "kind": "prep",
                "required": True,
                "status": "ready",
                "body": "Bring current assets and approve the implementation path.",
            },
            headers=auth_headers,
        )
        document_id = created_document["document"]["id"]
        updated_document, _ = request_json(
            f"/api/admin/documents/{document_id}",
            method="POST",
            payload={
                "title": "Implementation Checklist",
                "kind": "prep",
                "required": True,
                "status": "sent",
                "body": "Bring current assets, logins, and approval notes.",
            },
            headers=auth_headers,
        )
        assert updated_document["document"]["status"] == "sent"
        record("admin_portal_document_control", True, {"document_id": document_id, "status": updated_document["document"]["status"]})

        credited_invoice, _ = request_json(
            f"/api/admin/invoices/{invoice_id}/credit",
            method="POST",
            payload={"amount_cents": 25000, "note": "Goodwill adjustment"},
            headers=auth_headers,
        )
        assert credited_invoice["credit_invoice"]["amount_cents"] == -25000
        assert credited_invoice["invoice"]["balance_cents"] == 50000
        written_off_invoice, _ = request_json(
            f"/api/admin/invoices/{invoice_id}/lifecycle",
            method="POST",
            payload={"action": "write_off", "note": "Founder-approved write-off"},
            headers=auth_headers,
        )
        assert written_off_invoice["invoice"]["status"] == "written_off"
        assert written_off_invoice["invoice"]["balance_cents"] == 0
        reopened_invoice, _ = request_json(
            f"/api/admin/invoices/{invoice_id}/lifecycle",
            method="POST",
            payload={"action": "reopen", "note": "Reopen for collection"},
            headers=auth_headers,
        )
        assert reopened_invoice["invoice"]["status"] == "sent"
        assert reopened_invoice["invoice"]["balance_cents"] == 50000
        record("invoice_lifecycle_and_credit_memo", True, {"invoice_id": invoice_id, "balance_after_reopen": reopened_invoice["invoice"]["balance_cents"]})

        admin_status_confirmed, _ = request_json(
            f"/api/appointments/{admin_appointment_id}/status",
            method="POST",
            payload={"status": "confirmed"},
            headers=auth_headers,
        )
        assert admin_status_confirmed["appointment"]["status"] == "confirmed"
        admin_status_completed, _ = request_json(
            f"/api/appointments/{admin_appointment_id}/status",
            method="POST",
            payload={"status": "completed"},
            headers=auth_headers,
        )
        assert admin_status_completed["appointment"]["status"] == "completed"
        record("appointment_status_updates", True, {"confirmed": admin_status_confirmed["appointment"]["status"], "completed": admin_status_completed["appointment"]["status"]})

        opening, _ = request_json(
            "/api/chat/start",
            method="POST",
            payload={
                "name": "Jordan Reed",
                "email": "jordan@example.com",
                "phone": "555-010-2026",
                "business_name": "Reed Creative",
                "service_interest": "Strategy",
                "urgency": "high",
                "preferred_schedule": "Friday afternoon",
                "timezone": "America/Phoenix",
                "notes": "Need a growth planning session.",
                "org_slug": "main",
            },
        )
        assert opening["assistant"]["suggested_slots"]
        session_id = opening["session"]["id"]
        lead_id = opening["lead"]["id"]
        first_slot = opening["assistant"]["suggested_slots"][0]
        record("start_session", True, {"lead_id": lead_id, "session_id": session_id, "slot": first_slot})

        chat, _ = request_json(
            "/api/chat/message",
            method="POST",
            payload={"session_id": session_id, "message": "Friday afternoon works. Show me the cleanest opening."},
        )
        assert chat["assistant"]["suggested_slots"]
        record("chat_followup", True, {"reply": chat["assistant"]["text"]})

        booked, _ = request_json(
            "/api/appointments",
            method="POST",
            payload={
                "lead_id": lead_id,
                "session_id": session_id,
                "start": first_slot["start"],
                "timezone": first_slot["timezone"],
                "notes": "Smoke test booking",
            },
        )
        assert booked["ok"] is True
        assert len(booked["calendar_sync"]) == 2
        appointment = booked["appointment"]
        appointment_id = appointment["id"]
        assert booked.get("ics_url")
        ics_body, ics_headers = request_text(f"/api/appointments/{appointment_id}/ics?code={appointment['confirmation_code']}")
        assert "BEGIN:VCALENDAR" in ics_body
        assert "text/calendar" in ics_headers.get("Content-Type", "")
        record("book_appointment_and_sync", True, booked)
        record("calendar_file_download", True, {"content_type": ics_headers.get("Content-Type", ""), "url": booked.get("ics_url")})

        manage_view, _ = request_json(f"/api/public/appointment?code={appointment['confirmation_code']}")
        assert manage_view["ok"] is True
        assert manage_view["appointment"]["id"] == appointment_id
        assert manage_view["suggested_slots"]
        record("public_manage_lookup", True, {"manage_url": manage_view["manage_url"], "slot_count": len(manage_view["suggested_slots"])})

        inbound_sms, _ = request_json(
            "/api/inbound/sms",
            method="POST",
            payload={"from": "+1 (555) 010-2026", "to": "+14805550100", "body": "Please confirm my appointment.", "lead_id": lead_id},
            headers={"X-Inbound-Secret": "sms-secret-123"},
        )
        assert inbound_sms["action_taken"] == "appointment_confirmed"
        inbox_one, _ = request_json("/api/admin/inbox", headers={"Cookie": cookie})
        assert inbox_one["messages"]
        thread_id = int(inbox_one["messages"][0]["id"])
        claimed, _ = request_json(f"/api/admin/inbox/{thread_id}/claim", method="POST", payload={}, headers=auth_headers)
        assert claimed["message"]["thread_status"] == "claimed"
        closed, _ = request_json(f"/api/admin/inbox/{thread_id}/close", method="POST", payload={}, headers=auth_headers)
        assert closed["message"]["thread_status"] == "closed"
        reopened, _ = request_json(f"/api/admin/inbox/{thread_id}/reopen", method="POST", payload={}, headers=auth_headers)
        assert reopened["message"]["thread_status"] == "open"
        released, _ = request_json(f"/api/admin/inbox/{thread_id}/release", method="POST", payload={}, headers=auth_headers)
        assert (released["message"].get("owner_name") or "") == ""
        record("inbound_sms_confirmation", True, {"action": inbound_sms["action_taken"], "inbox_count": len(inbox_one["messages"]), "thread_id": thread_id})
        record("inbox_thread_controls", True, {"thread_id": thread_id, "final_status": released["message"].get("thread_status")})

        inbound_email, _ = request_json(
            "/api/inbound/email",
            method="POST",
            payload={"from": "jordan@example.com", "to": "support@example.com", "subject": "Need a new time", "body": "I need to reschedule my appointment.", "lead_id": lead_id},
            headers={"X-Inbound-Secret": "email-secret-123"},
        )
        assert inbound_email["action_taken"] == "reschedule_requested"
        assert inbound_email.get("auto_reply")
        inbox_two, _ = request_json(f"/api/admin/inbox?lead_id={lead_id}", headers={"Cookie": cookie})
        assert len(inbox_two["messages"]) >= 2
        record("inbound_email_reschedule_request", True, {"action": inbound_email["action_taken"], "lead_inbox_count": len(inbox_two["messages"]), "auto_reply_id": inbound_email.get("auto_reply", {}).get("id")})

        assert manage_view["billing"]["totals"]["outstanding_cents"] == 7500
        assert manage_view["intake"]["status"] in {"pending", "submitted", "reviewed"}
        public_intake, _ = request_json(
            "/api/public/appointment/intake",
            method="POST",
            payload={
                "code": appointment["confirmation_code"],
                "budget_range": "$1,000-$2,500",
                "decision_window": "This week",
                "business_need": "Need a strategy plan and implementation quote.",
                "intake_notes": "Prefers afternoon follow-up.",
                "waiver_accepted": True,
            },
        )
        assert int(public_intake["intake"]["waiver_accepted"] or 0) == 1
        assert public_intake["billing"]["totals"]["outstanding_cents"] == 7500
        record("public_intake_submission", True, public_intake["intake"])

        services_data, _ = request_json("/api/admin/services", headers={"Cookie": cookie})
        packages_data, _ = request_json("/api/admin/packages", headers={"Cookie": cookie})
        assert services_data["services"]
        assert packages_data["packages"]
        record("commercial_catalog", True, {"service_count": len(services_data["services"]), "package_count": len(packages_data["packages"])})

        service_updated, _ = request_json(
            f"/api/admin/services/{services_data['services'][0]['id']}",
            method="POST",
            payload={
                "name": "Strategy Session Prime",
                "slug": services_data["services"][0]["slug"],
                "description": "Updated strategy lane from smoke coverage.",
                "base_price_cents": 32500,
                "deposit_cents": 10000,
                "duration_minutes": 60,
                "keywords": ["strategy", "prime"],
                "active": True,
            },
            headers=auth_headers,
        )
        assert service_updated["service"]["name"] == "Strategy Session Prime"
        record("service_update", True, service_updated["service"])

        package_updated, _ = request_json(
            f"/api/admin/packages/{packages_data['packages'][0]['id']}",
            method="POST",
            payload={
                "name": "Starter Sprint Prime",
                "slug": packages_data["packages"][0]["slug"],
                "description": "Updated package lane from smoke coverage.",
                "total_price_cents": 88000,
                "deposit_cents": 25000,
                "included_service_slugs": [services_data["services"][0]["slug"]],
                "active": True,
            },
            headers=auth_headers,
        )
        assert package_updated["package"]["name"] == "Starter Sprint Prime"
        record("package_update", True, package_updated["package"])

        quote_created, _ = request_json(
            "/api/admin/quotes",
            method="POST",
            payload={
                "lead_id": lead_id,
                "appointment_id": appointment_id,
                "service_id": services_data["services"][0]["id"],
                "title": "Strategy Follow-Through Quote",
                "summary": "A scoped strategy lane with delivery follow-through.",
                "amount_cents": 65000,
                "deposit_cents": 15000,
                "terms_text": "Accepting this quote approves the scoped lane and required deposit.",
            },
            headers=auth_headers,
        )
        assert quote_created["quote"]["status"] == "sent"
        record("quote_created", True, quote_created["quote"])

        quote_updated, _ = request_json(
            f"/api/admin/quotes/{quote_created['quote']['id']}",
            method="POST",
            payload={
                "title": "Strategy Follow-Through Quote Revised",
                "summary": "Updated scoped strategy lane with implementation follow-through.",
                "amount_cents": 70000,
                "deposit_cents": 20000,
                "status": "draft",
                "expires_at": "2026-05-01T17:00:00Z",
                "terms_text": "Updated smoke terms.",
            },
            headers=auth_headers,
        )
        assert quote_updated["quote"]["title"] == "Strategy Follow-Through Quote Revised"
        assert quote_updated["quote"]["status"] == "draft"
        record("quote_update", True, quote_updated["quote"])

        quote_sent, _ = request_json(
            f"/api/admin/quotes/{quote_created['quote']['id']}/action",
            method="POST",
            payload={"action": "send", "notify_lead": True},
            headers=auth_headers,
        )
        assert quote_sent["quote"]["status"] == "sent"
        assert quote_sent["message"] is not None
        record("quote_send_notice", True, {"quote_id": quote_sent["quote"]["id"], "message_id": quote_sent["message"]["id"]})

        quote_duplicate, _ = request_json(
            f"/api/admin/quotes/{quote_created['quote']['id']}/action",
            method="POST",
            payload={"action": "duplicate"},
            headers=auth_headers,
        )
        assert quote_duplicate["quote"]["id"] != quote_created["quote"]["id"]
        assert quote_duplicate["quote"]["status"] == "draft"
        record("quote_duplicate", True, quote_duplicate["quote"])

        quote_duplicate_sent, _ = request_json(
            f"/api/admin/quotes/{quote_duplicate['quote']['id']}/action",
            method="POST",
            payload={"action": "send", "notify_lead": False},
            headers=auth_headers,
        )
        assert quote_duplicate_sent["quote"]["status"] == "sent"
        record("quote_duplicate_send", True, quote_duplicate_sent["quote"])

        quote_decline_seed, _ = request_json(
            "/api/admin/quotes",
            method="POST",
            payload={
                "lead_id": lead_id,
                "appointment_id": appointment_id,
                "service_id": services_data["services"][0]["id"],
                "title": "Optional add-on quote",
                "summary": "An optional secondary lane for decline testing.",
                "amount_cents": 15000,
                "deposit_cents": 0,
                "terms_text": "Optional add-on only.",
            },
            headers=auth_headers,
        )
        assert quote_decline_seed["quote"]["status"] == "sent"
        record("quote_decline_seed", True, quote_decline_seed["quote"])

        payment_plan_created, _ = request_json(
            f"/api/admin/leads/{lead_id}/payment-plans",
            method="POST",
            payload={
                "quote_id": quote_created["quote"]["id"],
                "title": "Three-pay implementation plan",
                "total_cents": 70000,
                "deposit_cents": 20000,
                "installment_count": 2,
                "interval_days": 21,
                "first_due_ts": "2026-05-01T17:00:00Z",
                "invoice_status": "sent",
                "notes": "Smoke installment coverage",
            },
            headers=auth_headers,
        )
        assert payment_plan_created["plan"]["title"] == "Three-pay implementation plan"
        assert len(payment_plan_created["created_invoices"]) == 3
        assert payment_plan_created["billing"]["payment_plans"]
        record("payment_plan_create", True, {"plan_id": payment_plan_created["plan"]["id"], "invoice_count": len(payment_plan_created["created_invoices"])})

        membership_created, _ = request_json(
            f"/api/admin/leads/{lead_id}/memberships",
            method="POST",
            payload={
                "quote_id": quote_created["quote"]["id"],
                "title": "Monthly growth desk",
                "amount_cents": 75000,
                "interval_days": 30,
                "next_invoice_ts": (datetime.utcnow() - timedelta(days=1)).replace(microsecond=0).isoformat() + "Z",
                "start_mode": "wait",
                "notes": "Smoke recurring coverage",
            },
            headers=auth_headers,
        )
        membership_id = membership_created["membership"]["id"]
        assert membership_created["billing"]["memberships"]
        record("membership_create", True, {"membership_id": membership_id, "count": len(membership_created["billing"]["memberships"])})

        membership_due_run, _ = request_json(
            "/api/admin/memberships/run",
            method="POST",
            payload={},
            headers=auth_headers,
        )
        assert membership_due_run["generated"]
        assert membership_due_run["generated"][0]["invoice"]["kind"] == "membership"
        record("membership_due_run", True, {"generated_count": len(membership_due_run["generated"]), "invoice_id": membership_due_run["generated"][0]["invoice"]["id"]})

        membership_paused, _ = request_json(
            f"/api/admin/memberships/{membership_id}/action",
            method="POST",
            payload={"action": "pause"},
            headers=auth_headers,
        )
        assert membership_paused["membership"]["status"] == "paused"
        record("membership_pause", True, membership_paused["membership"])

        membership_resumed, _ = request_json(
            f"/api/admin/memberships/{membership_id}/action",
            method="POST",
            payload={"action": "resume", "next_invoice_ts": (datetime.utcnow() + timedelta(days=10)).replace(microsecond=0).isoformat() + "Z"},
            headers=auth_headers,
        )
        assert membership_resumed["membership"]["status"] == "active"
        record("membership_resume", True, membership_resumed["membership"])

        membership_bill_now, _ = request_json(
            f"/api/admin/memberships/{membership_id}/action",
            method="POST",
            payload={"action": "generate_now", "invoice_status": "sent"},
            headers=auth_headers,
        )
        assert membership_bill_now["invoice"] is not None
        assert membership_bill_now["invoice"]["kind"] == "membership"
        record("membership_bill_now", True, {"membership": membership_bill_now["membership"], "invoice": membership_bill_now["invoice"]})

        admin_artifact_upload, _ = request_json(
            f"/api/admin/leads/{lead_id}/artifacts",
            method="POST",
            payload={
                "filename": "scope-proof.txt",
                "mime_type": "text/plain",
                "content_b64": base64.b64encode(b"admin proof artifact").decode("utf-8"),
                "category": "scope-proof",
                "visible_to_client": True,
                "notes": "Admin proof upload coverage",
            },
            headers=auth_headers,
        )
        assert admin_artifact_upload["artifact"]["filename"] == "scope-proof.txt"
        record("admin_artifact_upload", True, admin_artifact_upload["artifact"])

        artifact_replaced, _ = request_json(
            f"/api/admin/artifacts/{admin_artifact_upload['artifact']['id']}/replace",
            method="POST",
            payload={
                "filename": "scope-proof-v2.txt",
                "mime_type": "text/plain",
                "content_b64": base64.b64encode(b"admin proof artifact updated").decode("utf-8"),
                "notes": "Replacement version coverage",
                "visible_to_client": True,
            },
            headers=auth_headers,
        )
        assert artifact_replaced["artifact"]["version_number"] == 2
        assert len(artifact_replaced["versions"]) >= 2
        record("admin_artifact_replace", True, {"artifact": artifact_replaced["artifact"], "versions": len(artifact_replaced["versions"])})

        artifact_internalized, _ = request_json(
            f"/api/admin/artifacts/{artifact_replaced['artifact']['id']}/update",
            method="POST",
            payload={"visible_to_client": False, "notes": "Now internal only"},
            headers=auth_headers,
        )
        assert int(artifact_internalized["artifact"]["visible_to_client"] or 0) == 0
        record("admin_artifact_visibility_toggle", True, artifact_internalized["artifact"])

        artifact_deleted, _ = request_json(
            f"/api/admin/artifacts/{artifact_replaced['artifact']['id']}/delete",
            method="POST",
            payload={},
            headers=auth_headers,
        )
        assert artifact_deleted["artifact"]["status"] == "deleted"
        record("admin_artifact_delete", True, artifact_deleted["artifact"])

        artifact_deleted_view, _ = request_json(
            f"/api/admin/leads/{lead_id}/artifacts?include_deleted=1",
            headers={"Cookie": cookie},
        )
        assert any(int(item.get("id") or 0) == int(artifact_replaced["artifact"]["id"] or 0) and str(item.get("status") or '') == 'deleted' for item in artifact_deleted_view["artifacts"])
        record("admin_artifact_include_deleted_view", True, {"artifact_count": len(artifact_deleted_view["artifacts"])})

        artifact_restored, _ = request_json(
            f"/api/admin/artifacts/{artifact_replaced['artifact']['id']}/restore",
            method="POST",
            payload={"include_deleted": True},
            headers=auth_headers,
        )
        assert artifact_restored["artifact"]["status"] == "active"
        record("admin_artifact_restore", True, artifact_restored["artifact"])

        artifact_batched, _ = request_json(
            "/api/admin/artifacts/batch",
            method="POST",
            payload={"artifact_ids": [artifact_replaced['artifact']['id']], "action": "make_visible", "lead_id": lead_id, "include_deleted": True},
            headers=auth_headers,
        )
        assert (artifact_batched.get("updated") or [])[0]["visible_to_client"] == 1
        record("admin_artifact_batch_visible", True, artifact_batched.get("updated") or [])

        manage_with_quote, _ = request_json(f"/api/public/appointment?code={appointment['confirmation_code']}")
        assert manage_with_quote["quotes"]
        assert manage_with_quote["documents"]
        assert isinstance(manage_with_quote["artifacts"], list)
        assert "summary" in manage_with_quote["memory"]
        record("portal_quote_document_memory_view", True, {"quote_count": len(manage_with_quote["quotes"]), "document_count": len(manage_with_quote["documents"]), "artifact_count": len(manage_with_quote["artifacts"])})

        first_doc = next((item for item in manage_with_quote["documents"] if item["status"] != "signed"), None)
        signed_doc, _ = request_json(
            "/api/public/documents/sign",
            method="POST",
            payload={"code": appointment["confirmation_code"], "document_id": first_doc["id"], "signed_name": "Jordan Reed"},
        )
        assert signed_doc["document"]["status"] == "signed"
        record("portal_document_sign", True, signed_doc["document"])

        quote_request_changes, _ = request_json(
            "/api/public/quotes/respond",
            method="POST",
            payload={"code": appointment["confirmation_code"], "quote_code": quote_duplicate["quote"]["quote_code"], "action": "request_changes", "accepted_name": "Jordan Reed", "acceptance_notes": "Please split deliverables into cleaner phases."},
        )
        assert quote_request_changes["quote"]["status"] == "needs_revision"
        record("public_quote_request_changes", True, quote_request_changes["quote"])

        quote_decline, _ = request_json(
            "/api/public/quotes/respond",
            method="POST",
            payload={"code": appointment["confirmation_code"], "quote_code": quote_decline_seed["quote"]["quote_code"], "action": "decline", "accepted_name": "Jordan Reed", "acceptance_notes": "Not moving forward on the add-on lane."},
        )
        assert quote_decline["quote"]["status"] == "declined"
        record("public_quote_decline", True, quote_decline["quote"])

        public_artifact_upload, _ = request_json(
            "/api/public/artifacts/upload",
            method="POST",
            payload={
                "code": appointment["confirmation_code"],
                "filename": "client-proof.txt",
                "mime_type": "text/plain",
                "content_b64": base64.b64encode(b"client proof artifact").decode("utf-8"),
                "category": "client-proof",
                "notes": "Client upload coverage",
            },
        )
        assert public_artifact_upload["artifact"]["filename"] == "client-proof.txt"
        record("public_artifact_upload", True, public_artifact_upload["artifact"])

        quote_accept, _ = request_json(
            "/api/public/quotes/accept",
            method="POST",
            payload={"code": appointment["confirmation_code"], "quote_code": quote_created["quote"]["quote_code"], "accepted_name": "Jordan Reed", "accepted_title": "Founder", "accepted_company": "Reed Group", "acceptance_signature": "Jordan Reed"},
        )
        assert quote_accept["quote"]["status"] == "accepted"
        assert quote_accept["invoice"] is not None
        assert quote_accept["quote"]["accepted_title"] == "Founder"
        record("public_quote_acceptance", True, {"quote": quote_accept["quote"], "invoice": quote_accept["invoice"]})

        quote_receipt_text, quote_receipt_headers = request_text(f"/api/public/quotes/{urllib.parse.quote(quote_created['quote']['quote_code'])}/receipt?code={urllib.parse.quote(appointment['confirmation_code'])}")
        assert "QUOTE ACCEPTANCE RECEIPT" in quote_receipt_text
        assert "Jordan Reed" in quote_receipt_text
        assert 'attachment;' in str(quote_receipt_headers.get('Content-Disposition') or '')
        record("public_quote_receipt_download", True, {"content_disposition": quote_receipt_headers.get('Content-Disposition') or ''})

        payment_commitment, _ = request_json(
            "/api/public/payments/commit",
            method="POST",
            payload={
                "code": appointment["confirmation_code"],
                "invoice_id": quote_accept["invoice"]["id"],
                "amount_cents": quote_accept["invoice"]["balance_cents"],
                "method": "ach",
                "planned_for_ts": "2026-04-05T15:30:00Z",
                "requester_name": "Jordan Reed",
                "notes": "ACH will be sent after internal approval.",
            },
        )
        assert (payment_commitment.get("payment_commitment") or {}).get("status") == "pending"
        record("public_payment_commitment", True, payment_commitment.get("payment_commitment") or {})

        public_commitment_cancel, _ = request_json(
            "/api/public/payments/commitment-action",
            method="POST",
            payload={
                "code": appointment["confirmation_code"],
                "commitment_id": int(payment_commitment["payment_commitment"]["id"]),
                "action": "cancel",
                "note": "Need to move the transfer to tomorrow morning.",
            },
        )
        assert (public_commitment_cancel.get("payment_commitment") or {}).get("status") == "cancelled"
        record("public_payment_commitment_cancel", True, public_commitment_cancel.get("payment_commitment") or {})

        public_commitment_reopen, _ = request_json(
            "/api/public/payments/commitment-action",
            method="POST",
            payload={
                "code": appointment["confirmation_code"],
                "commitment_id": int(payment_commitment["payment_commitment"]["id"]),
                "action": "reopen",
                "note": "Desk can expect the transfer again.",
            },
        )
        assert (public_commitment_reopen.get("payment_commitment") or {}).get("status") == "pending"
        record("public_payment_commitment_reopen", True, public_commitment_reopen.get("payment_commitment") or {})

        admin_payment_commitment, _ = request_json(
            f"/api/admin/payment-commitments/{payment_commitment['payment_commitment']['id']}/action",
            method="POST",
            payload={"action": "confirm"},
            headers=auth_headers,
        )
        assert (admin_payment_commitment.get("payment_commitment") or {}).get("status") == "confirmed"
        record("admin_payment_commitment_confirm", True, admin_payment_commitment.get("payment_commitment") or {})
        admin_payment_commitment_paid, _ = request_json(
            f"/api/admin/payment-commitments/{payment_commitment['payment_commitment']['id']}/action",
            method="POST",
            payload={"action": "mark_paid"},
            headers=auth_headers,
        )
        paid_invoice = (admin_payment_commitment_paid.get("invoice") or {})
        if not paid_invoice:
            paid_invoice = next((item for item in ((admin_payment_commitment_paid.get("billing") or {}).get("invoices") or []) if int(item.get("id") or 0) == int(quote_accept["invoice"]["id"] or 0)), {})
        assert (admin_payment_commitment_paid.get("payment_commitment") or {}).get("status") == "paid"
        assert int((admin_payment_commitment_paid.get("payment") or {}).get("amount_cents") or 0) == int(quote_accept["invoice"]["balance_cents"] or 0)
        assert int(paid_invoice.get("balance_cents", -1)) == 0
        record("payment_commitment_mark_paid", True, {"commitment_id": payment_commitment['payment_commitment']['id'], "payment_id": (admin_payment_commitment_paid.get("payment") or {}).get("id"), "invoice_id": paid_invoice.get("id")})

        escalated_chat, _ = request_json(
            "/api/chat/message",
            method="POST",
            payload={"session_id": session_id, "message": "I want a human because the price is too high and I need a person to step in."},
        )
        assert escalated_chat["escalation"] is not None
        assert escalated_chat["assistant"]["objection"]["type"] in {"price", "human"}
        escalations_view, _ = request_json("/api/admin/escalations", headers={"Cookie": cookie})
        assert escalations_view["escalations"]
        record("escalation_queue", True, {"escalation": escalated_chat["escalation"], "open_count": len(escalations_view["escalations"])})

        voice, _ = request_json(
            "/api/voice/calls",
            method="POST",
            payload={"lead_id": lead_id, "purpose": "followup"},
            headers=auth_headers,
        )
        assert voice["call"]["provider"] == "voice-mock"
        assert voice["call"]["status"] == "completed"
        record("voice_call", True, voice)

        moved, _ = request_json(
            "/api/public/appointment/reschedule",
            method="POST",
            payload={"code": appointment["confirmation_code"], "start": manage_view["suggested_slots"][0]["start"], "timezone": manage_view["suggested_slots"][0]["timezone"]},
        )
        assert moved["ok"] is True
        assert len(moved["calendar_sync"]) == 2
        record("public_reschedule", True, moved["appointment"])

        preview, _ = request_json("/api/reminders/preview", headers={"Cookie": cookie})
        assert preview["reminders"]
        record("reminders_preview", True, preview)

        queued, _ = request_json("/api/reminders/queue", method="POST", payload={}, headers=auth_headers)
        assert isinstance(queued.get("queued"), list)
        record("queue_reminders", True, {"queued_count": len(queued.get("queued") or []), "note": "Queue endpoint is allowed to be idempotent when reminders already exist."})

        dispatched, _ = request_json("/api/outbound/dispatch", method="POST", payload={}, headers=auth_headers)
        assert dispatched["messages"]
        record("dispatch_outbound", True, {"dispatched": dispatched["messages"]})

        calendar_status, _ = request_json("/api/admin/calendar/status", headers={"Cookie": cookie})
        voice_history, _ = request_json("/api/admin/voice/calls", headers={"Cookie": cookie})
        runtime_status, _ = request_json("/api/admin/runtime", headers={"Cookie": cookie})
        audit_status, _ = request_json("/api/admin/audit?limit=250", headers={"Cookie": cookie})
        assert len(calendar_status["providers"]) >= 2
        assert len(calendar_status["links"]) >= 2
        assert voice_history["calls"]
        assert runtime_status["worker"]["alive"] is True
        event_types = {item.get("event_type") for item in audit_status["events"]}
        assert "login_success" in event_types
        assert "appointment_booked" in event_types
        assert "lead_created_admin" in event_types
        assert "appointment_booked_admin" in event_types
        assert "manual_outbound_created" in event_types
        assert "lead_bulk_updated" in event_types
        assert "lead_view_created" in event_types
        assert "lead_view_deleted" in event_types
        assert "playbook_created" in event_types
        assert "playbook_used" in event_types
        assert "membership_created" in event_types
        assert "membership_action" in event_types
        assert "membership_due_run" in event_types
        assert "quote_response_public" in event_types
        assert "artifact_uploaded_admin" in event_types
        assert "artifact_replaced_admin" in event_types
        assert "artifact_updated_admin" in event_types
        assert "artifact_deleted_admin" in event_types
        assert "artifact_restored_admin" in event_types
        assert "artifact_batch_action_admin" in event_types
        assert "artifact_uploaded_public" in event_types
        assert "payment_commitment_public" in event_types
        assert "payment_commitment_public_action" in event_types
        assert "payment_commitment_action_admin" in event_types
        assert "inbound_message_captured" in event_types
        record(
            "calendar_voice_runtime_and_audit",
            True,
            {
                "provider_count": len(calendar_status["providers"]),
                "link_count": len(calendar_status["links"]),
                "voice_count": len(voice_history["calls"]),
                "audit_events": len(audit_status["events"]),
            },
        )

        cancelled, _ = request_json("/api/public/appointment/cancel", method="POST", payload={"code": appointment["confirmation_code"]})
        assert cancelled["appointment"]["status"] == "cancelled"
        record("public_cancel", True, cancelled)

        summary, _ = request_json("/api/admin/summary", headers={"Cookie": cookie})
        leads, _ = request_json("/api/admin/leads", headers={"Cookie": cookie})
        appointments, _ = request_json("/api/admin/appointments", headers={"Cookie": cookie})
        analytics, _ = request_json("/api/admin/analytics", headers={"Cookie": cookie})
        transcript, _ = request_json(f"/api/admin/conversations?lead_id={lead_id}", headers={"Cookie": cookie})
        assert summary["summary"]["voice_call_count"] >= 1
        assert summary["summary"]["calendar_link_count"] >= 2
        assert summary["summary"]["inbound_message_count"] >= 2
        assert len(leads["leads"]) >= 5
        assert len(appointments["appointments"]) >= 4
        assert len(transcript["messages"]) >= 4
        scorecard = next((item for item in analytics["analytics"]["rep_scorecards"] if int(item.get("rep_id") or 0) == created_rep_id), None)
        source_row = next((item for item in analytics["analytics"]["source_attribution"] if item.get("source") == "branch-sweep"), None)
        assert scorecard is not None
        assert int(scorecard["paid_cents"]) >= 50000
        assert int(scorecard["commission_rate_bps"]) == 1800
        assert source_row is not None
        assert int(source_row["lead_count"]) >= 1
        record("admin_surfaces", True, {**summary, "scorecard": scorecard, "source": source_row})

        request_json("/api/auth/logout", method="POST", payload={}, headers=auth_headers)
        viewer_login, viewer_headers = request_json(
            "/api/auth/login",
            method="POST",
            payload={"email": "viewer@example.com", "password": "change-me-now"},
        )
        viewer_cookie = viewer_headers.get("Set-Cookie", "")
        viewer_auth = {"Cookie": viewer_cookie, "X-CSRF-Token": viewer_login.get("csrf_token", "")}
        request_json(
            "/api/auth/change-password",
            method="POST",
            payload={
                "current_password": "change-me-now",
                "new_password": "ReadOnly-Desk!42",
                "confirm_password": "ReadOnly-Desk!42",
            },
            headers=viewer_auth,
        )
        me_viewer, _ = request_json("/api/auth/me", headers={"Cookie": viewer_cookie})
        viewer_auth = {"Cookie": viewer_cookie, "X-CSRF-Token": me_viewer.get("csrf_token", "")}
        denied_ok = False
        try:
            request_json(
                f"/api/appointments/{appointment_id}/cancel",
                method="POST",
                payload={},
                headers=viewer_auth,
            )
        except urllib.error.HTTPError as exc:
            body = json.loads(exc.read().decode("utf-8"))
            denied_ok = exc.code == 403 and "role required" in body["error"].lower()
            record("role_gating", denied_ok, body)
        assert denied_ok is True

    finally:
        server.shutdown()
        server.server_close()
        mock_server.shutdown()
        mock_server.server_close()

    report = {"ok": all(step["ok"] for step in steps), "steps": steps}
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
