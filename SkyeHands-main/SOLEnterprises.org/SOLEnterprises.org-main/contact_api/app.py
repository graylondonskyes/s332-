import os
import smtplib
from email.message import EmailMessage
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional

app = FastAPI(title="SOLE Contact API")

class ContactPayload(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str
    org: Optional[str] = None
    page: Optional[str] = None
    userAgent: Optional[str] = None

    @field_validator('name', 'subject', 'message')
    def not_empty(cls, v, info):
        if not v or not str(v).strip():
            raise ValueError(f"{info.field_name} must not be empty")
        if len(str(v)) > 2000:
            raise ValueError(f"{info.field_name} is too long")
        return v

@app.get("/")
def root():
    return {"status": "ok", "service": "SOLE Contact API", "time": datetime.utcnow().isoformat()}

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/contact")
def contact(payload: ContactPayload):
    # Basic server-side validation already enforced by Pydantic validators
    # Required env vars (Google Workspace email still uses SMTP)
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    mail_to = os.getenv("MAIL_TO", "Contact@Solenterprises.org")
    mail_from = os.getenv("MAIL_FROM", smtp_user or "Contact@Solenterprises.org")

    if not all([smtp_host, smtp_user, smtp_pass]):
        raise HTTPException(status_code=500, detail="Missing SMTP env vars: SMTP_HOST, SMTP_USER, SMTP_PASS")

    # Build a richer email body including optional fields
    body_lines = [
        "New SOLE Contact Form Submission",
        "",
        f"Name: {payload.name}",
        f"Email: {payload.email}",
    ]
    if payload.org:
        body_lines.append(f"Organization: {payload.org}")
    if payload.page:
        body_lines.append(f"Page: {payload.page}")
    if payload.userAgent:
        body_lines.append(f"User Agent: {payload.userAgent}")

    body_lines.extend(["", f"Subject: {payload.subject}", "", "Message:", f"{payload.message}", "", f"UTC Time: {datetime.utcnow().isoformat()}" ])

    msg = EmailMessage()
    msg["Subject"] = f"[SOLE Contact] {payload.subject}"
    msg["From"] = mail_from
    msg["To"] = mail_to
    msg.set_content("\n".join(body_lines))

    try:
        # If TEST_NO_SMTP=1 is set, skip actual SMTP send (useful for local testing)
        if os.getenv("TEST_NO_SMTP") == "1":
            # Log the intended message and return success for tests
            print("[TEST MODE] Skipping SMTP send. Mail would be:")
            print(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email send failed: {type(e).__name__}: {e}")

    return {"sent": True}
