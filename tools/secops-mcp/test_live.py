"""End-to-end check of the live path with simulated vendor APIs (no network, no real tenant).

It proves the connectors, the weekly history and the dashboard mapping fit together. It does
not prove the real APIs answer in exactly these shapes: confirm that with
`python -m secops_mcp.check` against your tenant.

Run: python test_live.py [output.json]
"""

import datetime as dt
import json
import os
import sys
import tempfile

import httpx

tmp = tempfile.mkdtemp()
os.environ.update({
    "SECOPS_MODE": "live", "SECOPS_SNAPSHOT_DIR": tmp, "SECOPS_DATA_DIR": tmp,
    "IDENTITY_ENDPOINT": "http://identity.local/token", "IDENTITY_HEADER": "x",
    "SENTINEL_WORKSPACE_ID": "ws", "SECOPS_DEFENDER_XDR": "1", "DEFENDER_SUBSCRIPTION_IDS": "sub1", "SECOPS_ENTRA_RISK": "1",
    "S1_CONSOLE_URL": "https://yourco.sentinelone.net", "S1_API_TOKEN": "t",
    "CYBERARK_PVWA_URL": "https://yourco.privilegecloud.cyberark.cloud", "CYBERARK_IDENTITY_URL": "https://abc.id.cyberark.cloud",
    "CYBERARK_CLIENT_ID": "c", "CYBERARK_CLIENT_SECRET": "s",
    "MIMECAST_CLIENT_ID": "c", "MIMECAST_CLIENT_SECRET": "s",
    "NETSKOPE_URL": "https://yourco.goskope.com", "NETSKOPE_API_TOKEN": "t", "NETSKOPE_APP_EVENTS": "true",
})

