"""Shared settings for live operations, threat paths and workflows (ops.json)."""

from __future__ import annotations

import json
import os
from pathlib import Path

HERE = Path(__file__).parent


def config() -> dict:
    folder = Path(os.environ.get("SECOPS_DATA_DIR", HERE.parent / "data"))
    path = Path(os.environ.get("SECOPS_OPS_FILE", folder / "ops.json"))
    return json.loads((path if path.exists() else HERE / "ops.default.json").read_text())
