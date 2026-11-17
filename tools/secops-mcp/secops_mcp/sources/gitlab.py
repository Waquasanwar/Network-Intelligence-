"""GitLab vulnerability counts, through the GraphQL API.

Needs a group access token with the read_api scope, owned by a service account with
at least the Security Manager or Developer role on the groups in scope (vulnerability
reports need GitLab Ultimate). Works with gitlab.com and self-managed instances.
"""

from __future__ import annotations

import os

from .base import client, env

SEVERITY_COUNTS = """
query($path: ID!) {
  group(fullPath: $path) {
    vulnerabilitySeveritiesCount(state: [DETECTED, CONFIRMED]) { critical high medium low }
  }
}
"""


def summary() -> dict:
    cfg = env("GITLAB_TOKEN", "GITLAB_GROUPS")
    base = os.environ.get("GITLAB_URL", "https://gitlab.com").rstrip("/")
    out = []
    for path in [g.strip() for g in cfg["GITLAB_GROUPS"].split(",") if g.strip()]:
        resp = client().post(
            f"{base}/api/graphql",
            headers={"Authorization": f"Bearer {cfg['GITLAB_TOKEN']}"},
            json={"query": SEVERITY_COUNTS, "variables": {"path": path}})
        resp.raise_for_status()
        body = resp.json()
        if body.get("errors"):
            raise RuntimeError(body["errors"][0].get("message", "GitLab GraphQL error"))
        counts = (body["data"]["group"] or {}).get("vulnerabilitySeveritiesCount") or {}
        out.append({"group": path, **counts})
    return {"by_group": out}
