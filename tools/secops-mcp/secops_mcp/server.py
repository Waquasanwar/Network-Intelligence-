"""SecOps metrics MCP server.

Serves the aggregated, weekly figures behind the Security Operations Dashboard as a fixed
set of read-only tools. Two modes:

  SECOPS_MODE=sample  (default) answers from sample_data.json, so the dashboard and any
                      MCP client can be wired up before a single credential exists.
  SECOPS_MODE=live    calls each configured source. A source with no credentials answers
                      {"status": "not_configured"} instead of failing the whole tool.

Design rules, deliberately kept:
- Read-only. No tool changes anything in any system.
- Fixed queries. No tool accepts free-form KQL, GraphQL or URLs.
- Counts out, detail stays. Tools return totals, trends and ranked identifiers, never raw
  alerts, email content or credentials.
- Most vendor APIs return current state only. Each live call is written to a weekly
  snapshot file so that 12-week trends build up over time.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import os
from pathlib import Path
from typing import Any, Callable, Literal

from mcp.server.fastmcp import FastMCP

from .auth import from_env
from .sources import cyberark, defender_cloud, defender_xdr, entra, gitlab, mimecast, netskope, sentinel, sentinelone
from .sources.registry import check_all
from .sources.base import NotConfigured
from .sources.vendor_mcp import pointer

MODE = os.environ.get("SECOPS_MODE", "sample").lower()
HERE = Path(__file__).parent
SNAPSHOTS = Path(os.environ.get("SECOPS_SNAPSHOT_DIR", HERE / "snapshots"))
SAMPLE = json.loads((HERE / "sample_data.json").read_text())

log = logging.getLogger("secops-mcp")
_verifier, _auth = from_env()
mcp = FastMCP("secops-metrics", token_verifier=_verifier, auth=_auth)


def _call(name: str, fn: Callable[[], Any]) -> Any:
    """Run one source, turning missing credentials or errors into a status the caller can show."""
    try:
        return {"status": "ok", "data": fn()}
    except NotConfigured as exc:
        return {"status": "not_configured", "detail": str(exc)}
    except Exception as exc:  # noqa: BLE001 - surface the failure to the client, keep other sources working
        log.exception("source %s failed", name)
        return {"status": "error", "detail": f"{type(exc).__name__}: {exc}"}


def _snapshot(tool: str, payload: dict) -> None:
    week = (dt.date.today() + dt.timedelta(days=6 - dt.date.today().weekday())).isoformat()
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    (SNAPSHOTS / f"{week}_{tool}.json").write_text(json.dumps(payload, default=str, indent=1))


def _sample(payload: dict) -> dict:
    return {"mode": "sample", "note": SAMPLE["_note"], **payload}


@mcp.tool()
def soc_weekly(weeks: int = 12) -> dict:
    """Weekly SOC figures: alerts, incidents by severity, time to detect, acknowledge and
    contain, false-alarm rate and incidents still open. Source: Microsoft Sentinel."""
    weeks = max(1, min(weeks, 52))
    if MODE != "live":
        soc, weekly = SAMPLE["soc"], SAMPLE["weekly"][-weeks:]
        return _sample({"weeks": [w["week_ending"] for w in weekly], "incidents": [w["incidents"] for w in weekly],
                        "mttd_minutes": [w["mttd_minutes"] for w in weekly], **{k: v[-weeks:] if isinstance(v, list) else v for k, v in soc.items()
                        if k not in ("categories", "queue", "attack")}})
    out = {"mode": "live", "sentinel": _call("sentinel", lambda: sentinel.soc_weekly(weeks))}
    _snapshot("soc_weekly", out)
    return out


@mcp.tool()
def vulnerability_summary() -> dict:
    """Open critical and high findings by scanner, with Defender for Cloud secure score.
    Sources: Defender for Cloud, GitLab; SentinelOne and Orca through their own MCP servers."""
    if MODE != "live":
        return _sample({"by_scanner": SAMPLE["vulns"], "by_asset_type": SAMPLE["assets"]})
    out = {
        "mode": "live",
        "defender_for_cloud": _call("defender", defender_cloud.summary),
        "gitlab": _call("gitlab", gitlab.summary),
        "defender_for_endpoint": _call("defender_xdr", defender_xdr.vulnerabilities),
        "sentinelone": _call("sentinelone", sentinelone.summary),
        "orca": pointer("Orca"),
    }
    _snapshot("vulnerability_summary", out)
    return out


@mcp.tool()
def remediation_weekly(weeks: int = 12) -> dict:
    """Findings opened and closed, share fixed inside the agreed time and days to fix a
    critical, by week and by owning team. Built from the weekly snapshot files."""
    weeks = max(1, min(weeks, 52))
    if MODE != "live":
        keys = ("week_ending", "open_critical", "open_high", "opened", "closed", "sla_pct", "sla_target", "mttr_critical_days")
        return _sample({"weekly": [{k: w[k] for k in keys} for w in SAMPLE["weekly"][-weeks:]], "by_team": SAMPLE["owners"]})
    files = sorted(SNAPSHOTS.glob("*_vulnerability_summary.json"))[-weeks:]
    return {"mode": "live", "snapshots": [{"file": f.name, **json.loads(f.read_text())} for f in files],
            "note": "Opened, closed and in-time figures need each finding's first-seen and closed dates; add them once the scanner feeds are confirmed."}


@mcp.tool()
def phishing_summary() -> dict:
    """Phishing blocked, delivered, reported, clicked and credentials entered, plus simulated
    phishing campaign results. Source: Mimecast API 2.0."""
    if MODE != "live":
        m, w = SAMPLE["mail"], SAMPLE["weekly"]
        return _sample({"blocked": m["phish_blocked"], "delivered": [x["phish_delivered"] for x in w], "clicked": [x["phish_clicked"] for x in w],
                        "reported": m["reported_by_users"], "credentials_entered": m["credentials_entered"], "simulation": m["simulation"]})
    out = {"mode": "live", "threats": _call("mimecast", mimecast.threat_summary),
           "simulation_campaigns": _call("mimecast", mimecast.simulation_campaigns)}
    _snapshot("phishing_summary", out)
    return out


@mcp.tool()
def user_and_app_risk(weeks: int = 12) -> dict:
    """Risky sign-ins and failed second-factor checks (Entra ID through Sentinel), data loss
    violations and unapproved apps (Netskope), unvaulted privileged accounts (CyberArk)."""
    if MODE != "live":
        return _sample({"weekly": SAMPLE["top"]["weekly"], "dlp_types": SAMPLE["top"]["dlp_types"]})
    return {"mode": "live", "signins": _call("sentinel", lambda: sentinel.signin_risk(weeks)),
            "netskope": _call("netskope", lambda: netskope.summary(weeks)), "cyberark": _call("cyberark", cyberark.summary),
            "entra_risky_users": _call("entra", entra.risky_users)}


@mcp.tool()
def coverage() -> dict:
    """For each system, how much of the estate it can see: in scope, covered, and when its
    data was last refreshed."""
    if MODE != "live":
        return _sample({"systems": [{k: t.get(k) for k in ("system", "coverage_pct", "in_scope", "scope_unit", "extracted")} for t in SAMPLE["tools"]]})
    return {"mode": "live", "defender_for_cloud": _call("defender", lambda: defender_cloud.summary()["coverage"]),
            "note": "Other systems report coverage through their own consoles; add each as its feed is confirmed."}


TopList = Literal["alert_hosts", "noisy_rules", "vuln_hosts", "common_weaknesses", "phishing_targets",
                  "repeat_clickers", "risky_app_users", "risky_apps", "privileged_users"]
_SAMPLE_LISTS = {"alert_hosts": "alert_hosts", "noisy_rules": "rules", "vuln_hosts": "vuln_hosts", "common_weaknesses": "common",
                 "phishing_targets": "targets", "repeat_clickers": "repeat_clickers", "risky_app_users": "app_users",
                 "risky_apps": "apps", "privileged_users": "priv_users"}


@mcp.tool()
def top_list(name: TopList, limit: int = 10) -> dict:
    """Ranked lists for the SOC: hosts raising the most alerts, noisiest detection rules,
    most exposed hosts, most targeted people, repeat clickers, risky app users and more.
    People are returned as identifiers, not names."""
    limit = max(1, min(limit, 50))
    if MODE != "live":
        return _sample({"list": name, "rows": SAMPLE["top"][_SAMPLE_LISTS[name]][:limit]})
    live = {"alert_hosts": lambda: sentinel.top_alert_hosts(limit), "noisy_rules": lambda: sentinel.noisy_rules(limit)}
    if name in live:
        return {"mode": "live", "list": name, **_call("sentinel", live[name])}
    return {"mode": "live", "list": name, "status": "not_implemented",
            "detail": "This list comes from a source served by its vendor's MCP server or not yet wired; see the README."}


@mcp.tool()
def risk_domain(name: str) -> dict:
    """One SIEM-fed risk page: "cloud", "devsecops", "sap" or any page added in domains.json.
    Returns its weekly measures, breakdowns, ranked lists, and whether each is live or sample."""
    from .dashboard_data import cached
    pages = {d["id"]: d for d in cached().get("domains", [])}
    return pages.get(name) or {"status": "unknown_page", "available": sorted(pages)}


@mcp.tool()
def outcomes() -> dict:
    """Programme outcomes (SOC, SIEM and SOAR Phase 2) against their targets: each measure's
    target, value now, whether it meets the target, declared status and evidence."""
    from .dashboard_data import cached
    return cached().get("outcomes", {})


@mcp.tool()
def period_summary(start: str, end: str) -> dict:
    """Totals and averages for any period (dates as YYYY-MM-DD), against the period of the
    same length just before: incidents, high-severity incidents, time to acknowledge and to
    contain, share closed inside the agreed time, false alarms, phishing and data loss."""
    import datetime as dt

    from .dashboard_data import cached

    data = cached()
    rows = data.get("daily", [])
    try:
        s, e = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    except ValueError:
        return {"status": "invalid_dates", "detail": "Use YYYY-MM-DD for start and end."}
    if s > e or (e - s).days > 731:
        return {"status": "invalid_range", "detail": "Start must be on or before end, within two years."}
    n = (e - s).days + 1
    ps, pe = s - dt.timedelta(days=n), s - dt.timedelta(days=1)

    def agg(a: dt.date, b: dt.date) -> dict:
        sel = [r for r in rows if a.isoformat() <= r["date"] <= b.isoformat()]
        tot = lambda k: sum(float(r.get(k) or 0) for r in sel)  # noqa: E731
        inc, cl, dl = tot("incidents"), tot("closed"), tot("phish_delivered")
        return {"days_with_data": len(sel), "incidents": int(inc), "high_severity": int(tot("high")), "alerts": int(tot("alerts")),
                "avg_minutes_to_acknowledge": round(tot("mtta_sum") / inc, 1) if inc else None,
                "avg_hours_to_contain": round(tot("contain_sum_h") / cl, 1) if cl else None,
                "closed_inside_agreed_time_pct": round(100 * tot("within_sla") / cl, 1) if cl else None,
                "false_alarm_pct": round(100 * tot("false_positive") / inc, 1) if inc else None,
                "phishing_blocked": int(tot("phish_blocked")), "phishing_click_rate_pct": round(100 * tot("phish_clicked") / dl, 1) if dl else None,
                "data_loss_violations": int(tot("dlp_violations")), "findings_closed_minus_opened": int(tot("findings_closed") - tot("findings_opened"))}

    return {"period": {"start": s.isoformat(), "end": e.isoformat(), **agg(s, e)},
            "period_before": {"start": ps.isoformat(), "end": pe.isoformat(), **agg(ps, pe)},
            "sources": data.get("daily_sources", {})}


@mcp.tool()
def live_operations() -> dict:
    """Incidents in flight right now with their service-level clocks (acknowledge and resolve
    deadlines), the alert rate over the last 24 hours, and when each source last sent data."""
    from . import liveboard
    return liveboard.build(MODE == "live")


@mcp.tool()
def threat_paths(near_misses_only: bool = False) -> dict:
    """Attack paths through the MITRE ATT&CK stages over the last 90 days, where each was
    stopped, and near misses: real attacks that got deep into the chain before being stopped."""
    from . import threats
    t = threats.build(MODE == "live")
    if near_misses_only:
        t["paths"] = [p for p in t["paths"] if p["near_miss"]]
    return t


@mcp.tool()
def workflow_status() -> dict:
    """Automations: what each workflow watches, who it alerts or raises tickets for, actions
    waiting for approval, and the log of what was sent (or would have been, in dry-run mode).
    Approving is done on the dashboard's Workflows page, by a signed-in person."""
    from . import workflows
    return workflows.overview()


