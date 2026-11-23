"""One web process: the dashboard at /, its data under /api, the MCP server at /mcp.

Run inside your own tenant behind single sign-on (for example Entra ID authentication on
Azure Container Apps or App Service). This process does not authenticate users itself; it reads
the signed-in user's name from the platform's X-MS-CLIENT-PRINCIPAL-NAME header to record who
approved an action.

    uvicorn secops_mcp.web:app --host 127.0.0.1 --port 8080
"""

from __future__ import annotations

import datetime as dt
import logging
import os
import threading
import time
from pathlib import Path

import anyio
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from . import liveboard, reports, workflows
from .dashboard_data import cached
from .server import mcp

DASHBOARD = Path(__file__).parent.parent / "dashboard"
log = logging.getLogger("secops-mcp.web")
_live_cache: dict = {"at": 0.0, "data": None}


def _is_live() -> bool:
    return os.environ.get("SECOPS_MODE", "sample").lower() == "live"


def live_board() -> dict:
    if _live_cache["data"] is None or time.time() - _live_cache["at"] > 50:
        _live_cache["data"], _live_cache["at"] = liveboard.build(_is_live()), time.time()
    return _live_cache["data"]


def _user(req: Request) -> str:
    return req.headers.get("x-ms-client-principal-name") or req.headers.get("x-forwarded-user") or "signed-in user"


def _same_origin(req: Request) -> bool:
    origin = req.headers.get("origin") or req.headers.get("referer") or ""
    host = req.headers.get("x-forwarded-host") or req.headers.get("host") or ""
    return bool(host) and host in origin and req.headers.get("x-requested-with") == "secops-dashboard"


async def dashboard_api(_: Request) -> JSONResponse:
    return JSONResponse(await anyio.to_thread.run_sync(cached), headers={"Cache-Control": "no-store"})


async def live_api(_: Request) -> JSONResponse:
    return JSONResponse(await anyio.to_thread.run_sync(live_board), headers={"Cache-Control": "no-store"})


async def workflows_api(_: Request) -> JSONResponse:
    return JSONResponse(await anyio.to_thread.run_sync(workflows.overview), headers={"Cache-Control": "no-store"})


async def decide_api(req: Request) -> JSONResponse:
    if not _same_origin(req):
        return JSONResponse({"error": "Requests must come from the dashboard page."}, status_code=403)
    uid, verb = req.path_params["uid"], req.path_params["verb"]
    if verb not in ("approve", "dismiss"):
        return JSONResponse({"error": "Use approve or dismiss."}, status_code=404)
    rec = await anyio.to_thread.run_sync(lambda: workflows.decide(uid, verb == "approve", _user(req)))
    return JSONResponse(rec or {"error": "Not found, or already decided."}, status_code=200 if rec else 404)


def _days(req: Request, default: int) -> int:
    try:
        return max(1, min(int(req.query_params.get("days", default)), 730))
    except ValueError:
        return default


async def report_pptx(req: Request) -> Response:
    days = _days(req, 30)
    data = await anyio.to_thread.run_sync(cached)
    body = await anyio.to_thread.run_sync(lambda: reports.deck(data, live_board(), data["threats"], days))
    name = f"security-operations-{dt.date.today():%Y-%m-%d}.pptx"
    return Response(body, media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


async def report_html(req: Request) -> HTMLResponse:
    days = _days(req, 7)
    data = await anyio.to_thread.run_sync(cached)
    return HTMLResponse(await anyio.to_thread.run_sync(lambda: reports.html_report(data, live_board(), data["threats"], days)))


async def healthz(_: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


def _scheduler() -> None:
    """Checks the workflows every SECOPS_EVAL_MINUTES. Run one replica with the scheduler on."""
    every = float(os.environ.get("SECOPS_EVAL_MINUTES", "5")) * 60
    while True:
        try:
            data = cached()
            workflows.evaluate(data, live_board(), data["threats"])
        except Exception:  # noqa: BLE001
            log.exception("workflow check failed")
        time.sleep(every)


def build_app():
    mcp.settings.streamable_http_path = "/mcp"
    app = mcp.streamable_http_app()
    app.router.routes.extend([
        Route("/api/dashboard", dashboard_api), Route("/api/live", live_api), Route("/api/workflows", workflows_api),
        Route("/api/workflows/{uid}/{verb:str}", decide_api, methods=["POST"]),
        Route("/api/report.pptx", report_pptx), Route("/api/report.html", report_html), Route("/healthz", healthz),
        Mount("/", StaticFiles(directory=DASHBOARD, html=True), name="dashboard"),
    ])
    if os.environ.get("SECOPS_SCHEDULER", "false").lower() == "true":
        threading.Thread(target=_scheduler, name="secops-scheduler", daemon=True).start()
    return app


app = build_app()
