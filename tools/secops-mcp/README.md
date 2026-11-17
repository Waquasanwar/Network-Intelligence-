# Security Operations Dashboard and SecOps metrics server

Everything needed to run the Security Operations Dashboard inside your own environment,
with the design you have seen, fed from your own systems:

```
 Your systems ──read only──▶  this app (one container, in your tenant)  ──▶  browser, behind single sign-on
 Sentinel, Defender,           /api/dashboard  the figures as JSON              /      the dashboard
 GitLab, Mimecast …            /mcp            the same figures for Claude
 weekly exports (CSV)          metrics.json    measures you add
```

| Folder or file | What it is |
|---|---|
| `dashboard/` | The dashboard exactly as designed: `index.html`, `styles.css`, `app.js`. It loads its figures from `/api/dashboard`. |
| `secops_mcp/web.py` | One web process serving the dashboard, its data API and the MCP server. |
| `secops_mcp/dashboard_data.py` | Fills each section from a live connector, a CSV export, or sample data, in that order. |
| `secops_mcp/server.py`, `sources/` | The read-only MCP tools and the connectors to each system. |
| `metrics.example.json` | How to add any new measure without touching code. |
| `exports-example/` | The CSV layouts for the weekly-export route. |
| `Dockerfile` | The container you deploy. |

## Build it in your own environment

**On Claude Enterprise?** Follow [CLAUDE-ENTERPRISE.md](CLAUDE-ENTERPRISE.md): the same container becomes a custom connector, and the dashboard lives in Claude as a shared, live artifact.


The recommended home is Azure, since Sentinel and Defender for Cloud already live there.

1. **Container.** Build the image from this folder (`docker build -t secops-dashboard .`) and
   push it to your Azure Container Registry.
2. **Host.** Run it on Azure Container Apps (or App Service) in your security subscription,
   with ingress limited to your network or Front Door.
3. **Sign-in.** Turn on the platform's built-in authentication with Microsoft Entra ID and
   restrict it to a security group, for example "SecOps Dashboard Viewers". The app has no
   login of its own, so never expose it without this.
4. **Identity for the data.** Give the container a managed identity. Grant it Microsoft
   Sentinel Reader on the workspace and Security Reader on the subscriptions in scope. The
   server picks up the managed identity automatically, so no Azure secret is stored.
5. **Other secrets.** Put the GitLab token and Mimecast client secret in Azure Key Vault and
   reference them as Container Apps secrets. Each is read-only (see the access table below).
6. **Settings.** Set `SECOPS_MODE=live`, `SENTINEL_WORKSPACE_ID`, `DEFENDER_SUBSCRIPTION_IDS`,
   `GITLAB_GROUPS` and so on (all listed in `.env.example`).
7. **Storage.** Mount an Azure Files share at `/app/data` (weekly exports, `metrics.json`) and
   another at `/app/snapshots` (the weekly history the server builds up).
8. **Weekly refresh.** Figures are rebuilt at most once an hour (`SECOPS_CACHE_MINUTES`). For
   the export route, a scheduled job or Power Automate flow drops each week's CSVs on the share.

Elsewhere (on-premises, another cloud) the steps are the same: run the container behind
your single sign-on proxy, give it read-only credentials from your vault, mount the two folders.

Try it locally first, with no credentials:

```bash
pip install -r requirements.txt
SECOPS_DATA_DIR=./exports-example uvicorn secops_mcp.web:app --port 8080
# open http://localhost:8080
```

## Getting data in

Each section of the dashboard uses the best source it has, and the sidebar says how many
sections are still on sample data.

| Route | What to do | Fills |
|---|---|---|
| **Weekly exports** (works today) | Save each tool's weekly figures as CSV, using the columns in `exports-example/`, into the data folder. Excel works: save as CSV. | Weekly trend, findings by scanner, teams, systems and their 12-week trends |
| **Live connectors** | Set the credentials for a source and `SECOPS_MODE=live`. | SOC section from Sentinel today; vulnerability and phishing figures through the MCP tools |
| **Through Sentinel** | Turn on each product's Sentinel data connector, then add a KQL measure. | Anything that lands in the workspace |

