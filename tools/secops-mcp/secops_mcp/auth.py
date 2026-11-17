"""Microsoft Entra ID sign-in for the MCP endpoint, so Claude Enterprise can connect safely.

How it fits together:
  1. You register an app in Entra ID ("SecOps metrics MCP") that exposes one delegated
     scope, SecOps.Read, and assign it to a group of permitted users.
  2. A Claude Enterprise Owner adds this server as a custom connector, using that app's
     client ID and secret as "your own OAuth client".
  3. Each person who connects signs in with Entra ID. Claude then sends their access token
     on every MCP call, and this module checks it: signature, issuer, audience, expiry and
     scope. Anything else gets 401.

Enable with SECOPS_AUTH=entra and set SECOPS_AUTH_TENANT_ID, SECOPS_AUTH_AUDIENCE (the app
ID URI, for example api://secops-metrics) and SECOPS_PUBLIC_URL (https://.../mcp).
"""

from __future__ import annotations

import logging
import os

import anyio
import jwt
from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings

log = logging.getLogger("secops-mcp.auth")
REQUIRED_SCOPE = os.environ.get("SECOPS_AUTH_SCOPE", "SecOps.Read")


class EntraTokenVerifier:
    def __init__(self, tenant_id: str, audience: str) -> None:
        self.issuer = f"https://login.microsoftonline.com/{tenant_id}/v2.0"
        self.audience = audience
        self._jwks = jwt.PyJWKClient(f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys", cache_keys=True)

    def _check(self, token: str) -> AccessToken | None:
        try:
            key = self._jwks.get_signing_key_from_jwt(token)
            claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=self.audience, issuer=self.issuer,
                                options={"require": ["exp", "iss", "aud"]})
        except jwt.PyJWTError as exc:
            log.info("rejected token: %s", exc)
            return None
        scopes = str(claims.get("scp", "")).split()
        if REQUIRED_SCOPE not in scopes:
            log.info("rejected token for %s: missing scope %s", claims.get("oid"), REQUIRED_SCOPE)
            return None
        log.info("accepted token for user %s", claims.get("oid"))
        return AccessToken(token=token, client_id=str(claims.get("azp") or claims.get("appid") or ""), scopes=scopes,
                           expires_at=int(claims["exp"]), resource=self.audience)

    async def verify_token(self, token: str) -> AccessToken | None:
        return await anyio.to_thread.run_sync(self._check, token)


def from_env() -> tuple[EntraTokenVerifier | None, AuthSettings | None]:
    if os.environ.get("SECOPS_AUTH", "").lower() != "entra":
        return None, None
    tenant, audience, public = (os.environ[k] for k in ("SECOPS_AUTH_TENANT_ID", "SECOPS_AUTH_AUDIENCE", "SECOPS_PUBLIC_URL"))
    settings = AuthSettings(issuer_url=f"https://login.microsoftonline.com/{tenant}/v2.0", resource_server_url=public,
                            required_scopes=[REQUIRED_SCOPE])
    return EntraTokenVerifier(tenant, audience), settings
