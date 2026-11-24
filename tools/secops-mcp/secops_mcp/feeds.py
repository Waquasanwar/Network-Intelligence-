"""Which data feeds are arriving in Sentinel, which are late and which are silent.

One query over every table the catalogue expects (union isfuzzy ignores tables that do not exist).
"""

from __future__ import annotations

import datetime as dt
import logging

from .sources import sentinel

log = logging.getLogger("secops-mcp.feeds")
KQL = """union isfuzzy=true withsource=TableName {tables}
| where TimeGenerated > ago(7d)
| summarize last = max(TimeGenerated), rows = count() by TableName"""


def health(tables: dict[str, int], live: bool) -> list[dict]:
    """tables: name -> hours of silence before it counts as late."""
    if not live:
        return _sample(tables)
    try:
        rows = {r["TableName"]: r for r in sentinel.query(KQL.format(tables=", ".join(sorted(tables))))}
    except Exception as exc:  # noqa: BLE001
        log.warning("feed health query failed: %s", exc)
        return _sample(tables)
    now, out = dt.datetime.now(dt.timezone.utc), []
    for t, late_h in sorted(tables.items()):
        r = rows.get(t)
        if not r:
            out.append({"table": t, "state": "silent", "last": None, "rows_7d": 0, "source": "live"})
            continue
        last = dt.datetime.fromisoformat(str(r["last"]).replace("Z", "+00:00"))
        age = (now - last).total_seconds() / 3600
        out.append({"table": t, "state": "arriving" if age <= late_h else "late", "last": last.isoformat(), "hours_since": round(age, 1), "rows_7d": r["rows"], "source": "live"})
    return out


def _sample(tables: dict[str, int]) -> list[dict]:
    now = dt.datetime.now(dt.timezone.utc)
    demo = {"SecurityIncident": (0.2, 3100), "SecurityAlert": (0.1, 31000), "SigninLogs": (0.3, 2_400_000), "AuditLogs": (0.4, 180_000),
            "SentinelOneThreats_CL": (1.5, 640), "SentinelOneAgents_CL": (6.0, 63_000), "NetskopeAlertEvents_CL": (0.8, 52_000),
            "MimecastTTPUrl_CL": (2.5, 4_100), "OrcaAlerts_CL": (30.0, 900), "SecurityRecommendation": (11.0, 42_000), "CommonSecurityLog": (0.1, 9_800_000),
            "Usage": (0.9, 2_100), "SentinelHealth": (0.5, 3_300)}
    out = []
    for t, late_h in sorted(tables.items()):
        if t not in demo:
            out.append({"table": t, "state": "silent", "last": None, "rows_7d": 0, "source": "sample"})
            continue
        age, rows = demo[t]
        out.append({"table": t, "state": "arriving" if age <= late_h else "late", "last": (now - dt.timedelta(hours=age)).isoformat(),
                    "hours_since": age, "rows_7d": rows, "source": "sample"})
    return out
