"""Every system the server can read, what it needs, and a cheap call that proves the connection.

`check_all()` powers the connection_check tool and `python -m secops_mcp.check`.
To add a system: write a module in this folder with a summary() function, then add a line here.
"""

from __future__ import annotations

import os
from typing import Callable

from . import cyberark, defender_cloud, defender_xdr, entra, gitlab, mimecast, netskope, sentinel, sentinelone
from .base import NotConfigured

AZURE = ("SENTINEL_WORKSPACE_ID",)
SYSTEMS: dict[str, dict] = {
    "Microsoft Sentinel": {"needs": AZURE, "check": lambda: sentinel.query("SecurityIncident | take 1 | count")},
    "Microsoft Defender XDR": {"needs": ("SECOPS_DEFENDER_XDR",), "check": lambda: defender_xdr.incidents(1)},
    "Microsoft Defender for Endpoint": {"needs": ("SECOPS_DEFENDER_XDR",), "check": defender_xdr.devices},
    "Microsoft Defender for Cloud": {"needs": ("DEFENDER_SUBSCRIPTION_IDS",), "check": defender_cloud.summary},
    "Microsoft Entra ID": {"needs": ("SECOPS_ENTRA_RISK",), "check": entra.risky_users},
    "SentinelOne": {"needs": ("S1_CONSOLE_URL", "S1_API_TOKEN"), "check": lambda: {"agents": sentinelone._count("/agents")}},
    "CyberArk": {"needs": ("CYBERARK_PVWA_URL",), "check": cyberark.summary},
    "Mimecast": {"needs": ("MIMECAST_CLIENT_ID", "MIMECAST_CLIENT_SECRET"), "check": mimecast.simulation_campaigns},
    "Netskope": {"needs": ("NETSKOPE_URL", "NETSKOPE_API_TOKEN"), "check": lambda: netskope.dlp(1)},
    "GitLab": {"needs": ("GITLAB_TOKEN", "GITLAB_GROUPS"), "check": gitlab.summary},
}


def configured(name: str) -> bool:
    return all(os.environ.get(v) for v in SYSTEMS[name]["needs"])


def _run(fn: Callable) -> dict:
    try:
        fn()
        return {"status": "connected"}
    except NotConfigured as exc:
        return {"status": "not_configured", "detail": str(exc)}
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        hint = ("credentials refused: check the identity and its permissions" if any(c in msg for c in ("401", "403"))
                else "check the URL and the network allow list" if any(c in msg for c in ("ConnectError", "Name or service", "404")) else "")
        return {"status": "error", "detail": f"{type(exc).__name__}: {msg[:300]}", "hint": hint}


def check_all() -> dict:
    out = {}
    for name, spec in SYSTEMS.items():
        if not configured(name):
            out[name] = {"status": "not_configured", "needs": list(spec["needs"])}
        else:
            out[name] = _run(spec["check"])
    return out
