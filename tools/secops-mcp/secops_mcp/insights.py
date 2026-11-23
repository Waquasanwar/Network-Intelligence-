"""Period totals, verdicts and the decisions and actions they lead to. Shared by the board deck,
the weekly report and the Claude tools so every channel says the same thing."""

from __future__ import annotations

import datetime as dt


def agg(rows: list[dict]) -> dict:
    t = lambda k: sum(float(r.get(k) or 0) for r in rows)  # noqa: E731
    inc, cl, dl = t("incidents"), t("closed"), t("phish_delivered")
    return {"days": len(rows), "incidents": int(inc), "high": int(t("high")), "alerts": int(t("alerts")),
            "mtta": round(t("mtta_sum") / inc, 1) if inc else None, "contain": round(t("contain_sum_h") / cl, 1) if cl else None,
            "sla": round(100 * t("within_sla") / cl, 1) if cl else None, "missed": int(cl - t("within_sla")),
            "fp": round(100 * t("false_positive") / inc, 1) if inc else None, "blocked": int(t("phish_blocked")),
            "clickrate": round(100 * t("phish_clicked") / dl, 1) if dl else None, "dlp": int(t("dlp_violations")),
            "net": int(t("findings_closed") - t("findings_opened"))}


def period(data: dict, start: dt.date, end: dt.date) -> tuple[dict, dict]:
    n = (end - start).days + 1
    rows = data.get("daily", [])
    pick = lambda a, b: [r for r in rows if a.isoformat() <= r["date"] <= b.isoformat()]  # noqa: E731
    return agg(pick(start, end)), agg(pick(start - dt.timedelta(days=n), start - dt.timedelta(days=1)))


def target(data: dict, label: str, default):
    for o in data.get("outcomes", {}).get("outcomes", []):
        for m in o["measures"]:
            if m["label"] == label and m.get("target") is not None:
                return m["target"]
    return default


MEASURES = [("incidents", "Incidents", "", "lower", None), ("high", "High-severity incidents", "", "lower", None),
            ("mtta", "Average time to acknowledge", " min", "lower", ("Acknowledge an alert", 15)),
            ("contain", "Average time to contain", " h", "lower", ("Median containment", 24)),
            ("sla", "Closed inside the agreed time", "%", "higher", ("Adherence to SOC service levels", 98)),
            ("fp", "Incidents that were false alarms", "%", "lower", None), ("clickrate", "Phishing click rate", "%", "lower", None),
            ("dlp", "Data loss violations", "", "lower", None), ("net", "Findings closed minus opened", "", "higher", ("", 0))]


def verdicts(data: dict, cur: dict, prev: dict) -> list[dict]:
    out = []
    for k, label, unit, better, tgt in MEASURES:
        v, pv = cur.get(k), prev.get(k)
        t = (target(data, tgt[0], tgt[1]) if tgt[0] else tgt[1]) if tgt else None
        if v is None:
            verdict = "No data"
        elif t is not None:
            verdict = "On target" if (v <= t if better == "lower" else v >= t) else "Off target"
        elif pv in (None, 0):
            verdict = ""
        else:
            ch = (v - pv) / abs(pv)
            verdict = "Steady" if abs(ch) < 0.03 else ("Better than before" if (ch < 0 if better == "lower" else ch > 0) else "Worse than before")
        out.append({"key": k, "label": label, "value": v, "previous": pv, "unit": unit, "target": t, "better": better, "verdict": verdict})
    return out


def decisions(data: dict, cur: dict, prev: dict) -> list[dict]:
    acts = []
    t = {v["key"]: v["target"] for v in verdicts(data, cur, prev)}
    owners = sorted(data.get("owners", []), key=lambda r: -r.get("overdue", 0))
    if cur.get("sla") is not None and t.get("sla") is not None and cur["sla"] < t["sla"]:
        acts.append({"decision": True, "title": "Raise the service-level shortfall with the managed SOC provider", "owner": "SOC service owner",
                     "why": f"{cur['sla']}% of incidents closed inside the agreed time against {t['sla']}%; {cur['missed']} missed it."})
    if cur.get("mtta") is not None and cur["mtta"] > (t.get("mtta") or 1e9):
        acts.append({"title": "Review alert routing and out-of-hours cover", "owner": "SOC lead", "why": f"Alerts took {cur['mtta']} minutes to acknowledge against {t['mtta']}."})
    if cur.get("contain") is not None and cur["contain"] > (t.get("contain") or 1e9):
        acts.append({"title": "Review containment playbooks for the slowest incident types", "owner": "Incident response lead", "why": f"Containment averaged {cur['contain']} hours against {t['contain']}."})
    if cur.get("net", 0) < 0 and owners:
        acts.append({"decision": True, "title": f"Agree extra remediation capacity, starting with {owners[0]['team']}", "owner": "Heads of the owning teams",
                     "why": f"{-cur['net']} more findings were opened than closed. {owners[0]['team']} holds {owners[0]['overdue']} overdue findings."})
    if prev.get("high") and cur["high"] > prev["high"] * 1.2 and cur["high"] - prev["high"] >= 3:
        acts.append({"title": "Brief leadership on the rise in high-severity incidents", "owner": "Head of security operations", "why": f"{cur['high']} against {prev['high']} in the period before."})
    if cur.get("clickrate") is not None and prev.get("clickrate") is not None and cur["clickrate"] > prev["clickrate"] + 0.5:
        acts.append({"title": "Run a targeted phishing simulation", "owner": "Security awareness lead", "why": f"Click rate rose to {cur['clickrate']}% from {prev['clickrate']}%."})
    if prev.get("dlp") and cur["dlp"] > prev["dlp"] * 1.1:
        acts.append({"title": "Review the top data loss policies with data owners", "owner": "Data protection lead", "why": f"{cur['dlp']} violations against {prev['dlp']} before."})
    for o in data.get("outcomes", {}).get("outcomes", []):
        for m in o["measures"]:
            if m.get("meets") is False and m["label"] not in ("Acknowledge an alert", "Median containment", "Adherence to SOC service levels"):
                acts.append({"decision": True, "title": f"Close the gap on {m['label'][0].lower() + m['label'][1:]}", "owner": "Programme sponsor",
                             "why": f"{m['now']}{m.get('unit') or ''} against {m['target']}{m.get('unit') or ''} ({o['outcome']})."})
    return sorted(acts, key=lambda a: not a.get("decision"))
