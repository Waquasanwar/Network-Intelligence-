"""Microsoft Sentinel, through the Log Analytics query API.

Needs a service principal with the "Microsoft Sentinel Reader" role (or "Log Analytics
Reader") on the one workspace. Every query below is fixed; callers cannot send their own.

Notes on the measures:
- Time to detect = incident CreatedTime minus FirstActivityTime.
- Time to acknowledge = FirstModifiedTime minus CreatedTime (first analyst touch).
- Sentinel severities stop at High. The dashboard's "critical" count needs the SOC's own
  rule (for example a "Critical" incident tag); until then High is reported as the top tier.
- Sentinel has no native "contained" timestamp. Time to contain uses ClosedTime as a
  stand-in until the SOC records containment (for example as an incident tag or a
  custom field written by a playbook). Replace the expression once that exists.
"""

from __future__ import annotations

import httpx

from .base import TIMEOUT, TokenCache, entra_token, env

_tokens = TokenCache()
SCOPE = "https://api.loganalytics.io/.default"

SOC_WEEKLY_KQL = """
let weeks = {weeks};
SecurityIncident
| where CreatedTime > ago(weeks * 7d)
| summarize arg_max(TimeGenerated, *) by IncidentNumber
| extend week_ending = startofweek(CreatedTime) + 6d
| summarize
    incidents = count(),
    high = countif(Severity == "High"),
    medium = countif(Severity == "Medium"),
    low_info = countif(Severity in ("Low", "Informational")),
    false_positive_pct = round(100.0 * countif(Classification == "FalsePositive") / count(), 1),
    mttd_minutes = round(avg(datetime_diff("minute", CreatedTime, FirstActivityTime)), 0),
    mtta_minutes = round(avg(datetime_diff("minute", FirstModifiedTime, CreatedTime)), 0),
    contain_hours = round(avg(datetime_diff("minute", ClosedTime, CreatedTime)) / 60.0, 1),
    still_open = countif(Status != "Closed")
  by week_ending
| order by week_ending asc
"""

ALERTS_WEEKLY_KQL = """
let weeks = {weeks};
SecurityAlert
| where TimeGenerated > ago(weeks * 7d)
| summarize arg_max(TimeGenerated, *) by SystemAlertId
| extend week_ending = startofweek(TimeGenerated) + 6d
| summarize alerts = count(), by_product = make_bag(bag_pack(ProductName, 1)) by week_ending
| order by week_ending asc
"""

TOP_ALERT_HOSTS_KQL = """
SecurityAlert
| where TimeGenerated > ago(7d)
| mv-expand entity = todynamic(Entities)
| where entity.Type == "host"
| extend host = tostring(coalesce(entity.HostName, entity.NetBiosName))
| summarize alerts = dcount(SystemAlertId) by host
| top {limit} by alerts
"""

NOISY_RULES_KQL = """
SecurityIncident
| where CreatedTime > ago(7d)
| summarize arg_max(TimeGenerated, *) by IncidentNumber
| mv-expand rule_id = RelatedAnalyticRuleIds
| summarize incidents = count(), false_pct = round(100.0 * countif(Classification == "FalsePositive") / count(), 0)
    by rule = tostring(Title)
| top {limit} by incidents
"""

RISKY_SIGNINS_KQL = """
SigninLogs
| where TimeGenerated > ago({weeks} * 7d)
| extend week_ending = startofweek(TimeGenerated) + 6d
| summarize
    risky_signins = countif(RiskLevelDuringSignIn in ("medium", "high")),
    mfa_failures = countif(ResultType == "500121")
  by week_ending
| order by week_ending asc
"""


def query(kql: str) -> list[dict]:
    cfg = env("SENTINEL_WORKSPACE_ID")
    token = entra_token(_tokens, SCOPE)
    resp = httpx.post(
        f"https://api.loganalytics.io/v1/workspaces/{cfg['SENTINEL_WORKSPACE_ID']}/query",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": kql},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    table = resp.json()["tables"][0]
    cols = [c["name"] for c in table["columns"]]
    return [dict(zip(cols, row)) for row in table["rows"]]


def soc_weekly(weeks: int) -> dict:
    return {
        "incidents": query(SOC_WEEKLY_KQL.format(weeks=weeks)),
        "alerts": query(ALERTS_WEEKLY_KQL.format(weeks=weeks)),
    }


def top_alert_hosts(limit: int) -> list[dict]:
    return query(TOP_ALERT_HOSTS_KQL.format(limit=limit))


def noisy_rules(limit: int) -> list[dict]:
    return query(NOISY_RULES_KQL.format(limit=limit))


def signin_risk(weeks: int) -> list[dict]:
    return query(RISKY_SIGNINS_KQL.format(weeks=weeks))
