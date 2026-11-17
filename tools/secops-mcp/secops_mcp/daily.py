"""Daily figures for the last two years, so the executive view can total any period: a day, a
week, a month, a year, or a custom range, and compare it with the period before.

Live: one Sentinel query returns the incident and alert figures per day. Fields Sentinel cannot
give stay on sample data and are listed in `daily_sources`. Sample: a steady, seeded series
with weekday patterns and a gradual improvement, clearly marked as sample.
"""

from __future__ import annotations

import datetime as dt
import logging
import math
import random

from .sources import sentinel
from .sources.base import NotConfigured

log = logging.getLogger("secops-mcp.daily")
DAYS = 730

DAILY_KQL = """
let alerts = SecurityAlert
| where TimeGenerated > ago(730d)
| summarize arg_max(TimeGenerated, *) by SystemAlertId
| summarize alerts = count() by date = startofday(TimeGenerated);
SecurityIncident
| where CreatedTime > ago(730d)
| summarize arg_max(TimeGenerated, *) by IncidentNumber
| summarize
    incidents = count(),
    high = countif(Severity == "High"),
    closed = countif(Status == "Closed"),
    false_positive = countif(Classification == "FalsePositive"),
    mtta_sum = sum(datetime_diff("minute", FirstModifiedTime, CreatedTime)),
    mttd_sum = sum(datetime_diff("minute", CreatedTime, FirstActivityTime)),
    contain_sum_h = sum(datetime_diff("minute", ClosedTime, CreatedTime)) / 60.0,
    within_sla = countif(Status == "Closed" and datetime_diff("hour", ClosedTime, CreatedTime) <= iff(Severity == "High", 4, 24))
  by date = startofday(CreatedTime)
| join kind=fullouter alerts on date
| project date = coalesce(date, date1), alerts = coalesce(alerts, 0), incidents = coalesce(incidents, 0), high = coalesce(high, 0),
    closed = coalesce(closed, 0), false_positive = coalesce(false_positive, 0), mtta_sum = coalesce(mtta_sum, 0),
    mttd_sum = coalesce(mttd_sum, 0), contain_sum_h = coalesce(contain_sum_h, 0.0), within_sla = coalesce(within_sla, 0)
| order by date asc
"""

SENTINEL_FIELDS = ("alerts", "incidents", "high", "closed", "false_positive", "mtta_sum", "mttd_sum", "contain_sum_h", "within_sla")


def _sample() -> list[dict]:
    rnd = random.Random(7)
    today = dt.date.today()
    rows = []
    for i in range(DAYS, 0, -1):
        d = today - dt.timedelta(days=i)
        progress = (DAYS - i) / DAYS  # 0 a year ago, 1 yesterday: things improve slowly
        weekday = 0.55 if d.weekday() >= 5 else 1.0
        season = 1 + 0.08 * math.sin(i / 58)
        inc = max(0, round(rnd.gauss(6.2 - 1.6 * progress, 1.6) * weekday * season))
        if rnd.random() < 0.012:  # an occasional bad day
            inc += rnd.randint(8, 14)
        high = sum(rnd.random() < 0.27 for _ in range(inc))
        closed = max(0, inc - (rnd.random() < 0.2))
        mtta = max(4.0, rnd.gauss(19 - 9 * progress, 3))
        contain = max(1.5, rnd.gauss(10 - 3.8 * progress, 2))
        sla_rate = min(0.995, 0.80 + 0.13 * progress + rnd.gauss(0, 0.03))
        alerts = round(rnd.gauss(720 - 90 * progress, 60) * weekday)
        delivered = max(0, round(rnd.gauss(19 - 6 * progress, 4) * weekday))
        rows.append({
            "date": d.isoformat(), "alerts": alerts, "incidents": inc, "high": high, "closed": closed,
            "false_positive": round(inc * (0.42 - 0.1 * progress)), "mtta_sum": round(mtta * inc), "mttd_sum": round(max(10, rnd.gauss(44 - 13 * progress, 5)) * inc),
            "contain_sum_h": round(contain * closed, 1), "within_sla": min(closed, round(closed * sla_rate)),
            "phish_blocked": round(rnd.gauss(610 - 90 * progress, 50) * weekday), "phish_delivered": delivered,
            "phish_clicked": sum(rnd.random() < 0.08 - 0.02 * progress for _ in range(delivered)),
            "dlp_violations": max(0, round(rnd.gauss(36 - 10 * progress, 6) * weekday)),
            "findings_opened": max(0, round(rnd.gauss(17.5 - 2 * progress, 4) * weekday)),
            "findings_closed": max(0, round(rnd.gauss(18.5 + 1 * progress, 4) * weekday)),
        })
    return rows


def build(live: bool) -> tuple[list[dict], dict]:
    rows = _sample()
    fields = {k: "sample" for k in rows[0] if k != "date"}
    if not live:
        return rows, fields
    try:
        got = {str(r["date"])[:10]: r for r in sentinel.query(DAILY_KQL)}
    except NotConfigured:
        return rows, fields
    except Exception as exc:  # noqa: BLE001
        log.warning("daily Sentinel query failed: %s", exc)
        return rows, fields
    if got:
        for r in rows:
            g = got.get(r["date"], {})
            for f in SENTINEL_FIELDS:
                r[f] = g.get(f, 0) or 0
        fields.update({f: "live" for f in SENTINEL_FIELDS})
    return rows, fields
