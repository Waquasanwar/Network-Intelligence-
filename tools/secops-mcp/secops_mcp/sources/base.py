"""Shared helpers for the source adapters.

Every adapter is read-only. Credentials come from environment variables, which in
production should be injected from a secrets vault at start-up, never written to disk.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field

import httpx

TIMEOUT = httpx.Timeout(60.0, connect=10.0)


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
    _client: httpx.Client = field(default_factory=lambda: httpx.Client(timeout=TIMEOUT))

    def get(self, url: str, data: dict[str, str]) -> str:
        if self.token and time.time() < self.expires_at - self.lock_skew:
            return self.token
        resp = self._client.post(url, data=data)
        resp.raise_for_status()
        body = resp.json()
        self.token = body["access_token"]
        self.expires_at = time.time() + int(body.get("expires_in", 3600))
        return self.token


def entra_token(cache: TokenCache, scope: str) -> str:
    """Client-credentials token from Microsoft Entra ID for a service principal."""
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
