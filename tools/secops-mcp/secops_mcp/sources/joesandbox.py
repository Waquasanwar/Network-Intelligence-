"""Joe Sandbox: verdicts for files and links the SOC detonated.

Joe Sandbox has no Sentinel connector, so the dashboard reads its API directly with a read-only
API key (JOE_API_KEY, kept in Key Vault). JOE_API_URL defaults to Joe Sandbox Cloud; set it to
your on-premise server's /api address if you run your own. Calls follow the public v2 API
(analysis/list, analysis/info); confirm them against your server's API version before relying
on the figures.
"""

from __future__ import annotations

from collections import Counter

from .base import client, env, env_or


def _post(path: str, **fields) -> dict:
    cfg = env("JOE_API_KEY")
    url = env_or("JOE_API_URL", "https://jbxcloud.joesecurity.org/api").rstrip("/") + path
    resp = client().post(url, data={"apikey": cfg["JOE_API_KEY"], **fields})
    resp.raise_for_status()
    return resp.json().get("data", {})


def recent(limit: int = 40) -> list[dict]:
    rows = _post("/v2/analysis/list")
    out = []
    for r in (rows or [])[:limit]:
        info = _post("/v2/analysis/info", webid=str(r.get("webid")))
        out.append({"webid": info.get("webid"), "name": info.get("filename") or info.get("url") or "", "detection": info.get("detection") or "unknown",
                    "score": info.get("score"), "time": info.get("time")})
    return out


def summary(limit: int = 40) -> dict:
    rows = recent(limit)
    return {"analyses": len(rows), "by_verdict": dict(Counter(r["detection"] for r in rows)), "recent": rows[:10]}
