"""Microsoft Entra ID identity risk, through Microsoft Graph.

Application permission IdentityRiskyUser.Read.All (Entra ID P2). Sign-in volumes come from
Sentinel's SigninLogs instead, which is cheaper than paging Graph sign-in logs.
"""

from __future__ import annotations

from collections import Counter

from .base import TokenCache, client, entra_token

_tokens = TokenCache()


def risky_users() -> dict:
    token = entra_token(_tokens, "https://graph.microsoft.com/.default")
    url, levels, n = "https://graph.microsoft.com/v1.0/identityProtection/riskyUsers", Counter(), 0
    params = {"$filter": "riskState eq 'atRisk'", "$top": "500"}
    with client() as c:
        while url:
            resp = c.get(url, params=params, headers={"Authorization": f"Bearer {token}"})
            resp.raise_for_status()
            body = resp.json()
            for u in body.get("value", []):
                levels[u.get("riskLevel", "unknown")] += 1
                n += 1
            url, params = body.get("@odata.nextLink"), None
    return {"users_at_risk": n, "by_level": dict(levels)}
