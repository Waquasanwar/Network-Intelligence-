"""Weekly history for figures that the source systems only report as "now".

Each refresh records the current value against this week's key. After a few weeks the
dashboard has a real trend line without anyone keeping a spreadsheet.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import threading
from pathlib import Path

_lock = threading.Lock()


def _file() -> Path:
    folder = Path(os.environ.get("SECOPS_SNAPSHOT_DIR", Path(__file__).parent / "snapshots"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "history.json"


def this_week() -> str:
    """The most recent completed week (ending Sunday). The week in progress is left out, so a
    Tuesday refresh does not show a two-day week as a sudden drop."""
    d = dt.date.today()
    return (d - dt.timedelta(days=(d.weekday() + 1) % 7 or 7)).isoformat()


def last_weeks(n: int = 12) -> list[str]:
    end = dt.date.fromisoformat(this_week())
    return [(end - dt.timedelta(weeks=n - 1 - i)).isoformat() for i in range(n)]


def record(key: str, value) -> None:
    if value is None:
        return
    with _lock:
        f = _file()
        data = json.loads(f.read_text()) if f.exists() else {}
        data.setdefault(key, {})[this_week()] = value
        f.write_text(json.dumps(data, indent=1, sort_keys=True))


def series(key: str, weeks: list[str]) -> list:
    f = _file()
    data = json.loads(f.read_text()).get(key, {}) if f.exists() else {}
    return [data.get(w) for w in weeks]