## Adding a data point

Copy `metrics.example.json` to `metrics.json` in the data folder and add an entry. No code
change and no redeploy: the next refresh shows it.

```json
{
  "id": "patch_compliance_servers",
  "label": "Servers fully patched",
  "view": "vulnerabilities",
  "unit": "%",
  "better": "higher",
  "source": { "type": "csv", "file": "patching.csv", "column": "servers_patched_pct" }
}
```

- `view` is the page it appears on: `overview`, `detection` (SOC operations), `vulnerabilities`,
  `remediation`, `email`, `people` (users and apps) or `controls`.
- `source.type` is `csv` (a column in a file with a `week_ending` column), `kql` (a Sentinel
  query returning `week_ending` and `value`) or `static` (values written in the file).
- `better` decides whether a rise shows green or red.

Each measure appears under "More measures" on its view, as a headline figure with its change
on last week and a 12-week chart with "View data". The API reports any measure that failed in
`_custom_status`.

A measure that needs a new kind of chart or a new page is a code change in `dashboard/app.js`;
the views there are built from the same small set of parts (headline tiles, trend charts, ranked
lists, bar lists), so a new section is usually a few lines.

---

# The MCP server

A read-only MCP server that serves the weekly figures behind the Security Operations
Dashboard: SOC activity, vulnerabilities, remediation, phishing, user and app risk,
coverage, and the ranked "top" lists.

It runs in two modes:

| Mode | What it does |
|---|---|
| `sample` (default) | Answers from `secops_mcp/sample_data.json`, the same sample data the dashboard shows. Use it to wire up the dashboard and any MCP client before credentials exist. |
| `live` | Calls each configured source. A source without credentials answers `not_configured`; the other sources still answer. |

The live adapters are written against each vendor's published API but have **not been run
against a real tenant**. Test each one with a read-only identity before relying on it.

## Tools

| Tool | Dashboard view | Live source today |
|---|---|---|
| `soc_weekly` | SOC operations | Microsoft Sentinel (`SecurityIncident`, `SecurityAlert`) |
| `vulnerability_summary` | Vulnerabilities | Defender for Endpoint (by servers, workstations, mobile), Defender for Cloud, SentinelOne, GitLab |
| `remediation_weekly` | Remediation | Weekly snapshot files written by the server |
| `phishing_summary` | Email and phishing | Mimecast API 2.0: URL, attachment and impersonation logs, Awareness Training |
| `user_and_app_risk` | Users and apps | Entra ID sign-ins and risky users, Netskope DLP and risky apps, CyberArk privileged accounts |
| `coverage` | Control areas | Defender for Cloud plans |
| `top_list` | Top lists on every view | Sentinel for alert hosts and noisy rules; other lists fill through `dashboard_data` |
| `connection_check` | (setup) | Calls every configured system once and reports connected, not configured, or failing |
| `dashboard_data` | Every view | The whole dashboard in one document |

**Connecting each system:** identities, permissions, settings and what each fills are in [SOURCES.md](SOURCES.md).

## What exists for each system (research, November 2026)

