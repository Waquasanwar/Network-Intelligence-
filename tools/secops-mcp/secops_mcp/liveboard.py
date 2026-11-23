"""Live operations: incidents in flight with service-level clocks, the alert rate, and when each
source last sent data. Refreshed every minute by the page; built for a wall screen.

Live: Sentinel (open incidents, alerts in the last hour, last data per table from Usage).
Sample: a realistic board generated relative to the current time, marked as sample.
"""

from __future__ import annotations

import datetime as dt
import logging
import random

from .ops import config
from .sources import sentinel
from .sources.base import NotConfigured

log = logging.getLogger("secops-mcp.liveboard")
STAGES = ["Initial Access", "Execution", "Persistence", "Privilege Escalation", "Defense Evasion", "Credential Access",
          "Discovery", "Lateral Movement", "Collection", "Command and Control", "Exfiltration", "Impact"]

OPEN_KQL = """
SecurityIncident
| where CreatedTime > ago(14d)
| summarize arg_max(TimeGenerated, *) by IncidentNumber
| where Status != "Closed"
| project id = tostring(IncidentNumber), title = Title, severity = tostring(Severity), status = tostring(Status),
    created = CreatedTime, acknowledged = iff(FirstModifiedTime > CreatedTime, FirstModifiedTime, datetime(null)),
    owner = tostring(Owner.assignedTo), tactics = AdditionalData.tactics, products = AdditionalData.alertProductNames
| order by created desc
| take 200
"""
RATE_KQL = "SecurityAlert | where TimeGenerated > ago(24h) | summarize n = count() by bin(TimeGenerated, 1h) | order by TimeGenerated asc"
HEALTH_KQL = "Usage | where TimeGenerated > ago(3d) | summarize last = max(TimeGenerated), gb = round(sum(Quantity) / 1024, 2) by DataType"


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def _iso(t: dt.datetime | None) -> str | None:
    return t.isoformat().replace("+00:00", "Z") if t else None


def _sample() -> dict:
    now, rnd = _now(), random.Random(_now().strftime("%Y%m%d%H"))
    titles = [("Suspicious sign-in followed by mailbox rule", "Microsoft Sentinel", ["Initial Access", "Persistence"]),
              ("Malware blocked on finance workstation", "SentinelOne", ["Execution"]),
              ("Credential dumping attempt on SRV-APP-114", "Microsoft Defender for Endpoint", ["Execution", "Credential Access"]),
              ("Impossible travel for privileged account", "Microsoft Entra ID", ["Initial Access"]),
              ("Large upload to personal cloud storage", "Netskope", ["Collection", "Exfiltration"]),
              ("Phishing link clicked by 3 users", "Mimecast", ["Initial Access"]),
              ("Public storage bucket with customer data", "Orca", ["Collection"]),
              ("Secret committed to payments-api", "GitLab", ["Credential Access"]),
              ("Lateral movement from jump host", "Microsoft Defender for Endpoint", ["Execution", "Privilege Escalation", "Lateral Movement"]),
              ("Unvaulted admin account used out of hours", "CyberArk", ["Privilege Escalation"]),
              ("Beaconing to newly registered domain", "SentinelOne", ["Execution", "Command and Control"]),
              ("Disabled audit policy on domain controller", "Microsoft Sentinel", ["Defense Evasion"])]
    teams = ["SOC", "SOC", "SOC", "Cloud platform", "Vulnerability management"]
    # (minutes since raised, minutes to acknowledge or None, status, severity, owner)
    spec = [(13, None, "New", "High", ""), (6, None, "New", "Medium", ""), (38, 9, "Active", "High", "A. Rahman"), (22, 11, "Active", "Medium", "Managed SOC"),
            (95, 7, "Active", "High", "J. Okafor"), (140, 12, "Contained", "Medium", "Managed SOC"), (300, 8, "Active", "High", "M. Silva"),
            (260, 14, "Active", "Medium", "Managed SOC"), (610, 6, "Contained", "High", "A. Rahman"), (1300, 21, "Active", "Medium", "Managed SOC"),
            (4, None, "New", "Low", ""), (75, 10, "Active", "Medium", "J. Okafor")]
    queue = []
    for i, (title, source, path) in enumerate(titles):
        age, ack_after, status, sev, owner = spec[i]
        created = now - dt.timedelta(minutes=age + rnd.randint(0, 2))
        acked = created + dt.timedelta(minutes=ack_after) if ack_after is not None else None
        queue.append({"id": f"INC-{48210 + i}", "title": title, "severity": sev, "status": status, "created": _iso(created),
                      "acknowledged": _iso(acked), "owner": owner, "team": teams[i % len(teams)], "source": source, "path": path})
    rate = [{"hour": _iso(now.replace(minute=0, second=0) - dt.timedelta(hours=23 - h)), "alerts": max(80, int(rnd.gauss(185 - 40 * (h < 6), 25)))} for h in range(24)]
    health = []
    for sysname, mins in [("Microsoft Sentinel", 1), ("Microsoft Defender for Endpoint", 3), ("SentinelOne", 2), ("Microsoft Entra ID", 4), ("Mimecast", 6),
                          ("Netskope", 9), ("Orca", 48), ("Microsoft Defender for Cloud", 55), ("GitLab", 31), ("CyberArk", 9940)]:
        health.append({"system": sysname, "last_seen": _iso(now - dt.timedelta(minutes=mins))})
    return {"queue": queue, "alert_rate": rate, "health": health}


def _live() -> dict:
    rows = sentinel.query(OPEN_KQL)
    to_list = lambda v: v if isinstance(v, list) else ([] if v in (None, "") else __import__("json").loads(v) if str(v).startswith("[") else [v])  # noqa: E731
    queue = [{"id": r["id"], "title": r["title"], "severity": r["severity"], "status": "New" if not r.get("acknowledged") else r["status"],
              "created": r["created"], "acknowledged": r.get("acknowledged") or None, "owner": r.get("owner") or "", "team": "SOC",
              "source": (to_list(r.get("products")) or ["Microsoft Sentinel"])[0], "path": [t for t in STAGES if t.replace(" ", "") in [x.replace(" ", "") for x in to_list(r.get("tactics"))]]}
             for r in rows]
    rate = [{"hour": r["TimeGenerated"], "alerts": r["n"]} for r in sentinel.query(RATE_KQL)]
    names = config()["systems_by_table"]
    health = {}
    for r in sentinel.query(HEALTH_KQL):
        sysname = names.get(r["DataType"])
        if sysname and (sysname not in health or r["last"] > health[sysname]):
            health[sysname] = r["last"]
    return {"queue": queue, "alert_rate": rate, "health": [{"system": k, "last_seen": v} for k, v in sorted(health.items())]}


def build(live: bool) -> dict:
    cfg = config()
    board, source = _sample(), "sample"
    if live:
        try:
            board, source = _live(), "live"
        except NotConfigured:
            pass
        except Exception as exc:  # noqa: BLE001
            log.warning("live board query failed: %s", exc)
    return {"generated_at": _iso(_now()), "source": source, "sla": cfg["sla"], **board}
