"""Mimecast, through API 2.0 (OAuth 2.0 client credentials).

Create an API 2.0 application in the Mimecast Administration Console under
Services > API and Platform Integrations, with a custom administrator role that can only
read Awareness Training and threat (TTP) reports.

The Awareness Training and TTP log paths below are taken from Mimecast's published endpoint
reference. Confirm the request bodies and the TTP log paths against the API 2.0 portal
for your account before relying on them.
"""

from __future__ import annotations

from .base import TokenCache, client, env

BASE = "https://api.services.mimecast.com"
_tokens = TokenCache()


def _token() -> str:
    cfg = env("MIMECAST_CLIENT_ID", "MIMECAST_CLIENT_SECRET")
    return _tokens.get(
        f"{BASE}/oauth/token",
        {"grant_type": "client_credentials", "client_id": cfg["MIMECAST_CLIENT_ID"], "client_secret": cfg["MIMECAST_CLIENT_SECRET"]},
    )


def _post(path: str, body: dict) -> dict:
    resp = client().post(f"{BASE}{path}", headers={"Authorization": f"Bearer {_token()}"}, json=body)
    resp.raise_for_status()
    return resp.json()


def simulation_campaigns() -> list[dict]:
    """Simulated phishing campaigns (sent, clicked, reported)."""
    return _post("/api/awareness-training/phishing/campaign/get-campaign", {"data": [{}]}).get("data", [])


def simulation_users(campaign_id: str) -> list[dict]:
    """Per-recipient results for one campaign, for the repeat-clicker list."""
    return _post("/api/awareness-training/phishing/campaign/get-user-data", {"data": [{"id": campaign_id}]}).get("data", [])


def _logs(path: str, kind: str, weeks: int, cap: int = 50000) -> list[dict]:
    import datetime as dt
    to = dt.datetime.now(dt.timezone.utc)
    body = {"meta": {"pagination": {"pageSize": 500}},
            "data": [{"from": (to - dt.timedelta(weeks=weeks)).strftime("%Y-%m-%dT%H:%M:%S+0000"), "to": to.strftime("%Y-%m-%dT%H:%M:%S+0000")}]}
    out = []
    while len(out) < cap:
        resp = _post(path, body)
        for d in resp.get("data", []):
            out.extend(d.get(kind, []))
        token = (resp.get("meta", {}).get("pagination") or {}).get("next")
        if not token:
            break
        body["meta"]["pagination"]["pageToken"] = token
    return out


def threat_summary(weeks: int = 12) -> dict:
    """Weekly counts from the three targeted-threat (TTP) logs. Needs Monitoring read permission
    for URL Protection, Attachment Protection and Impersonation Protection."""
    from collections import Counter

    from .base import week_ending

    weekly = {k: Counter() for k in ("malicious_url_blocked", "malicious_url_clicked", "attachments_blocked", "impersonation_hits")}
    for r in _logs("/api/ttp/url/get-logs", "clickLogs", weeks):
        if str(r.get("scanResult", "")).lower() == "malicious":
            key = "malicious_url_blocked" if str(r.get("action", "")).lower() == "block" else "malicious_url_clicked"
            weekly[key][week_ending(r["date"])] += 1
    for r in _logs("/api/ttp/attachment/get-logs", "attachmentLogs", weeks):
        if str(r.get("result", "")).lower() == "malicious":
            weekly["attachments_blocked"][week_ending(r["date"])] += 1
    for r in _logs("/api/ttp/impersonation/get-logs", "impersonationLogs", weeks):
        if r.get("taggedMalicious") or str(r.get("action", "")).lower() in ("hold", "bounce"):
            weekly["impersonation_hits"][week_ending(r["eventTime"])] += 1
    return {k: dict(sorted(v.items())) for k, v in weekly.items()}
