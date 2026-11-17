"""Connection check: python -m secops_mcp.check

Calls each configured system once, read-only, and prints whether it answered. Run it after
every credential or network change.
"""

from __future__ import annotations

from .sources.registry import check_all

ICON = {"connected": "OK  ", "not_configured": "--  ", "error": "FAIL"}


def main() -> None:
    for name, r in check_all().items():
        line = f"{ICON.get(r['status'], '?   ')} {name:32} {r['status']}"
        if r["status"] == "not_configured":
            line += f"  (set {', '.join(r.get('needs', []))})"
        elif r["status"] == "error":
            line += f"  {r.get('hint') or ''}  {r['detail']}"
        print(line)


if __name__ == "__main__":
    main()