| System | Ready-made MCP server | Recommended route |
|---|---|---|
| Microsoft Sentinel | **Official.** Microsoft's Sentinel MCP server, with a data exploration collection (`https://sentinel.microsoft.com/mcp/data-exploration`) and a triage collection for incidents and alerts. Data exploration needs the Sentinel data lake; entity analysis uses Security Compute Units. | Use Microsoft's server for investigation. Use this server's fixed KQL for the weekly counts, so the dashboard gets the same numbers every week. |
| Defender for Cloud | No dedicated server found. Data is reachable through Azure Resource Graph and, for alerts, through Sentinel's triage collection. | This server's Resource Graph adapter (secure score, unhealthy findings by severity, plan coverage). |
| GitLab | **Official.** GitLab's built-in MCP server (generally available in recent releases), with a `code_security` toolset on licensed tiers. Several community servers had critical CVEs in 2026 (for example CVE-2026-44895, CVE-2026-61560). | Use GitLab's own server, not a community one. This server's GraphQL adapter covers the severity counts. |
| Orca | **Official.** Orca MCP Server, hosted with regional endpoints, OAuth or API token, available to all customers. Discovery queries use Orca AI credits. | Connect Orca's server. Route Orca findings into Sentinel for the weekly counts. |
| Netskope | **Official, preview.** Netskope-hosted MCP server (technology preview, tenant-specific URL, REST API v2 token). Covers alerts, DLP incidents, and application, page, network and client events. | Connect Netskope's server with a read-only token. |
| CyberArk | Official servers cover Secure Cloud Access and Secrets Manager, not reporting. A community server covers Privilege Cloud through the official SDK. | Route CyberArk audit data into Sentinel, or add a small adapter for account counts. |
| Mimecast | No official server. One community server (`@wyre-ai/mimecast-mcp`, API 2.0). API 1.0 has reached end of life. | This server's API 2.0 adapter. Confirm request bodies in your API 2.0 portal. |
| SentinelOne | **Vendor-maintained.** Purple AI MCP server (`Sentinel-One/purple-mcp`), read-only: alerts, vulnerabilities, misconfigurations, inventory, PowerQuery. It has no built-in authentication, so never expose it on a network. | Run it locally beside Claude, or route SentinelOne data into Sentinel. |

Most of these products also have a Microsoft Sentinel data connector. Landing their data in
the Sentinel workspace means one read-only identity, one audit trail, and one set of KQL
queries for every weekly number. Check the exact connector and table names for your tenant.

## Data points and where they come from

| Dashboard figure | Source and field |
|---|---|
| Alerts received, investigated | Sentinel `SecurityAlert`, `SecurityIncident` |
| Incidents by severity | `SecurityIncident.Severity`. Sentinel stops at High, so "critical" needs your own tag. |
| Time to detect | `CreatedTime - FirstActivityTime` |
| Time to acknowledge | `FirstModifiedTime - CreatedTime` |
| Time to contain | No native field. `ClosedTime` is the stand-in until a playbook records containment. |
| False-alarm rate | `Classification == "FalsePositive"` |
| Open critical and high findings | Defender for Cloud assessments, GitLab vulnerability counts, Orca and SentinelOne servers |
| By asset type | Needs asset type on each finding. Agree the categories, then tag in each scanner. |
| Opened, closed, fixed in time | Needs first-seen and closed dates per finding, compared with your deadline per severity |
| Phishing blocked, delivered, clicked | Mimecast threat (TTP) reports |
| Reported by staff, simulated campaigns | Mimecast Awareness Training |
| Risky sign-ins, failed second factor | Entra ID `SigninLogs` through Sentinel |
| Data loss violations, risky apps | Netskope alerts and DLP incidents |
| Unvaulted privileged accounts | CyberArk accounts and safes |
| Detection coverage by attack stage | Sentinel analytics rules mapped to MITRE ATT&CK tactics |

## Run it

```bash
pip install -r requirements.txt
python -m secops_mcp.server              # stdio, sample mode
SECOPS_TRANSPORT=http python -m secops_mcp.server   # streamable HTTP on port 8000
python test_client.py sample             # call every tool once
```

Claude Code, from this folder: `claude mcp add secops -- python -m secops_mcp.server`

claude.ai: a remote server is added by an organisation Owner under Organization settings,
Connectors, Add, Custom. It must be reachable over HTTPS and should sit behind your single
sign-on; see the security notes below before exposing it.

## Connecting securely

- One read-only service identity per system, owned by the security team. No personal accounts.
- Least scope: one workspace, the subscriptions in scope, the groups in scope.
- Prefer managed identity or OAuth client credentials. Where only an API key exists, keep
  it in the vault, inject it at start-up, and rotate it on a schedule.
- Run the server inside your own tenant. Bind stdio or `127.0.0.1` unless it sits behind
  an authenticating gateway; several 2026 MCP CVEs came from unauthenticated HTTP transports.
- Tools take no free-form queries and return counts and identifiers only.
- Log every call to Sentinel and review the log after the first month.

`.env.example` lists every variable. Do not commit a filled-in copy.