now = dt.datetime.now(dt.timezone.utc)
iso = lambda days: (now - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
calls = []


def handler(req: httpx.Request) -> httpx.Response:
    h, p = req.url.host, req.url.path
    calls.append(f"{h}{p}")
    j = lambda body: httpx.Response(200, json=body)
    if h == "identity.local":
        return j({"access_token": "mi-token", "expires_on": str(int(now.timestamp()) + 3600)})
    if h == "api.loganalytics.io":
        q = json.loads(req.content)["query"]
        if "SecurityAlert" in q and "week_ending" in q:
            return j({"tables": [{"columns": [{"name": "week_ending"}, {"name": "alerts"}], "rows": [[iso(7 * i), 4000 + i * 50] for i in range(11, -1, -1)]}]})
        cols = ["week_ending", "incidents", "high", "medium", "low_info", "false_positive_pct", "mttd_minutes", "mtta_minutes", "contain_hours", "still_open"]
        rows = [[iso(7 * i), 30 + i, 9 + i % 3, 12, 9, 30.0 + i, 28 + i, 9 + i % 4, 6.0 + i / 4, 5 + i % 3] for i in range(11, -1, -1)]
        return j({"tables": [{"columns": [{"name": c} for c in cols], "rows": rows}]})
    if h == "graph.microsoft.com" and p.endswith("/security/incidents"):
        return j({"value": [{"createdDateTime": iso(d), "severity": "high" if d % 3 == 0 else "medium", "status": "active" if d < 5 else "resolved",
                             "classification": "falsePositive" if d % 4 == 0 else "truePositive"} for d in range(0, 80, 2)]})
    if h == "graph.microsoft.com" and "riskyUsers" in p:
        return j({"value": [{"riskLevel": "high"}, {"riskLevel": "medium"}, {"riskLevel": "medium"}]})
    if h == "api.securitycenter.microsoft.com" and p == "/api/machines":
        plats = ["WindowsServer2022"] * 30 + ["Windows11"] * 120 + ["Linux"] * 20 + ["iOS"] * 40
        return j({"value": [{"osPlatform": o, "onboardingStatus": "Onboarded", "exposureLevel": "Medium"} for o in plats]})
    if h == "api.securitycenter.microsoft.com" and "SoftwareVulnerabilitiesByMachine" in p:
        rows = []
        for i in range(160):
            plat = ["WindowsServer2022", "Windows11", "Linux", "iOS"][i % 4]
            rows.append({"deviceId": f"d{i % 37}", "deviceName": f"{'SRV' if 'Server' in plat or plat == 'Linux' else 'WKS'}-{i % 37:03d}", "osPlatform": plat,
                         "cveId": f"CVE-2026-{1000 + i % 9}", "softwareName": ["openssl", "chrome", "log4j"][i % 3],
                         "vulnerabilitySeverityLevel": ["Critical", "High", "High", "Medium"][i % 4], "firstSeenTimestamp": iso(5 + i % 70)})
        return j({"value": rows})
    if h == "management.azure.com":
        q = json.loads(req.content)["query"]
        if "securescores" in q:
            return j({"data": [{"secure_score": 74}]})
        if "pricings" in q:
            return j({"data": [{"plans_on": 9, "plans_total": 12}]})
        return j({"data": [{"severity": "High", "findings": 40, "resources": 22}]})
    if h == "yourco.sentinelone.net":
        if req.url.params.get("countOnly"):
            return j({"pagination": {"totalItems": 9100 if p.endswith("/agents") and not req.url.params.get("infected") else 7}})
        return j({"data": [{"threatInfo": {"createdAt": iso(d), "resolved": d > 20}, "agentRealtimeInfo": {"agentComputerName": f"WKS-{d % 5}"}} for d in range(0, 80, 3)],
                  "pagination": {"nextCursor": None}})
    if h == "abc.id.cyberark.cloud":
        return j({"access_token": "ca", "expires_in": 3600})
    if h == "yourco.privilegecloud.cyberark.cloud":
        if "Discovered" in p:
            return j({"value": [{"id": i} for i in range(41)]})
        return j({"value": [{"platformId": "WinDomain", "secretManagement": {"automaticManagementEnabled": i % 9 != 0}} for i in range(320)]})
    if h == "api.services.mimecast.com":
        if p == "/oauth/token":
            return j({"access_token": "mc", "expires_in": 1800})
        if "url/get-logs" in p:
            return j({"data": [{"clickLogs": [{"date": iso(d), "scanResult": "malicious", "action": "block" if d % 5 else "allow"} for d in range(0, 80)]}], "meta": {"pagination": {}}})
        if "attachment" in p:
            return j({"data": [{"attachmentLogs": [{"date": iso(d), "result": "malicious"} for d in range(0, 80, 2)]}], "meta": {"pagination": {}}})
        if "impersonation" in p:
            return j({"data": [{"impersonationLogs": [{"eventTime": iso(d), "taggedMalicious": True} for d in range(0, 80, 4)]}], "meta": {"pagination": {}}})
        return j({"data": [{"id": "c1", "name": "October"}]})
    if h == "yourco.goskope.com":
        if req.url.params.get("operation") == "next":
            return j({"result": []})
        if "alerts/dlp" in p:
            return j({"result": [{"timestamp": int((now - dt.timedelta(days=d)).timestamp()), "dlp_profile": ["Customer personal data", "Source code", "Payment cards"][d % 3],
                                  "user": f"user{d % 6}@yourco.com"} for d in range(0, 80)]})
        return j({"result": [{"ccl": "poor", "app": ["Personal cloud storage", "AI assistant"][d % 2], "user": f"user{d % 4}@yourco.com", "activity": "Upload", "file_size": 2_000_000} for d in range(30)]})
    return httpx.Response(404, json={"error": f"unexpected {h}{p}"})


from secops_mcp.sources import base  # noqa: E402

base.TRANSPORT = httpx.MockTransport(handler)
from secops_mcp.dashboard_data import build  # noqa: E402
from secops_mcp.sources.registry import check_all  # noqa: E402

checks = check_all()
print("connection check:", {k: v["status"] for k, v in checks.items()})
data = build()
print("systems:", data["_systems"])
print("sections:", data["_sources"])
print("assets:", [(a["type"], a["critical"], a["high"], a["overdue"], a["patched_pct"]) for a in data["assets"]])
print("cards:", [(t["system"], t["value"], t["previous"]) for t in data["tools"]])
print("mail blocked last 3 weeks:", data["mail"]["phish_blocked"][-3:], "clicked:", [r["phish_clicked"] for r in data["weekly"][-3:]])
assert all(v["status"] == "connected" for k, v in checks.items() if k != "GitLab"), checks
assert data["_sources"]["assets"] == data["_sources"]["soc"] == data["_sources"]["mail"] == "live"
assert all(len(v) == 12 and None not in v for v in data["trend"].values())
if len(sys.argv) > 1:
    json.dump(data, open(sys.argv[1], "w"))
print("OK,", len(calls), "simulated API calls")
