from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
from typing import Any


def app_env() -> str:
    return str(os.getenv("APP_ENV", "development")).strip().lower() or "development"


def is_production() -> bool:
    return app_env() in {"prod", "production"}


def secure_cookie_enabled() -> bool:
    raw = str(os.getenv("SESSION_COOKIE_SECURE", "")).strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    return is_production()


def csrf_token() -> str:
    return secrets.token_urlsafe(24)


def webhook_signature(secret: str, timestamp: str, payload: bytes) -> str:
    mac = hmac.new(secret.encode("utf-8"), digestmod=hashlib.sha256)
    mac.update(timestamp.encode("utf-8"))
    mac.update(b".")
    mac.update(payload)
    return mac.hexdigest()


def normalize_json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
