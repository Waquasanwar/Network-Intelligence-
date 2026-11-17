"""Netskope (web, SaaS and data loss), through REST API v2.

Create a token under Settings > Tools > REST API v2 with READ on only these endpoints:
  /api/v2/events/dataexport/alerts/dlp
  /api/v2/events/dataexport/events/application   (only if you want risky-app figures)
Header: "Netskope-Api-Token: <token>". Base URL is your tenant, for example
https://yourco.goskope.com.

The dataexport endpoints are iterators: the first call starts from a time, later calls ask
for "next" with the same index name. This adapter keeps its own index name so it does not
disturb other consumers such as a SIEM feed. Check field names against your tenant's
REST API v2 reference on first run.
"""

from __future__ import annotations

import datetime as dt
import time
from collections import Counter

from .base import client, env, env_or, week_ending

INDEX = "secops_dashboard"


def _iterate(path: str, weeks: int, cap: int = 200000):
    cfg = env("NETSKOPE_URL", "NETSKOPE_API_TOKEN")
    url = cfg["NETSKOPE_URL"].rstrip("/") + path
    headers = {"Netskope-Api-Token": cfg["NETSKOPE_API_TOKEN"]}
    op, seen = str(int(time.time() - weeks * 7 * 86400)), 0
    with client() as c:
        while seen < cap:
            resp = c.get(url, params={"index": env_or("NETSKOPE_INDEX", INDEX), "operation": op}, headers=headers)
            resp.raise_for_status()
            body = resp.json()
            rows = body.get("result", [])
            yield from rows
            seen += len(rows)
            if not rows or body.get("wait_time"):
                return
            op = "next"


def dlp(weeks: int = 12) -> dict:
    by_week, by_profile, by_user = Counter(), Counter(), Counter()
    for a in _iterate("/api/v2/events/dataexport/alerts/dlp", weeks):
        by_week[week_ending(int(a.get("timestamp", 0)))] += 1
        by_profile[a.get("dlp_profile") or a.get("dlp_rule") or "Unknown"] += 1
        by_user[a.get("user") or a.get("ur_normalized") or "unknown"] += 1
    return {"violations_by_week": dict(sorted(by_week.items())), "by_data_type": [{"name": k, "count": v} for k, v in by_profile.most_common(8)],
            "top_users": [{"user": k, "violations": v} for k, v in by_user.most_common(10)]}


def risky_apps(weeks: int = 1) -> dict:
    """Use of apps rated poor or low in the Cloud Confidence Index, with upload volume."""
    apps, users, upload = Counter(), Counter(), Counter()
    for e in _iterate("/api/v2/events/dataexport/events/application", weeks):
        if str(e.get("ccl", "")).lower() not in ("poor", "low"):
            continue
        app, user = e.get("app", "unknown"), e.get("user", "unknown")
        apps[app] += 1
        users[user] += 1
        if str(e.get("activity", "")).lower() == "upload":
            upload[app] += int(e.get("file_size") or 0)
    return {"apps": [{"app": k, "events": v, "upload_mb": round(upload[k] / 1e6, 1)} for k, v in apps.most_common(10)],
            "top_users": [{"user": k, "events": v} for k, v in users.most_common(10)], "unapproved_apps_in_use": len(apps)}


def summary(weeks: int = 12) -> dict:
    out = {"dlp": dlp(weeks)}
    if env_or("NETSKOPE_APP_EVENTS", "false").lower() == "true":
        out["risky_apps"] = risky_apps(1)
    return out
