"""Workflow engine: watches the figures, decides who needs to know, and alerts or raises tickets.

Each refresh, every workflow's trigger is checked. A trigger that fires produces one proposed
action per item (an incident, a near miss, a team), de-duplicated and held back for the
workflow's cool-down. Workflows in "auto" mode run straight away (notifications only, by
convention); "approve" workflows wait on the Workflows page for someone to approve or dismiss.
Nothing leaves the system unless SECOPS_ACTIONS_ENABLED=true; otherwise each run is recorded as a
dry run showing exactly what would have been sent and where.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import os
import threading
import uuid
from pathlib import Path

from .ops import config
from .sources import actions as out

log = logging.getLogger("secops-mcp.workflows")
_lock = threading.Lock()


class _Safe(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def _store() -> Path:
    folder = Path(os.environ.get("SECOPS_SNAPSHOT_DIR", Path(__file__).parent / "snapshots"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "actions.json"


def _load() -> list[dict]:
    f = _store()
    return json.loads(f.read_text()) if f.exists() else []


def _save(items: list[dict]) -> None:
    _store().write_text(json.dumps(items[-500:], indent=1))


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _parse(t: str | None) -> dt.datetime | None:
    return dt.datetime.fromisoformat(t.replace("Z", "+00:00")) if t else None


def _dur(minutes: float) -> str:
    m = int(abs(minutes))
    return f"{m // 60} h {m % 60} min" if m >= 60 else f"{m} min"


def _stage(p) -> str:
    return (p or ["an early stage"])[-1]


def events(data: dict, live: dict, threats: dict) -> dict[str, list[dict]]:
    """Everything each trigger can fire on, as items with the fields its messages use."""
    now, sla = _now(), live["sla"]
    ack = sla["acknowledge_minutes"]
    ev: dict[str, list[dict]] = {k: [] for k in ("live.ack_at_risk", "live.resolve_breached", "live.new_high", "threats.near_miss",
                                                 "vuln.team_overdue", "mail.click_rate_up", "schedule.weekly")}
    for i in live["queue"]:
        age = (now - _parse(i["created"])).total_seconds() / 60
        base = {"key": i["id"], "id": i["id"], "title": i["title"], "severity": i["severity"], "source": i["source"], "stage": _stage(i.get("path")), "ack_minutes": ack}
        if not i.get("acknowledged") and age >= ack * sla["at_risk_share"]:
            ev["live.ack_at_risk"].append(base | {"ack_left": "now" if age >= ack else _dur(ack - age)})
        limit = sla["resolve_hours"].get(i["severity"], 72) * 60
        if i["status"] != "Contained" and age > limit:
            ev["live.resolve_breached"].append(base | {"overdue": _dur(age - limit)})
        if i["severity"] == "High" and age <= 60:
            ev["live.new_high"].append(base)
    for p in threats["paths"]:
        if p["near_miss"] and (now - _parse(p["created"])).days <= 7:
            ev["threats.near_miss"].append({"key": p["id"], "id": p["id"], "title": p["title"], "stage": _stage(p["path"]), "stopped_by": p.get("stopped_by", "the SOC")})
    for t in data.get("owners", []):
        if t.get("overdue", 0) >= int(os.environ.get("SECOPS_OVERDUE_ALERT", "15")):
            ev["vuln.team_overdue"].append({"key": t["team"], "team": t["team"], "overdue": t["overdue"]})
    w = data.get("weekly", [])
    if len(w) >= 2 and w[-1].get("phish_delivered") and w[-2].get("phish_delivered"):
        r1, r0 = 100 * w[-1]["phish_clicked"] / w[-1]["phish_delivered"], 100 * w[-2]["phish_clicked"] / w[-2]["phish_delivered"]
        if r1 > r0 + 0.5:
            sim = data.get("mail", {}).get("simulation", {})
            deps = ", ".join(d["name"] for d in sim.get("departments", []) if d["click_pct"] > sim.get("target_pct", 100)) or "none"
            ev["mail.click_rate_up"].append({"key": w[-1]["week_ending"], "rate": round(r1, 1), "previous": round(r0, 1), "departments": deps})
    if now.weekday() == 0 and now.hour >= 7:
        ev["schedule.weekly"].append({"key": now.date().isoformat(), "report_url": os.environ.get("SECOPS_PUBLIC_BASE", "") + "/#reports"})
    return ev


def _render(wf: dict, item: dict, teams: dict) -> list[dict]:
    rendered = []
    for a in wf["actions"]:
        f = _Safe(item)
        team = teams.get(a.get("team", ""), {})
        r = {"type": a["type"], "team": a.get("team"), "summary": a.get("summary", wf["name"]).format_map(f),
             "text": (a.get("text") or a.get("detail") or "").format_map(f)}
        if a["type"] == "teams":
            r["target"] = team.get("teams_webhook_env")
        elif a["type"] == "servicenow":
            r["target"], r["priority"] = team.get("servicenow_group"), a.get("priority", "2")
        elif a["type"] == "jira":
            r["target"] = team.get("jira_project")
        elif a["type"] == "email":
            r["target"] = team.get("email_env")
        rendered.append(r)
    return rendered


def _send(a: dict) -> dict:
    if not a.get("target"):
        return {"ok": False, "detail": f"No {a['type']} route set for team {a.get('team')} in ops.json"}
    try:
        if a["type"] == "teams":
            res = out.teams(a["target"], a["summary"], a["text"], os.environ.get("SECOPS_PUBLIC_BASE") or None)
        elif a["type"] == "servicenow":
            res = out.servicenow(a["target"], a["summary"], a["text"], a.get("priority", "2"))
        elif a["type"] == "jira":
            res = out.jira(a["target"], a["summary"], a["text"])
        elif a["type"] == "email":
            res = out.email(a["target"], a["summary"], a["text"])
        else:
            res = out.webhook(a["target"], a)
        return {"ok": True, **res}
    except Exception as exc:  # noqa: BLE001
        log.warning("action %s failed: %s", a["type"], exc)
        return {"ok": False, "detail": f"{type(exc).__name__}: {str(exc)[:200]}"}


def _execute(rec: dict, by: str) -> dict:
    enabled = os.environ.get("SECOPS_ACTIONS_ENABLED", "false").lower() == "true"
    rec["results"] = [_send(a) if enabled else {"ok": True, "dry_run": True} for a in rec["actions"]]
    rec["status"] = "dry run" if not enabled else ("sent" if all(r["ok"] for r in rec["results"]) else "failed")
    rec["done_at"], rec["done_by"] = _now().isoformat(), by
    return rec


def evaluate(data: dict, live: dict, threats: dict) -> list[dict]:
    """Checks every workflow, records new proposals, runs the automatic ones. Returns the log."""
    cfg = config()
    ev = events(data, live, threats)
    now = _now()
    with _lock:
        items = _load()
        for wf in cfg["workflows"]:
            if wf.get("enabled") is False:
                continue
            for item in ev.get(wf["trigger"], []):
                key = f"{wf['id']}:{item['key']}"
                recent = [r for r in items if r["key"] == key and now - _parse(r["created"]) < dt.timedelta(minutes=wf.get("cooldown_minutes", 60))]
                if recent:
                    continue
                rec = {"uid": uuid.uuid4().hex[:12], "key": key, "workflow": wf["id"], "name": wf["name"], "mode": wf["mode"],
                       "created": now.isoformat(), "status": "waiting for approval", "actions": _render(wf, item, cfg["teams"])}
                if wf["mode"] == "auto":
                    _execute(rec, "automatic")
                items.append(rec)
        _save(items)
        return items


def decide(uid: str, approve: bool, by: str) -> dict | None:
    with _lock:
        items = _load()
        for rec in items:
            if rec["uid"] == uid and rec["status"] == "waiting for approval":
                if approve:
                    _execute(rec, by)
                else:
                    rec.update(status="dismissed", done_at=_now().isoformat(), done_by=by)
                _save(items)
                return rec
    return None


def overview() -> dict:
    cfg = config()
    return {"workflows": [{k: w.get(k) for k in ("id", "name", "trigger", "mode", "schedule", "cooldown_minutes")} | {"actions": [a["type"] + " → " + a.get("team", "") for a in w["actions"]]}
                          for w in cfg["workflows"]],
            "teams": cfg["teams"], "log": list(reversed(_load()[-100:])),
            "actions_enabled": os.environ.get("SECOPS_ACTIONS_ENABLED", "false").lower() == "true"}
