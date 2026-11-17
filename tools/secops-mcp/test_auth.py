"""Checks the Entra ID guard on /mcp with a locally made key: no token, wrong scope, wrong audience, good token."""
import asyncio, os, time
os.environ.update(SECOPS_AUTH="entra", SECOPS_AUTH_TENANT_ID="00000000-0000-0000-0000-000000000000", SECOPS_AUTH_AUDIENCE="api://secops-metrics", SECOPS_PUBLIC_URL="https://secops.example.com/mcp")
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from starlette.testclient import TestClient
from secops_mcp import web
from secops_mcp.server import _verifier

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
class K: pass
k = K(); k.key = key.public_key()
_verifier._jwks.get_signing_key_from_jwt = lambda t: k
def tok(**over):
    c = {"iss": _verifier.issuer, "aud": "api://secops-metrics", "exp": int(time.time()) + 600, "scp": "SecOps.Read", "oid": "u1", "azp": "claude"}
    c.update(over); return jwt.encode(c, key, algorithm="RS256")
init = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}}}
hdr = {"accept": "application/json, text/event-stream"}
with TestClient(web.app) as c:
    print("metadata", c.get("/.well-known/oauth-protected-resource").status_code, c.get("/.well-known/oauth-protected-resource").json().get("authorization_servers"))
    for name, t in [("no token", None), ("wrong scope", tok(scp="Other")), ("wrong audience", tok(aud="api://other")), ("expired", tok(exp=int(time.time()) - 60)), ("good token", tok())]:
        h = dict(hdr, **({"authorization": f"Bearer {t}"} if t else {}))
        print(f"{name}: {c.post('/mcp', json=init, headers=h).status_code}")
    print("dashboard api", c.get("/api/dashboard").status_code)
