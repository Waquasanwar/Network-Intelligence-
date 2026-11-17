"""CyberArk Privileged Access (Privilege Cloud or self-hosted PAM), through the PVWA REST API.

Privilege Cloud: create an OAuth2 service user in CyberArk Identity (Apps > OAuth2 Client) and
give it a read-only role (an auditor-style role; never one that can retrieve passwords).
  CYBERARK_MODE=cloud, CYBERARK_IDENTITY_URL=https://<tenant>.id.cyberark.cloud,
  CYBERARK_PVWA_URL=https://<subdomain>.privilegecloud.cyberark.cloud
Self-hosted PAM: a Vault user with "Audit users" and list-only rights on the safes in scope.
  CYBERARK_MODE=selfhosted, CYBERARK_PVWA_URL=https://pvwa.yourco.local

Discovered accounts (found on servers but not yet onboarded) need membership of the Vault
Admins group in the classic API; if you cannot grant that, the count is skipped.
"""

from __future__ import annotations

from collections import Counter

from .base import TokenCache, client, env, env_or

_tokens = TokenCache()


def _auth() -> tuple[str, dict]:
    pvwa = env("CYBERARK_PVWA_URL")["CYBERARK_PVWA_URL"].rstrip("/")
    if env_or("CYBERARK_MODE", "cloud") == "selfhosted":
        cfg = env("CYBERARK_USERNAME", "CYBERARK_PASSWORD")
        with client() as c:
            resp = c.post(f"{pvwa}/PasswordVault/API/auth/CyberArk/Logon", json={"username": cfg["CYBERARK_USERNAME"], "password": cfg["CYBERARK_PASSWORD"]})
        resp.raise_for_status()
        return pvwa, {"Authorization": resp.json() if isinstance(resp.json(), str) else resp.text.strip('"')}
    cfg = env("CYBERARK_IDENTITY_URL", "CYBERARK_CLIENT_ID", "CYBERARK_CLIENT_SECRET")
    token = _tokens.get(cfg["CYBERARK_IDENTITY_URL"].rstrip("/") + "/oauth2/platformtoken",
                        {"grant_type": "client_credentials", "client_id": cfg["CYBERARK_CLIENT_ID"], "client_secret": cfg["CYBERARK_CLIENT_SECRET"]})
    return pvwa, {"Authorization": f"Bearer {token}"}


def _all(pvwa: str, headers: dict, path: str, cap: int = 100000):
    offset = 0
    with client() as c:
        while offset < cap:
            resp = c.get(f"{pvwa}{path}", params={"limit": 1000, "offset": offset}, headers=headers)
            resp.raise_for_status()
            rows = resp.json().get("value", [])
            yield from rows
            if len(rows) < 1000:
                return
            offset += 1000


def summary() -> dict:
    pvwa, headers = _auth()
    total, unmanaged, by_platform = 0, 0, Counter()
    for a in _all(pvwa, headers, "/PasswordVault/API/Accounts"):
        total += 1
        by_platform[a.get("platformId", "unknown")] += 1
        if not (a.get("secretManagement") or {}).get("automaticManagementEnabled", False):
            unmanaged += 1
    try:
        discovered = sum(1 for _ in _all(pvwa, headers, "/PasswordVault/API/DiscoveredAccounts"))
    except Exception:  # noqa: BLE001 - needs Vault Admins; report as unknown rather than fail
        discovered = None
    return {"vaulted_accounts": total, "not_automatically_managed": unmanaged, "discovered_not_onboarded": discovered,
            "by_platform": dict(by_platform.most_common(10))}