@mcp.tool()
def decisions_and_actions(days: int = 30) -> dict:
    """For the last N days: every measure against the period before and its target, and the
    decisions and actions that follow, each with an owner."""
    import datetime as dt

    from . import insights
    from .dashboard_data import cached
    data = cached()
    end = dt.date.fromisoformat(data["daily"][-1]["date"])
    start = end - dt.timedelta(days=max(1, min(days, 730)) - 1)
    cur, prev = insights.period(data, start, end)
    return {"start": start.isoformat(), "end": end.isoformat(), "measures": insights.verdicts(data, cur, prev),
            "decisions_and_actions": insights.decisions(data, cur, prev)}


@mcp.tool()
def data_catalog(state: str = "") -> dict:
    """What each source system can provide and the state of every data item: live, ready to
    connect, to build, needs licence, to confirm, or not possible; plus which Sentinel feeds are
    arriving, late or silent. Pass state (for example "licence") to list only those items."""
    from .catalog import build

    cat = build(os.environ.get("SECOPS_MODE", "sample").lower() == "live")
    if state:
        return {"items": [{"system": s["name"], **i} for s in cat["systems"] for i in s["items"] if i["state"] == state], "totals": cat["totals"]}
    return cat


@mcp.tool()
def connection_check() -> dict:
    """Which source systems are connected, not configured, or failing, with a hint for each failure."""
    return check_all()


@mcp.tool()
def dashboard_data() -> dict:
    """Everything the Security Operations Dashboard draws, in one document: every section,
    which source filled it (live, export or sample) and any added measures. A Claude
    artifact can call this once and render the whole dashboard."""
    from .dashboard_data import cached
    return cached()


def main() -> None:
    logging.basicConfig(level=os.environ.get("SECOPS_LOG_LEVEL", "INFO"))
    transport = os.environ.get("SECOPS_TRANSPORT", "stdio")
    mcp.run(transport="streamable-http" if transport == "http" else "stdio")


if __name__ == "__main__":
    main()
