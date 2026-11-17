# Deploying in Claude Enterprise

The finished picture:

```
Azure (your tenant)                                     Claude Enterprise (your organisation)
┌──────────────────────────────────────┐               ┌────────────────────────────────────────┐
│ secops-metrics container             │◀── HTTPS ─────│ "SecOps metrics" custom connector      │
│  /mcp  read-only tools, Entra sign-in│   Entra token │   added once by an Owner               │
│  /     the dashboard (optional)      │               │ Security Operations Dashboard artifact │
│ managed identity → Sentinel, Defender│               │   live, shared with a viewers group    │
│ Key Vault → GitLab, Mimecast secrets │               │ Vendor connectors: Orca, Netskope …    │
└──────────────────────────────────────┘               └────────────────────────────────────────┘
```

Claude reaches a custom connector from Anthropic's cloud, not from the user's laptop. So the
server needs an HTTPS address that Anthropic can reach, locked down by sign-in and by an
IP allow list. (MCP tunnels, below, avoid inbound access entirely but are in preview.)

Steps marked **Owner** need a Claude Enterprise Owner. Steps marked **Azure** need someone who
can create app registrations and deploy to your security subscription.

## 1. Register the app in Entra ID (Azure)

1. App registrations, New registration: name it "SecOps metrics MCP", single tenant.
2. Expose an API: set the Application ID URI to `api://secops-metrics` and add a delegated
   scope `SecOps.Read` ("Read SecOps dashboard figures"). Grant admin consent.
3. Authentication, Add a platform, Web: redirect URI `https://claude.ai/api/mcp/auth_callback`.
   Check this against the redirect URI that Claude's connector dialog shows you.
4. Certificates and secrets: create a client secret. It goes into Claude in step 4 only.
5. Enterprise applications, the same app: set "Assignment required" to Yes and assign a group
   such as "SecOps Dashboard Viewers". Only that group can sign in to the connector.

## 2. Deploy the container (Azure)

From this folder, with the Azure CLI. Names in angle brackets are yours; check flags against
your CLI version.

```bash
az acr build -r <acr> -t secops-metrics:1 .

az containerapp create -n secops-metrics -g <rg> --environment <aca-env> \
  --image <acr>.azurecr.io/secops-metrics:1 --registry-server <acr>.azurecr.io \
  --target-port 8080 --ingress external --system-assigned \
  --secrets gitlab-token=keyvaultref:<kv-secret-uri>,identityref:system \
            mimecast-secret=keyvaultref:<kv-secret-uri>,identityref:system \
  --env-vars SECOPS_MODE=live SECOPS_AUTH=entra \
    SECOPS_AUTH_TENANT_ID=<tenant-id> SECOPS_AUTH_AUDIENCE=api://secops-metrics \
    SECOPS_PUBLIC_URL=https://secops-metrics.<your-domain>/mcp \
    SENTINEL_WORKSPACE_ID=<workspace-id> DEFENDER_SUBSCRIPTION_IDS=<sub1>,<sub2> \
    GITLAB_GROUPS=<group/path> GITLAB_TOKEN=secretref:gitlab-token \
    MIMECAST_CLIENT_ID=<id> MIMECAST_CLIENT_SECRET=secretref:mimecast-secret
```

Then:

- **Data access.** Give the container's managed identity "Microsoft Sentinel Reader" on the
  workspace and "Security Reader" on each subscription in scope. No Azure secret is stored;
  the server uses the managed identity automatically.
- **Address.** Add a custom domain and certificate, for example `secops-metrics.<your-domain>`.
- **Who can reach it.** Add ingress IP restrictions allowing only Anthropic's outbound range
  and your corporate network. Take the current range from Anthropic's published IP address
  page; do not copy it from a blog.
- **Storage.** Mount an Azure Files share at `/app/data` (weekly exports, `metrics.json`) and
  one at `/app/snapshots`.
- **The web dashboard at `/`** is optional once the dashboard lives in Claude. If you keep it,
  turn on the platform's Entra ID authentication for it and exclude `/mcp` and
  `/.well-known/*` from that, because the server checks Claude's tokens itself.

Check: `https://secops-metrics.<your-domain>/healthz` answers `ok`, and a request to `/mcp`
without a token answers 401.

## 3. Turn on what Claude needs (Owner)

- Make sure custom connectors are allowed for the organisation.
- Turn on connectors in artifacts ("artifact connectors"), so a shared dashboard can call the
  connector when someone opens it.

## 4. Add the connector (Owner)

Organization settings, Connectors, Add, Custom, Web:

- Name: SecOps metrics
- URL: `https://secops-metrics.<your-domain>/mcp`
- Authentication: OAuth, using **your own OAuth client**: the client ID and secret from step 1.

Members of the viewers group then open Settings, Connectors, find "SecOps metrics" and select
Connect. They sign in with Entra ID once.

Test it in a chat: "Using SecOps metrics, what were the SOC figures last week?"

## 5. Build the dashboard in Claude

In a Claude Enterprise chat with the connector turned on, attach `dashboard/styles.css` and
`dashboard/app.js` from this folder, then send:

> Build a live dashboard artifact called "Security Operations Dashboard". Its only data
> source is one call to the SecOps metrics connector's `dashboard_data` tool. Keep the design
> exactly as in the attached `styles.css` and `app.js`: put the result of that call on
> `window.DATA` and run `app.js` unchanged against it, with the same sidebar and markup as
> `dashboard/index.html`. Refresh the data whenever the page is opened. Do not add eyebrows,
> gradient text, sparkle icons or count-up animations.

Share the artifact with your organisation or with the viewers group. Each viewer's own
connection is used, so only people in the Entra group see figures.

## 6. Connect the vendors' own servers (Owner)

Add these the same way, each with a read-only identity:

| System | Connector |
|---|---|
| Orca | Orca's hosted MCP server, regional URL, OAuth or API token |
| Netskope | Netskope's hosted MCP server (technology preview), tenant URL, read-only API v2 token |
| GitLab | GitLab's own MCP server on your instance; avoid community servers |
| Microsoft Sentinel | Microsoft's Sentinel MCP server, for investigation; check Microsoft's guidance for Claude |
| SentinelOne | The Purple AI server has no sign-in of its own. Do not expose it; run it only behind the same Entra-protected pattern, or route SentinelOne data into Sentinel instead |

The dashboard keeps using `secops-metrics` for its fixed weekly numbers. The vendor
connectors are for analysts asking follow-up questions in chat.

## 7. Keep it current

- Weekly exports land on the `/app/data` share (a scheduled job or Power Automate flow).
- The server rebuilds its figures at most once an hour (`SECOPS_CACHE_MINUTES`).
- AI signals: a scheduled Claude task each Monday can call `dashboard_data`, write that week's
  signals and save them for the dashboard. Set this up once the live data is flowing.

## Without inbound access: MCP tunnels

If you cannot expose any HTTPS endpoint, Anthropic offers MCP tunnels to Enterprise customers
by request (research preview): a small agent inside your network opens an outbound-only
connection and Claude sends MCP calls over it. At announcement it was documented for Managed
Agents and the Messages API, so confirm with your Anthropic account team that it covers
claude.ai connectors and artifacts before planning around it.
