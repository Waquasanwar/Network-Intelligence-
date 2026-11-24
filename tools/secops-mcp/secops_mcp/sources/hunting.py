"""Defender advanced hunting and scores: the infrastructure figures Sentinel cannot provide.

Same Entra identity as the other Defender calls, with these application permissions:
  WindowsDefenderATP:  AdvancedQuery.Read.All, Score.Read.All
  Microsoft Graph:     SecurityEvents.Read.All (secure score)

Advanced hunting keeps 30 days and allows a limited number of queries a minute; these run once
per dashboard refresh.
"""

from __future__ import annotations

from .base import client, entra_token
from .defender_xdr import GRAPH, GRAPH_SCOPE, _graph_tokens, _mde

EOS_KQL = """DeviceTvmSoftwareInventory
| where EndOfSupportStatus == "EOS Software" or EndOfSupportStatus == "EOS Version"
| summarize devices = dcount(DeviceId) by SoftwareName, SoftwareVersion, EndOfSupportStatus
| top 15 by devices"""
EXPOSED_KQL = """DeviceTvmSoftwareVulnerabilities
| where VulnerabilitySeverityLevel in ("Critical", "High")
| join kind=inner (DeviceTvmSoftwareVulnerabilitiesKB | where IsExploitAvailable == true | project CveId, Title = VulnerabilityDescription) on CveId
| join kind=inner (DeviceInfo | summarize arg_max(Timestamp, IsInternetFacing, DeviceName) by DeviceId | where IsInternetFacing == true) on DeviceId
| summarize first_seen = min(Timestamp) by DeviceName, CveId, VulnerabilitySeverityLevel, Title = tostring(Title)
| top 20 by first_seen asc"""


def run(kql: str) -> list[dict]:
    base, token = _mde()
    resp = client().post(f"{base}/api/advancedqueries/run", headers={"Authorization": f"Bearer {token}"}, json={"Query": kql})
    resp.raise_for_status()
    return resp.json().get("Results", [])


def end_of_support() -> list[dict]:
    return [{"software": f"{r.get('SoftwareName', '')} {r.get('SoftwareVersion', '')}".strip(), "devices": int(r.get("devices", 0)),
             "service": "", "status": r.get("EndOfSupportStatus", "")} for r in run(EOS_KQL)]


def exploitable_exposed() -> list[dict]:
    import datetime as dt

    now = dt.datetime.now(dt.timezone.utc)
    out = []
    for r in run(EXPOSED_KQL):
        try:
            days = (now - dt.datetime.fromisoformat(str(r.get("first_seen", "")).replace("Z", "+00:00"))).days
        except ValueError:
            days = 0
        out.append({"host": r.get("DeviceName", ""), "cve": r.get("CveId", ""), "what": (r.get("Title") or "")[:90], "days_open": days, "team": ""})
    return out


def scores() -> dict:
    base, token = _mde()
    with client() as c:
        exp = c.get(f"{base}/api/exposureScore", headers={"Authorization": f"Bearer {token}"})
        exp.raise_for_status()
        g = c.get(f"{GRAPH}/security/secureScores", params={"$top": "1"}, headers={"Authorization": f"Bearer {entra_token(_graph_tokens, GRAPH_SCOPE)}"})
        g.raise_for_status()
    s = (g.json().get("value") or [{}])[0]
    return {"exposure_score": exp.json().get("score"), "secure_score": s.get("currentScore"), "secure_score_max": s.get("maxScore")}

