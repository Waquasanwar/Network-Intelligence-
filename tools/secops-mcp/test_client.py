"""Starts the server over stdio and calls every tool once. Run: python test_client.py"""
import asyncio, json, os, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main(mode):
    params = StdioServerParameters(command=sys.executable, args=["-m", "secops_mcp.server"], env={**os.environ, "SECOPS_MODE": mode, "SECOPS_SNAPSHOT_DIR": "/tmp/secops-snap-test"})
    async with stdio_client(params) as (r, w), ClientSession(r, w) as s:
        await s.initialize()
        tools = (await s.list_tools()).tools
        print(mode, "tools:", [t.name for t in tools])
        calls = [("soc_weekly", {"weeks": 4}), ("vulnerability_summary", {}), ("remediation_weekly", {"weeks": 4}), ("phishing_summary", {}),
                 ("user_and_app_risk", {}), ("coverage", {}), ("top_list", {"name": "phishing_targets", "limit": 3}), ("top_list", {"name": "alert_hosts", "limit": 3})]
        for name, args in calls:
            res = await s.call_tool(name, args)
            body = json.loads(res.content[0].text) if res.content else {}
            summary = {k: (v.get("status") if isinstance(v, dict) and "status" in v else type(v).__name__) for k, v in body.items()}
            print(f"  {name}: error={res.isError} {json.dumps(summary)[:220]}")

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "sample"))
