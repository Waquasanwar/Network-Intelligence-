"""Risk pages that are fed entirely from Sentinel: cloud, DevSecOps, SAP and any you add.

Each page is a "domain" in domains.json (defaults in domains.default.json). Every figure on it
is a Sentinel query, so when a new feed lands in the SIEM the page fills without code changes.
Until a query returns data, its sample values are shown and the page says so.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from . import history
from .sources import sentinel
from .sources.base import NotConfigured

log = logging.getLogger("secops-mcp.domains")
HERE = Path(__file__).parent


def config(folder: Path) -> list[dict]:
    path = Path(os.environ.get("SECOPS_DOMAINS_FILE", folder / "domains.json"))
    if not path.exists():
        path = HERE / "domains.default.json"
    return json.loads(path.read_text())["domains"]


def _run(query: str, weeks: int) -> list[dict]:
    return sentinel.query(query.replace("{weeks}", str(weeks)))


def build(folder: Path, live: bool, n_weeks: int = 12) -> tuple[list[dict], dict]:
    weeks = history.last_weeks(n_weeks)
    out, status = [], {}
    for d in config(folder):
        page = {k: d[k] for k in ("id", "title", "nav", "status", "better", "icon", "intro", "needs") if k in d}
        page["will_show"] = d.get("will_show", [])
        page["measures"], page["breakdowns"], page["ranked"] = [], [], []
        sources = []

        def attempt(panel: dict, shape):
            if not (live and page["status"] == "live"):
                return panel.get("sample"), "sample"
            try:
                rows = _run(panel["query"], n_weeks)
                return (shape(rows), "live") if rows else (panel.get("sample"), "sample")
            except NotConfigured:
                return panel.get("sample"), "sample"
            except Exception as exc:  # noqa: BLE001 - keep the page up, report the panel
                log.warning("domain %s panel %s failed: %s", d["id"], panel["id"], exc)
                return panel.get("sample"), f"error: {type(exc).__name__}"

        for m in d.get("measures", []):
            vals, src = attempt(m, lambda rows: [int(round(float({str(r["week_ending"])[:10]: r["value"] for r in rows}.get(w, 0)))) for w in weeks])
            page["measures"].append({k: m[k] for k in ("id", "label", "unit", "better", "decimals") if k in m} | {"values": vals or [], "source": src})
            sources.append(src)
        for b in d.get("breakdowns", []):
            rows, src = attempt(b, lambda rows: [[str(r["name"]), r["value"]] for r in rows])
            page["breakdowns"].append({"id": b["id"], "title": b["title"], "sub": b.get("sub", ""), "rows": rows or [], "source": src})
            sources.append(src)
        for r in d.get("ranked", []):
            cols = r["columns"]
            rows, src = attempt(r, lambda rows: [[str(x.get(cols[0], "")), str(x.get("detail", "") or "")] + [x.get(c) for c in cols[1:]] for x in rows])
            page["ranked"].append({"id": r["id"], "title": r["title"], "sub": r.get("sub", ""), "columns": cols, "rows": rows or [], "source": src})
            sources.append(src)
        state = "planned" if page["status"] != "live" else ("live" if sources and all(s == "live" for s in sources)
                                                              else "partly live" if "live" in sources else "sample")
        page["state"] = state
        status[f"domain:{d['id']}"] = state
        out.append(page)
    return out, status
