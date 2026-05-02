from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from typing import Any

ROLE_LEVELS = {"viewer": 1, "manager": 2, "admin": 3}
SESSION_COOKIE = "setter_admin_session"



def normalize_role(role: str | None) -> str:
    value = str(role or "viewer").strip().lower()
    return value if value in ROLE_LEVELS else "viewer"



def role_allows(actual_role: str | None, required_role: str = "viewer") -> bool:
    return ROLE_LEVELS.get(normalize_role(actual_role), 0) >= ROLE_LEVELS.get(normalize_role(required_role), 0)



def hash_password(password: str) -> str:
    iterations = 260_000
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${digest.hex()}"



def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt, expected_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
    except (ValueError, TypeError):
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return hmac.compare_digest(digest.hex(), expected_hex)



def new_session_token() -> str:
    return secrets.token_urlsafe(32)



def session_ttl_hours() -> int:
    raw = os.getenv("ADMIN_SESSION_TTL_HOURS", "12")
    try:
        return max(1, int(raw))
    except ValueError:
        return 12



def login_lockout_threshold() -> int:
    raw = os.getenv("ADMIN_LOGIN_LOCKOUT_THRESHOLD", "5")
    try:
        return max(3, int(raw))
    except ValueError:
        return 5



def login_lockout_minutes() -> int:
    raw = os.getenv("ADMIN_LOGIN_LOCKOUT_MINUTES", "15")
    try:
        return max(1, int(raw))
    except ValueError:
        return 15



def validate_password_policy(password: str, email: str = "") -> tuple[bool, str]:
    value = str(password or "")
    if len(value) < 12:
        return False, "Password must be at least 12 characters."
    if not any(ch.islower() for ch in value):
        return False, "Password must include a lowercase letter."
    if not any(ch.isupper() for ch in value):
        return False, "Password must include an uppercase letter."
    if not any(ch.isdigit() for ch in value):
        return False, "Password must include a number."
    if not any(not ch.isalnum() for ch in value):
        return False, "Password must include a symbol."
    local = str(email or "").split("@", 1)[0].strip().lower()
    if local and local in value.lower():
        return False, "Password must not contain the email name."
    return True, ""



def default_admin_users() -> list[dict[str, Any]]:
    bootstrap_email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "").strip()
    bootstrap_password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "")
    bootstrap_name = os.getenv("ADMIN_BOOTSTRAP_NAME", "Owner Desk").strip() or "Owner Desk"
    manager_email = os.getenv("MANAGER_BOOTSTRAP_EMAIL", "").strip()
    manager_password = os.getenv("MANAGER_BOOTSTRAP_PASSWORD", "")
    viewer_email = os.getenv("VIEWER_BOOTSTRAP_EMAIL", "").strip()
    viewer_password = os.getenv("VIEWER_BOOTSTRAP_PASSWORD", "")
    org_id = int(os.getenv("ADMIN_BOOTSTRAP_ORG_ID", "1") or 1)
    users: list[dict[str, Any]] = []
    if bootstrap_email and bootstrap_password:
        users.append(
            {
                "email": bootstrap_email,
                "display_name": bootstrap_name,
                "role": "admin",
                "org_id": org_id,
                "password_hash": hash_password(bootstrap_password),
                "require_password_change": 1,
            }
        )
    if manager_email and manager_password:
        users.append(
            {
                "email": manager_email,
                "display_name": "Ops Desk",
                "role": "manager",
                "org_id": org_id,
                "password_hash": hash_password(manager_password),
                "require_password_change": 1,
            }
        )
    if viewer_email and viewer_password:
        users.append(
            {
                "email": viewer_email,
                "display_name": "Read Only Desk",
                "role": "viewer",
                "org_id": org_id,
                "password_hash": hash_password(viewer_password),
                "require_password_change": 1,
            }
        )
    return users
