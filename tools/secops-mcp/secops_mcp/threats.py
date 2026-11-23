"""Threat paths and near misses.

A threat path is the chain of attack stages (MITRE ATT&CK tactics) an incident reached, and where
it was stopped. A near miss is a real attack that got deep into the chain (three stages or more,
or credential access, privilege escalation or lateral movement) and was stopped before data left
or damage was done. Near misses are the clearest evidence of what the controls are worth, and of
where detection fires too late.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import random

from .liveboard import STAGES
from .sources import sentinel
from .sources.base import NotConfigured

log = logging.getLogger("secops-mcp.threats")
DEEP = {"Credential Access", "Privilege Escalation", "Lateral Movement", "Command and Control"}
END = {"Exfiltration", "Impact"}

PATHS_KQL = """
SecurityIncident
| where CreatedTime > ago(90d)
| summarize arg_max(TimeGenerated, *) by IncidentNumber
| where Classification != "FalsePositive"
| project id = tostring(IncidentNumber), title = Title, severity = tostring(Severity), created = CreatedTime, closed = ClosedTime,
    status = tostring(Status), tactics = AdditionalData.tactics, products = AdditionalData.alertProductNames
"""


def _order(tactics) -> list[str]:
    if isinstance(tactics, str):
        tactics = json.loads(tactics) if tactics.startswith("[") else [tactics]
    norm = {t.replace(" ", "").lower() for t in (tactics or [])}
    return [s for s in STAGES if s.replace(" ", "").lower() in norm]


def classify(p: dict) -> dict:
    stages = p["path"]
    p["depth"] = len(stages)
    p["reached_end"] = bool(END & set(stages))
    p["near_miss"] = bool(stages) and not p["reached_end"] and (len(stages) >= 3 or bool(DEEP & set(stages)))
    p["stopped_at"] = stages[-1] if stages else None
    return p


def _sample() -> list[dict]:
    rnd, now, out = random.Random(11), dt.datetime.now(dt.timezone.utc), []
    chains = [(["Initial Access"], 46, "Mimecast"), (["Initial Access", "Execution"], 21, "SentinelOne"), (["Execution"], 18, "SentinelOne"),
              (["Initial Access", "Persistence"], 9, "Microsoft Entra ID"), (["Initial Access", "Execution", "Credential Access"], 5, "Microsoft Defender for Endpoint"),
              (["Execution", "Privilege Escalation", "Lateral Movement"], 3, "Microsoft Defender for Endpoint"), (["Collection", "Exfiltration"], 2, "Netskope"),
              (["Initial Access", "Execution", "Command and Control"], 4, "SentinelOne"), (["Credential Access"], 6, "GitLab"), (["Defense Evasion"], 4, "Microsoft Sentinel"),
              (["Initial Access", "Execution", "Persistence", "Privilege Escalation", "Lateral Movement"], 1, "Microsoft Defender for Endpoint")]
    titles = {"Mimecast": "Phishing link clicked", "SentinelOne": "Malicious process on endpoint", "Microsoft Entra ID": "Compromised account sign-in",
              "Microsoft Defender for Endpoint": "Hands-on-keyboard activity", "Netskope": "Data sent to personal storage", "GitLab": "Secret exposed in code",
              "Microsoft Sentinel": "Security control tampering"}
    n = 0
    for path, count, source in chains:
        for _ in range(count):
            n += 1
            created = now - dt.timedelta(days=rnd.uniform(0.2, 89))
            sev = "High" if len(path) >= 3 or END & set(path) else rnd.choice(["Medium", "Medium", "Low", "High"])
            out.append(classify({"id": f"INC-{47100 + n}", "title": titles[source], "severity": sev, "created": created.isoformat().replace("+00:00", "Z"),
                                 "contain_hours": round(max(0.4, rnd.gauss(2.5 + 1.6 * len(path), 1.5)), 1), "source": source, "path": path,
                                 "stopped_by": source if len(path) < 3 else rnd.choice(["SOC analyst", "SentinelOne", "Microsoft Defender for Endpoint"])}))
    return sorted(out, key=lambda p: p["created"], reverse=True)


def build(live: bool) -> dict:
    paths, source = _sample(), "sample"
    if live:
        try:
            rows = sentinel.query(PATHS_KQL)
            prods = lambda v: json.loads(v) if isinstance(v, str) and v.startswith("[") else (v or [])  # noqa: E731
            live_paths = [classify({"id": r["id"], "title": r["title"], "severity": r["severity"], "created": r["created"],
                                    "contain_hours": round((dt.datetime.fromisoformat(r["closed"].replace("Z", "+00:00")) - dt.datetime.fromisoformat(r["created"].replace("Z", "+00:00"))).total_seconds() / 3600, 1) if r.get("closed") else None,
                                    "source": (prods(r.get("products")) or ["Microsoft Sentinel"])[0], "path": _order(r.get("tactics")),
                                    "stopped_by": (prods(r.get("products")) or ["SOC analyst"])[-1]}) for r in rows]
            if live_paths:
                paths, source = [p for p in live_paths if p["path"]], "live"
        except NotConfigured:
            pass
        except Exception as exc:  # noqa: BLE001
            log.warning("threat path query failed: %s", exc)
    return {"source": source, "stages": STAGES, "paths": paths}
