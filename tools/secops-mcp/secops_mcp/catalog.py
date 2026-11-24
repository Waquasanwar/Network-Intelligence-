"""The data catalogue: every system, every data item, how it arrives, and its state right now.

States: live (arriving now), ready (built, connect it to enable), to_build (possible, not built
yet), licence (needs a plan or add-on), check (confirm with the vendor), not_possible.
The catalogue lives in catalog.default.json; put a catalog.json in the data folder to change it.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from . import feeds

HERE = Path(__file__).parent
LABELS = {"live": "Live", "ready": "Ready to connect", "to_build": "To build", "licence": "Needs licence", "check": "To confirm", "not_possible": "Not possible"}


def _load() -> dict:
    custom = Path(os.environ.get("SECOPS_DATA_DIR", HERE.parent / "data")) / "catalog.json"
    return json.loads((custom if custom.exists() else HERE / "catalog.default.json").read_text())


def build(live: bool, answered: dict | None = None) -> dict:
    cat = _load()
    tables = {}
    for s in cat["systems"]:
        tables.update(s.get("tables", {}))
    health = feeds.health(tables, live)
    arriving = {h["table"] for h in health if h["state"] in ("arriving", "late") and h["source"] == "live"}
    answered = answered or {}
    totals = {k: 0 for k in LABELS}
    for s in cat["systems"]:
        sys_live = bool(s.get("connector")) and answered.get(s["connector"]) == "live"
        for it in s["items"]:
            on = it["built"] and (sys_live or any(t in arriving for t in it.get("tables", [])))
            st = ("not_possible" if it["status"] == "no" else "live" if on else "licence" if it["status"] == "licence"
                  else "check" if it["status"] == "check" else "ready" if it["built"] else "to_build")
            it["state"], it["label"] = st, LABELS[st]
            totals[st] += 1
        s["live_items"] = sum(1 for it in s["items"] if it["state"] == "live")
    return {"systems": cat["systems"], "totals": totals, "labels": LABELS, "feeds": health, "mode": "live" if live else "sample"}
