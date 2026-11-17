"""Mimecast, through API 2.0 (OAuth 2.0 client credentials).

Create an API 2.0 application in the Mimecast Administration Console under
Services > API and Platform Integrations, with a custom administrator role that can only
read Awareness Training and threat (TTP) reports.

The two Awareness Training paths below are taken from Mimecast's published endpoint
reference. Confirm the request bodies and the TTP log paths against the API 2.0 portal
for your account before relying on them.
"""

from __future__ import annotations

import httpx

from .base import TIMEOUT, TokenCache, env

BASE = "https://api.services.mimecast.com"
_tokens = TokenCache()


def _token() -> str:
    cfg = env("MIMECAST_CLIENT_ID", "MIMECAST_CLIENT_SECRET")
    return _tokens.get(
        f"{BASE}/oauth/token",
        {"grant_type": "client_credentials", "client_id": cfg["MIMECAST_CLIENT_ID"], "client_secret": cfg["MIMECAST_CLIENT_SECRET"]},
    )


def _post(path: str, body: dict) -> dict:
    resp = httpx.post(f"{BASE}{path}", headers={"Authorization": f"Bearer {_token()}"}, json=body, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def simulation_campaigns() -> list[dict]:
    """Simulated phishing campaigns (sent, clicked, reported)."""
    return _post("/api/awareness-training/phishing/campaign/get-campaign", {"data": [{}]}).get("data", [])


def simulation_users(campaign_id: str) -> list[dict]:
    """Per-recipient results for one campaign, for the repeat-clicker list."""
    return _post("/api/awareness-training/phishing/campaign/get-user-data", {"data": [{"id": campaign_id}]}).get("data", [])
