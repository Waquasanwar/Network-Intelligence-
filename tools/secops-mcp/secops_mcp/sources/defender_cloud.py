"""Microsoft Defender for Cloud, through Azure Resource Graph.

Needs the same service principal as Sentinel, with "Security Reader" (or "Reader") on the
subscriptions in scope. Resource Graph returns current state only; weekly trends come from
the snapshot store in server.py.
"""

from __future__ import annotations

import httpx

from .base import TIMEOUT, TokenCache, entra_token, env

_tokens = TokenCache()
SCOPE = "https://management.azure.com/.default"
URL = "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01"

SECURE_SCORE = """
securityresources
| where type == "microsoft.security/securescores" and name == "ascScore"
| extend percent = todouble(properties.score.percentage) * 100
| summarize secure_score = round(avg(percent), 0)
"""

UNHEALTHY_BY_SEVERITY = """
securityresources
| where type == "microsoft.security/assessments"
| where tostring(properties.status.code) == "Unhealthy"
| extend severity = tostring(properties.metadata.severity)
| summarize findings = count(), resources = dcount(tostring(properties.resourceDetails.Id)) by severity
"""

COVERAGE = """
securityresources
| where type == "microsoft.security/pricings"
| extend plan = name, tier = tostring(properties.pricingTier)
| summarize plans_on = countif(tier == "Standard"), plans_total = count()
"""


def _rg(kql: str) -> list[dict]:
    cfg = env("DEFENDER_SUBSCRIPTION_IDS")
    token = entra_token(_tokens, SCOPE)
    resp = httpx.post(
        URL,
        headers={"Authorization": f"Bearer {token}"},
        json={"subscriptions": [s.strip() for s in cfg["DEFENDER_SUBSCRIPTION_IDS"].split(",")], "query": kql},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("data", [])


def summary() -> dict:
    return {
        "secure_score": (_rg(SECURE_SCORE) or [{}])[0].get("secure_score"),
        "unhealthy_by_severity": _rg(UNHEALTHY_BY_SEVERITY),
        "coverage": (_rg(COVERAGE) or [{}])[0],
    }
