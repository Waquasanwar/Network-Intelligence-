"""One web process: the dashboard at /, its data at /api/dashboard, the MCP server at /mcp.

Run inside your own tenant behind single sign-on (for example Entra ID authentication on
Azure Container Apps or App Service). This process does not authenticate users itself.

    uvicorn secops_mcp.web:app --host 127.0.0.1 --port 8080
"""

from __future__ import annotations

from pathlib import Path

import anyio
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from .dashboard_data import cached
from .server import mcp

DASHBOARD = Path(__file__).parent.parent / "dashboard"


async def dashboard_api(_: Request) -> JSONResponse:
    data = await anyio.to_thread.run_sync(cached)
    return JSONResponse(data, headers={"Cache-Control": "no-store"})


async def healthz(_: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


def build_app():
    mcp.settings.streamable_http_path = "/mcp"
    app = mcp.streamable_http_app()
    app.router.routes.extend([
        Route("/api/dashboard", dashboard_api),
        Route("/healthz", healthz),
        Mount("/", StaticFiles(directory=DASHBOARD, html=True), name="dashboard"),
    ])
    return app


app = build_app()
