"""Puts each connected system's figures into the dashboard's sections.

One function per system. Each one changes only what its system knows, marks the sections it
filled as "live", and records "current state" figures in the weekly history so trends build
up. A system that is not configured or fails is skipped; the page keeps its previous source.
"""

from __future__ import annotations

import logging
import os
from typing import Callable

from . import history
from .sources import cyberark, defender_cloud, defender_xdr, mimecast, netskope, sentinelone
from .sources.registry import configured

log = logging.getLogger("secops-mcp.live")


def _fill(vals: list, fallback) -> list:
    """Fills weeks with no reading from the nearest known one, so charts never show gaps as zero."""
    known = [v for v in vals if v is not None]
    if not known:
        return [fallback] * len(vals)
    out, last = [], known[0]
    for v in vals:
        last = v if v is not None else last
        out.append(last)
    return out


def _card(data: dict, system: str, value, extracted: str, measure: str | None = None) -> None:
    """Updates a system's headline card and its 12-week line from history."""
    if value is None:
        return
    history.record(f"tool:{system}", value)
    for t in data["tools"]:
        if t["system"] == system:
            weeks = history.last_weeks(12)
            trend = _fill(history.series(f"tool:{system}", weeks), value)
            t.update(value=value, previous=trend[-2] if len(trend) > 1 else value, extracted=extracted)
            if measure:
                t["measure"] = measure
            data.setdefault("trend", {})[system] = trend
            return


def _aligned(by_week: dict, weeks: list[str]) -> list[int]:
    return [int(by_week.get(w, 0)) for w in weeks]


def defender(data: dict, sources: dict, weeks: list[str]) -> None:
    vul, dev = defender_xdr.vulnerabilities(), defender_xdr.devices()
    in_scope = dev["onboarded_by_type"]
    cards = []
    for row in vul["by_asset_type"]:
        n = in_scope.get(row["type"], 0) or row["devices_affected"]
        total = row["critical"] + row["high"]
        history.record(f"asset:{row['type']}", total)
        cards.append({"type": row["type"], "in_scope": n, "critical": row["critical"], "high": row["high"], "overdue": row["overdue"],
                      "avg_age_days": row["avg_age_days"], "patched_pct": round(100 * (1 - row["overdue"] / total)) if total else 100,
                      "trend": _fill(history.series(f"asset:{row['type']}", weeks), total)})
    if cards:
        data["assets"] = cards
        data["top"]["vuln_hosts"] = [{"host": h["host"], "type": h["type"], "team": "", "critical": h["critical"], "high": h["high"],
                                      "oldest_days": h["oldest_days"]} for h in vul["top_hosts"]]
        data["top"]["common"] = [{"title": c["title"], "where": "", "assets": c["assets"], "severity": c["severity"]} for c in vul["common_weaknesses"]]
        sources["assets"] = "live"
    if sources.get("soc") != "live":  # Sentinel not connected: take incidents from Defender XDR instead
        inc = defender_xdr.incidents(len(weeks))["by_week"]
        for row, w in zip(data["weekly"], weeks):
            row["incidents"] = inc.get(w, {}).get("incidents", 0)
        data["soc"]["high"] = [inc.get(w, {}).get("high", 0) for w in weeks]
        data["soc"]["open_incidents"] = [inc.get(w, {}).get("still_open", 0) for w in weeks]
        sources["soc"] = "live"


def defender_for_cloud(data: dict, sources: dict, weeks: list[str]) -> None:
    s = defender_cloud.summary()
    _card(data, "Defender for Cloud", s.get("secure_score"), history.this_week())


def s1(data: dict, sources: dict, weeks: list[str]) -> None:
    s = sentinelone.summary(len(weeks))
    _card(data, "SentinelOne", s["unresolved_threats"], history.this_week())
    data["top"]["alert_hosts"] = [{"host": h["host"], "type": "Endpoint", "alerts": h["threats"], "incidents": 0} for h in s["top_hosts_unresolved"]] or data["top"]["alert_hosts"]
    for t in data["tools"]:
        if t["system"] == "SentinelOne":
            t["scope_unit"], t["in_scope"] = "endpoints", int(os.environ.get("SECOPS_IN_SCOPE_ENDPOINTS", t.get("in_scope") or s["agents_total"]))
            t["coverage_pct"] = min(100, round(100 * s["agents_total"] / t["in_scope"])) if t["in_scope"] else t.get("coverage_pct")
    sources["tools"] = "live"


def ns(data: dict, sources: dict, weeks: list[str]) -> None:
    s = netskope.summary(len(weeks))
    dlp = s["dlp"]
    series = _aligned(dlp["violations_by_week"], weeks)
    data.setdefault("trend", {})["Netskope"] = series
    _card(data, "Netskope", series[-1], history.this_week())
    data["top"]["dlp_types"] = dlp["by_data_type"] or data["top"]["dlp_types"]
    if "risky_apps" in s:
        ra = s["risky_apps"]
        data["top"]["apps"] = [{"name": a["app"], "action": "", "users": a["events"], "upload_gb": round(a["upload_mb"] / 1000, 1), "risk": "High"} for a in ra["apps"]]
        data["top"]["app_users"] = [{"id": u["user"], "dept": "", "apps": 0, "upload_mb": 0, "violations": u["events"]} for u in ra["top_users"]]
        data["top"]["weekly"]["shadow_apps"][-1] = ra["unapproved_apps_in_use"]
    sources["top"] = "live"


def ca(data: dict, sources: dict, weeks: list[str]) -> None:
    s = cyberark.summary()
    value = s["discovered_not_onboarded"] if s["discovered_not_onboarded"] is not None else s["not_automatically_managed"]
    _card(data, "CyberArk", value, history.this_week())


def mc(data: dict, sources: dict, weeks: list[str]) -> None:
    t = mimecast.threat_summary(len(weeks))
    blocked = [a + b + c for a, b, c in zip(_aligned(t["malicious_url_blocked"], weeks), _aligned(t["attachments_blocked"], weeks),
                                            _aligned(t["impersonation_hits"], weeks))]
    clicked = _aligned(t["malicious_url_clicked"], weeks)
    _card(data, "Mimecast", clicked[-1], weeks[-1], "Malicious links clicked")
    data["mail"]["phish_blocked"] = blocked
    for row, c in zip(data["weekly"], clicked):
        row["phish_clicked"] = c
    sources["mail"] = "live"


MAPPERS: list[tuple[str, Callable]] = [
    ("Microsoft Defender XDR", defender), ("Microsoft Defender for Cloud", defender_for_cloud), ("SentinelOne", s1),
    ("Netskope", ns), ("CyberArk", ca), ("Mimecast", mc),
]


def apply_all(data: dict, sources: dict) -> dict:
    weeks = history.last_weeks(len(data["weekly"]))
    for row, w in zip(data["weekly"], weeks):
        row["week_ending"] = w
    status = {}
    if sources.get("soc") == "live":
        _card(data, "Microsoft Sentinel", data["weekly"][-1]["incidents"], weeks[-1])
    for name, fn in MAPPERS:
        if not configured(name):
            status[name] = "not_configured"
            continue
        try:
            fn(data, sources, weeks)
            status[name] = "live"
        except Exception as exc:  # noqa: BLE001 - one system failing must not blank the page
            log.exception("%s failed", name)
            status[name] = f"error: {type(exc).__name__}"
    return status
