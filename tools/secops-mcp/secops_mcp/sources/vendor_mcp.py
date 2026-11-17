"""Sources that already ship their own MCP server.

For these, the better route is to connect the vendor's server directly to Claude (or route
the product's data into Sentinel) rather than re-implement its API here. This module only
records where each one is, so the aggregate tools can say so instead of guessing.
"""

VENDOR_SERVERS = {
    "SentinelOne": {
        "server": "Purple AI MCP server (github.com/Sentinel-One/purple-mcp), read-only",
        "auth": "Console API token and console URL as environment variables",
        "covers": "alerts, vulnerabilities, misconfigurations, asset inventory, PowerQuery",
    },
    "Orca": {
        "server": "Orca MCP Server (hosted, regional endpoints; also orca-mcp-server on PyPI)",
        "auth": "OAuth or API token, depending on the client",
        "covers": "cloud alerts, vulnerabilities and assets; discovery queries use Orca AI credits",
    },
    "Netskope": {
        "server": "Netskope MCP server (hosted technology preview, tenant-specific URL)",
        "auth": "Netskope REST API v2 token, read scopes only",
        "covers": "alerts, DLP incidents, application, page, network and client events",
    },
    "CyberArk": {
        "server": "No official read-only reporting server; community server for Privilege Cloud (aaearon/mcp-privilege-cloud)",
        "auth": "Service account through the official ark-sdk-python",
        "covers": "accounts, safes, sessions",
    },
}


def pointer(system: str) -> dict:
    info = VENDOR_SERVERS.get(system)
    if not info:
        return {"status": "not_implemented", "system": system}
    return {"status": "use_vendor_server", "system": system, **info}
