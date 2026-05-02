from __future__ import annotations

import os
import threading
from typing import Any

from . import db
from .logic import dispatch_outbound, queue_reminders, run_autonomy_cycle


class BackgroundWorker:
    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self.last_tick_at = ""
        self.last_error = ""
        self.last_result: dict[str, Any] = {}

    def enabled(self) -> bool:
        raw = str(os.getenv("ENABLE_BACKGROUND_WORKER", "true")).strip().lower()
        return raw not in {"0", "false", "no", "off"}

    def interval_seconds(self) -> int:
        raw = str(os.getenv("BACKGROUND_WORKER_INTERVAL_SECONDS", "30")).strip()
        try:
            return max(5, int(raw))
        except ValueError:
            return 30

    def audit_retention_days(self) -> int:
        raw = str(os.getenv("AUDIT_RETENTION_DAYS", "30")).strip()
        try:
            return max(7, int(raw))
        except ValueError:
            return 30

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled(),
            "alive": bool(self._thread and self._thread.is_alive()),
            "interval_seconds": self.interval_seconds(),
            "last_tick_at": self.last_tick_at,
            "last_error": self.last_error,
            "last_result": self.last_result,
            "audit_retention_days": self.audit_retention_days(),
        }

    def start(self) -> None:
        if not self.enabled():
            return
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="appt-setter-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.5)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                queued = queue_reminders(None)
                autonomy = run_autonomy_cycle(None)
                membership_runs = db.run_due_membership_invoices(None)
                dispatched = dispatch_outbound(None)
                pruned = db.prune_audit_events(self.audit_retention_days())
                self.last_result = {
                    "queued_count": len(queued),
                    "autonomy": autonomy,
                    "membership_invoice_count": len(membership_runs),
                    "dispatched_count": len(dispatched),
                    "pruned_audit_count": pruned,
                }
                self.last_error = ""
                self.last_tick_at = db.utcnow_iso()
                if queued or dispatched or membership_runs:
                    db.log_audit_event(
                        "background_worker_cycle",
                        org_id=db.get_default_org_id(),
                        actor_email="system",
                        actor_role="system",
                        route="background_worker",
                        entity_type="worker",
                        entity_id="main",
                        status="ok",
                        detail="processed reminder queue and recurring membership billing",
                        metadata=self.last_result,
                    )
            except Exception as exc:  # pragma: no cover
                self.last_error = str(exc)
                self.last_tick_at = db.utcnow_iso()
                db.log_audit_event(
                    "background_worker_error",
                    org_id=db.get_default_org_id(),
                    actor_email="system",
                    actor_role="system",
                    route="background_worker",
                    entity_type="worker",
                    entity_id="main",
                    status="error",
                    detail=str(exc),
                )
            self._stop.wait(self.interval_seconds())


WORKER = BackgroundWorker()
