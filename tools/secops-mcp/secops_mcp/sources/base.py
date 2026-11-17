"""Shared helpers for the source adapters.

Every adapter is read-only. Credentials come from environment variables, which in
production should be injected from a secrets vault at start-up, never written to disk.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import httpx

TIMEOUT = httpx.Timeout(60.0, connect=10.0)
TRANSPORT: httpx.BaseTransport | None = None  # tests replace this with httpx.MockTransport


def client() -> httpx.Client:
    """The one HTTP client every adapter uses: timeouts set, TLS verified, no redirects to other hosts."""
    return httpx.Client(timeout=TIMEOUT, transport=TRANSPORT, follow_redirects=False)


def env_or(name: str, default: str) -> str:
    return os.environ.get(name) or default


class NotConfigured(Exception):
    """Raised when the environment variables a source needs are missing."""


def env(*names: str) -> dict[str, str]:
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        raise NotConfigured(f"Set {', '.join(missing)} to enable this source.")
    return {n: os.environ[n] for n in names}


@dataclass
class TokenCache:
    """Caches an OAuth client-credentials token until shortly before it expires."""

    token: str = ""
    expires_at: float = 0.0
    lock_skew: int = 120

    def get(self, url: str, data: dict[str, str]) -> str:
        if self.token and time.time() < self.expires_at - self.lock_skew:
            return self.token
        with client() as c:
            resp = c.post(url, data=data)
        resp.raise_for_status()
        body = resp.json()
        self.token = body["access_token"]
        self.expires_at = time.time() + int(body.get("expires_in", 3600))
        return self.token


def _managed_identity_token(cache: TokenCache, scope: str) -> str | None:
    """Token from the hosting platform's managed identity (Azure Container Apps or App Service).

    Preferred in production: no secret exists to leak or rotate.
    """
    endpoint, header = os.environ.get("IDENTITY_ENDPOINT"), os.environ.get("IDENTITY_HEADER")
    if not (endpoint and header):
        return None
    if cache.token and time.time() < cache.expires_at - cache.lock_skew:
        return cache.token
    params = {"resource": scope.removesuffix("/.default"), "api-version": "2019-08-01"}
    if os.environ.get("AZURE_CLIENT_ID"):
        params["client_id"] = os.environ["AZURE_CLIENT_ID"]  # user-assigned identity
    with client() as c:
        resp = c.get(endpoint, params=params, headers={"X-IDENTITY-HEADER": header})
    resp.raise_for_status()
    body = resp.json()
    cache.token, cache.expires_at = body["access_token"], float(body["expires_on"])
    return cache.token


def entra_token(cache: TokenCache, scope: str) -> str:
    """Managed identity when the host provides one, otherwise a service principal secret."""
    token = _managed_identity_token(cache, scope)
    if token:
        return token
    cfg = env("AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET")
    return cache.get(
        f"https://login.microsoftonline.com/{cfg['AZURE_TENANT_ID']}/oauth2/v2.0/token",
        {
            "grant_type": "client_credentials",
            "client_id": cfg["AZURE_CLIENT_ID"],
            "client_secret": cfg["AZURE_CLIENT_SECRET"],
            "scope": scope,
        },
    )


def week_ending(value) -> str:
    """The Sunday that closes the week a timestamp falls in, as YYYY-MM-DD (the dashboard's week key)."""
    import datetime as dt

    if isinstance(value, str):
        value = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if isinstance(value, (int, float)):
        value = dt.datetime.fromtimestamp(value, dt.timezone.utc)
    d = value.date() if isinstance(value, dt.datetime) else value
    return (d + dt.timedelta(days=6 - d.weekday())).isoformat()


def asset_type(os_platform: str | None, machine_type: str | None = None) -> str:
    """Maps an operating system or device class to the dashboard's asset types."""
    p, m = (os_platform or "").lower(), (machine_type or "").lower()
    if m == "server" or "server" in p:
        return "Servers"
    if m in ("desktop", "laptop") or p.startswith(("windows1", "windows7", "windows8", "macos", "mac os")):
        return "Workstations"
    if p in ("ios", "android", "ipados") or m in ("mobile", "phone"):
        return "Mobile and other endpoints"
    if "linux" in p or m in ("kubernetes node", "container"):
        return "Servers"
    return "Other"


def sla_days() -> dict[str, int]:
    """Days allowed to fix each severity, from SECOPS_SLA_DAYS (critical=15,high=30,medium=90)."""
    raw = os.environ.get("SECOPS_SLA_DAYS", "critical=15,high=30,medium=90,low=180")
    return {k.strip().lower(): int(v) for k, v in (p.split("=") for p in raw.split(",") if "=" in p)}
