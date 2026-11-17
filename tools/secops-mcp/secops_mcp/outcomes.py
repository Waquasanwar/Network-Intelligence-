"""Programme outcomes (for example the SOC, SIEM and SOAR Phase 2 outcomes) measured against
their targets. Configured in outcomes.json; each measure takes its "now" value from a live
dashboard figure, a Sentinel query, or a value typed in, in that order of preference.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from .sources import sentinel

log = logging.getLogger("secops-mcp.outcomes")
HERE = Path(__file__).parent


def _from_dashboard(data: dict, ref: str):
    if ref == "tools.coverage_avg":
        vals = [t.get("coverage_pct") for t in data.get("tools", []) if isinstance(t.get("coverage_pct"), (int, float))]
        return round(sum(vals) / len(vals)) if vals else None
    section, key = ref.split(".", 1)
    v = data.get(section, {}).get(key)
    return v[-1] if isinstance(v, list) and v else v


def build(data: dict, folder: Path, live: bool, sources: dict) -> dict:
    path = Path(os.environ.get("SECOPS_OUTCOMES_FILE", folder / "outcomes.json"))
    cfg = json.loads((path if path.exists() else HERE / "outcomes.default.json").read_text())
    out = []
    for o in cfg["outcomes"]:
        rows = []
        for m in o["measures"]:
            row = {k: m.get(k) for k in ("label", "target", "unit", "better", "note", "text")}
            value, src = None, "sample"
            if "text" in m:
                value, src = m["text"], "declared"
            elif m.get("manual") is not None:
                value, src = m["manual"], "entered"
            elif m.get("from"):
                section = m["from"].split(".")[0]
                if sources.get(section) in ("live", "export") or (section == "tools" and sources.get("tools") != "sample"):
                    value, src = _from_dashboard(data, m["from"]), "live"
            elif m.get("kql") and live:
                try:
                    rows_ = sentinel.query(m["kql"])
                    if rows_ and rows_[0].get("value") is not None:
                        value, src = rows_[0]["value"], "live"
                except Exception as exc:  # noqa: BLE001
                    log.info("outcome measure %s not available: %s", m["label"], exc)
            if value is None and "sample" in m:
                value, src = m["sample"], "sample"
            row["now"], row["source"] = value, src
            t = m.get("target")
            if isinstance(value, (int, float)) and isinstance(t, (int, float)):
                row["meets"] = value <= t if m.get("better", "lower") == "lower" else value >= t
            rows.append(row)
        out.append({k: o[k] for k in ("type", "outcome", "status", "evidence")} | {"measures": rows})
    return {"title": cfg.get("title", "Outcomes"), "outcomes": out}
