from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


def ai_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def polish_response(base_text: str, context: dict[str, Any]) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return base_text

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    system_prompt = (
        "You are a concise, high-conversion AI appointment setter. "
        "Preserve facts, keep the reply under 120 words, ask only one next-step question, "
        "and never invent appointment times."
    )
    user_prompt = {
        "base_reply": base_text,
        "lead": context.get("lead", {}),
        "latest_user_message": context.get("latest_user_message", ""),
        "suggested_slots": context.get("suggested_slots", []),
    }
    payload = {
        "model": model,
        "temperature": 0.3,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_prompt)},
        ],
    }
    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"].strip()
        return content or base_text
    except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError, TimeoutError):
        return base_text
