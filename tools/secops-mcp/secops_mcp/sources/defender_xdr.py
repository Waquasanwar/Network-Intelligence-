"""Microsoft Defender XDR and Defender for Endpoint (incidents, devices, vulnerabilities).

Uses the same Entra identity as Sentinel (managed identity in production) with these
application permissions, admin-consented:
  Microsoft Graph:                     SecurityIncident.Read.All
  WindowsDefenderATP (Defender API):   Machine.Read.All, Vulnerability.Read.All

Vulnerabilities come from the per-device software vulnerability assessment, which carries the
operating system of each device, so findings split into servers, workstations and mobile.
The Defender API allows about 30 calls a minute; large estates should switch to the export
(file) version of the same assessment.
"""

from __future__ import annotations

import datetime as dt
from collections import Counter, defaultdict

from .base import TokenCache, asset_type, client, entra_token, env_or, sla_days, week_ending

GRAPH, GRAPH_SCOPE = "https://graph.microsoft.com/v1.0", "https://graph.microsoft.com/.default"
_graph_tokens, _mde_tokens = TokenCache(), TokenCache()


def _mde() -> tuple[str, str]:
    base = env_or("MDE_API_URL", "https://api.securitycenter.microsoft.com").rstrip("/")
    return base, entra_token(_mde_tokens, base + "/.default")


def _paged(url: str, token: str, params: dict | None = None, limit: int = 50000):
    n = 0
    with client() as c:
        while url and n < limit:
            resp = c.get(url, params=params, headers={"Authorization": f"Bearer {token}"})
            resp.raise_for_status()
            body = resp.json()
            rows = body.get("value", [])
            yield from rows
            n += len(rows)
            url, params = body.get("@odata.nextLink"), None


def incidents(weeks: int = 12) -> dict:
    token = entra_token(_graph_tokens, GRAPH_SCOPE)
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(weeks=weeks)).strftime("%Y-%m-%dT%H:%M:%SZ")
    weekly = defaultdict(Counter)
    for i in _paged(f"{GRAPH}/security/incidents", token, {"$filter": f"createdDateTime ge {since}", "$top": "50"}):
        w = weekly[week_ending(i["createdDateTime"])]
        w["incidents"] += 1
        w[str(i.get("severity", "unknown")).lower()] += 1
        if i.get("classification") == "falsePositive":
            w["false_positive"] += 1
        if i.get("status") not in ("resolved", "redirected"):
            w["still_open"] += 1
    return {"by_week": {k: dict(v) for k, v in sorted(weekly.items())}}


def devices() -> dict:
    base, token = _mde()
    by_type, exposure = Counter(), Counter()
    for m in _paged(f"{base}/api/machines", token):
        if m.get("onboardingStatus", "Onboarded") != "Onboarded":
            continue
        by_type[asset_type(m.get("osPlatform"))] += 1
        exposure[m.get("exposureLevel", "None")] += 1
    return {"onboarded_by_type": dict(by_type), "by_exposure": dict(exposure)}


def vulnerabilities() -> dict:
    """Critical and high findings by asset type, with overdue counts and average age."""
    base, token = _mde()
    sla, now = sla_days(), dt.datetime.now(dt.timezone.utc)
    stats = defaultdict(lambda: {"critical": 0, "high": 0, "overdue": 0, "ages": [], "devices": set()})
    hosts, cves = defaultdict(lambda: {"critical": 0, "high": 0, "oldest_days": 0, "type": ""}), Counter()
    for v in _paged(f"{base}/api/machines/SoftwareVulnerabilitiesByMachine", token, {"pageSize": "10000"}):
        sev = str(v.get("vulnerabilitySeverityLevel", "")).lower()
        if sev not in ("critical", "high"):
            continue
        kind = asset_type(v.get("osPlatform"))
        first = v.get("firstSeenTimestamp")
        age = (now - dt.datetime.fromisoformat(first.replace("Z", "+00:00"))).days if first else 0
        s = stats[kind]
        s[sev] += 1
        s["ages"].append(age)
        s["devices"].add(v.get("deviceId"))
        s["overdue"] += age > sla.get(sev, 30)
        h = hosts[v.get("deviceName", "unknown")]
        h[sev] += 1
        h["type"] = kind
        h["oldest_days"] = max(h["oldest_days"], age)
        cves[(v.get("cveId"), v.get("softwareName"), sev)] += 1
    by_type = [{"type": k, "critical": s["critical"], "high": s["high"], "overdue": s["overdue"], "devices_affected": len(s["devices"]),
                "avg_age_days": round(sum(s["ages"]) / len(s["ages"])) if s["ages"] else 0} for k, s in stats.items()]
    top_hosts = sorted(({"host": k, **v} for k, v in hosts.items()), key=lambda r: (-r["critical"], -r["high"]))[:10]
    common = [{"title": f"{cve} in {sw}", "severity": sev.title(), "assets": n} for (cve, sw, sev), n in cves.most_common(10)]
    return {"by_asset_type": by_type, "top_hosts": top_hosts, "common_weaknesses": common, "sla_days": sla}
