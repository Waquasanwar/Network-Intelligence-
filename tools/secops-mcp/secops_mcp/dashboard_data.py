"""Builds the one JSON document the dashboard reads.

Each section of the dashboard is filled from the best source available, in this order:

  1. live   - a configured connector (Microsoft Sentinel today; more as they are wired)
  2. export - a CSV file in SECOPS_DATA_DIR (weekly exports from each tool, or Excel saved as CSV)
  3. sample - the sample data, so the page still renders

The result carries `_sources`, which tells the dashboard which sections are live, from
exports or still on sample data. The page shows that in the sidebar.

New measures are added in metrics.json (see metrics.example.json), not in code.
"""

from __future__ import annotations

import copy
import csv
import json
import logging
import os
import threading
import time
from pathlib import Path

from .sources import sentinel
from .sources.base import NotConfigured

HERE = Path(__file__).parent
SAMPLE = json.loads((HERE / "sample_data.json").read_text())
SECTIONS = ("weekly", "vulns", "owners", "tools", "soc", "assets", "mail", "top", "notes", "hot")
EXPORT_FILES = {"weekly": "weekly.csv", "vulns": "vulns.csv", "owners": "owners.csv", "tools": "tools.csv"}

log = logging.getLogger("secops-mcp.dashboard")
_cache: dict = {"at": 0.0, "data": None}
_lock = threading.Lock()


def _num(v: str):
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return ""
    try:
        f = float(s.replace(",", ""))
        return int(f) if f.is_integer() and "." not in s else f
    except ValueError:
        return s


def _read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return [{k.strip(): _num(v) for k, v in row.items() if k} for row in csv.DictReader(fh)]


def _apply_exports(data: dict, sources: dict, folder: Path) -> None:
    for section, name in EXPORT_FILES.items():
        f = folder / name
        if f.exists():
            data[section] = _read_csv(f)
            sources[section] = "export"
    f = folder / "tool_trend.csv"
    if f.exists():
        trend: dict[str, list] = {}
        for row in sorted(_read_csv(f), key=lambda r: str(r["week_ending"])):
            trend.setdefault(row["system"], []).append(row["value"])
        data["trend"] = trend


def _apply_sentinel(data: dict, sources: dict) -> None:
    """Fills the SOC section from Sentinel. Fields Sentinel cannot supply keep their current values."""
    try:
        live = sentinel.soc_weekly(12)
    except NotConfigured:
        return
    except Exception:  # noqa: BLE001
        log.exception("Sentinel query failed; SOC section keeps its previous source")
        return
    inc, alerts = live["incidents"], live["alerts"]
    if not inc:
        return
    soc = data["soc"]
    n = len(inc)
    soc["high"] = [r["high"] for r in inc]
    soc["critical"] = [0] * n  # Sentinel stops at High; replace once the SOC tags critical incidents
    soc["mtta_minutes"] = [r["mtta_minutes"] for r in inc]
    soc["contain_hours"] = [r["contain_hours"] for r in inc]
    soc["false_positive_pct"] = [r["false_positive_pct"] for r in inc]
    soc["open_incidents"] = [r["still_open"] for r in inc]
    if alerts:
        soc["alerts"] = [r["alerts"] for r in alerts][-n:]
    weekly = data["weekly"][-n:]
    for row, r in zip(weekly, inc):
        row["incidents"], row["mttd_minutes"] = r["incidents"], r["mttd_minutes"]
    sources["soc"] = "live"


def _custom_metrics(folder: Path) -> tuple[list[dict], list[dict]]:
    cfg_path = Path(os.environ.get("SECOPS_METRICS_FILE", folder / "metrics.json"))
    if not cfg_path.exists():
        return [], []
    out, status = [], []
    for m in json.loads(cfg_path.read_text()).get("metrics", []):
        src = m.get("source", {})
        try:
            if src.get("type") == "static":
                values = src["values"]
            elif src.get("type") == "csv":
                rows = sorted(_read_csv(folder / src["file"]), key=lambda r: str(r.get("week_ending", "")))
                values = [r[src["column"]] for r in rows if r.get(src["column"]) not in ("", None)]
            elif src.get("type") == "kql":
                rows = sentinel.query(src["query"])
                values = [r["value"] for r in sorted(rows, key=lambda r: str(r["week_ending"]))]
            else:
                raise ValueError(f"Unknown source type {src.get('type')!r}")
            out.append({k: m[k] for k in ("id", "label", "view", "unit", "better", "decimals", "chart", "note") if k in m} | {"values": values[-12:]})
            status.append({"id": m.get("id"), "status": "ok", "points": len(values)})
        except NotConfigured as exc:
            status.append({"id": m.get("id"), "status": "not_configured", "detail": str(exc)})
        except Exception as exc:  # noqa: BLE001
            log.exception("measure %s failed", m.get("id"))
            status.append({"id": m.get("id"), "status": "error", "detail": f"{type(exc).__name__}: {exc}"})
    return out, status


def build() -> dict:
    data = copy.deepcopy(SAMPLE)
    sources = {s: "sample" for s in SECTIONS}
    folder = Path(os.environ.get("SECOPS_DATA_DIR", HERE.parent / "data"))
    if folder.exists():
        _apply_exports(data, sources, folder)
    if os.environ.get("SECOPS_MODE", "sample").lower() == "live":
        from .live import apply_all

        _apply_sentinel(data, sources)
        data["_systems"] = apply_all(data, sources)
    from .domains import build as build_domains

    data["domains"], domain_status = build_domains(folder, os.environ.get("SECOPS_MODE", "sample").lower() == "live")
    sources.update({k: v for k, v in domain_status.items() if v != "planned"})
    data["custom"], data["_custom_status"] = _custom_metrics(folder)
    from .daily import build as build_daily
    from .outcomes import build as build_outcomes

    data["daily"], data["daily_sources"] = build_daily(os.environ.get("SECOPS_MODE", "sample").lower() == "live")

    data["outcomes"] = build_outcomes(data, folder, os.environ.get("SECOPS_MODE", "sample").lower() == "live", sources)
    data["_sources"] = sources
    data["_built_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return data


def cached() -> dict:
    """Rebuilds at most once per SECOPS_CACHE_MINUTES (default 60), so page loads do not hammer the sources."""
    ttl = float(os.environ.get("SECOPS_CACHE_MINUTES", "60")) * 60
    with _lock:
        if _cache["data"] is None or time.time() - _cache["at"] > ttl:
            _cache["data"], _cache["at"] = build(), time.time()
        return _cache["data"]
