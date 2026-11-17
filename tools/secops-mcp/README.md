# SecOps metrics MCP server

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
| `vulnerability_summary` | Vulnerabilities | Defender for Cloud (Resource Graph), GitLab (GraphQL); SentinelOne and Orca through their own MCP servers |
| `remediation_weekly` | Remediation | Weekly snapshot files written by the server |
| `phishing_summary` | Email and phishing | Mimecast API 2.0 (Awareness Training) |
| `user_and_app_risk` | Users and apps | Entra ID sign-ins through Sentinel; Netskope and CyberArk through their own servers |
| `coverage` | Control areas | Defender for Cloud plans |
| `top_list` | Top lists on every view | Sentinel for alert hosts and noisy rules; the rest in sample mode for now |

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
