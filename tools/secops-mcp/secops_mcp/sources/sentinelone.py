"""SentinelOne (EDR), through the Management API v2.1.

Create a service user in the console with the Viewer role on the sites in scope and give it an
API token (tokens expire; rotate before expiry). Base URL is your console, for example
https://yourco.sentinelone.net. Header: "Authorization: ApiToken <token>".

Field and filter names follow SentinelOne's public API reference; check them against the API
documentation in your console (Help > API Doc) on first run.
"""

from __future__ import annotations

import datetime as dt
from collections import Counter

from .base import asset_type, client, env, week_ending

API = "/web/api/v2.1"


def _get(path: str, **params) -> dict:
    cfg = env("S1_CONSOLE_URL", "S1_API_TOKEN")
    with client() as c:
        resp = c.get(cfg["S1_CONSOLE_URL"].rstrip("/") + API + path, params=params,
                     headers={"Authorization": f"ApiToken {cfg['S1_API_TOKEN']}"})
    resp.raise_for_status()
    return resp.json()


def _count(path: str, **params) -> int:
    return int(_get(path, countOnly="true", **params).get("pagination", {}).get("totalItems", 0))


def _pages(path: str, limit: int = 2000, **params):
    cursor, seen = None, 0
    while seen < limit:
        body = _get(path, limit=min(1000, limit - seen), **({"cursor": cursor} if cursor else {}), **params)
        rows = body.get("data", [])
        yield from rows
        seen += len(rows)
        cursor = body.get("pagination", {}).get("nextCursor")
        if not cursor or not rows:
            return


def summary(weeks: int = 12) -> dict:
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(weeks=weeks)).strftime("%Y-%m-%dT%H:%M:%S.000000Z")
    by_week, by_host = Counter(), Counter()
    for t in _pages("/threats", createdAt__gte=since):
        info = t.get("threatInfo", {})
        by_week[week_ending(info.get("createdAt") or t.get("createdAt"))] += 1
        if info.get("resolved") is False or info.get("incidentStatus") in ("unresolved", "in_progress"):
            by_host[(t.get("agentRealtimeInfo") or {}).get("agentComputerName", "unknown")] += 1
    agents_by_type = {}
    for mt in ("server", "desktop", "laptop"):
        agents_by_type[asset_type(None, mt)] = agents_by_type.get(asset_type(None, mt), 0) + _count("/agents", machineTypes=mt)
    return {
        "unresolved_threats": _count("/threats", resolved="false"),
        "threats_by_week": dict(sorted(by_week.items())),
        "top_hosts_unresolved": [{"host": h, "threats": n} for h, n in by_host.most_common(10)],
        "agents_total": _count("/agents"),
        "agents_infected": _count("/agents", infected="true"),
        "agents_out_of_date": _count("/agents", isUpToDate="false"),
        "agents_by_type": agents_by_type,
    }
