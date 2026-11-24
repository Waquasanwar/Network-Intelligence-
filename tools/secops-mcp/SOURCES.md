# Connecting each system

Every connection is read-only, uses its own identity, and is tested with:

```bash
python -m secops_mcp.check
```

which prints `OK`, `--` (not configured, with the settings it needs) or `FAIL` (with a hint:
credentials refused, or URL and network). In Claude, the `connection_check` tool gives the same.

The connectors follow each vendor's published API. They have been tested end to end against
simulated responses (`python test_live.py`), not yet against your tenants, so run the check
and compare a few figures with each console before trusting the dashboard.

## At a glance

| System | Identity to create | Permissions (read only) | Fills on the dashboard |
|---|---|---|---|
| Microsoft Sentinel | Container's managed identity | Microsoft Sentinel Reader on the workspace | SOC operations: incidents, severities, time to detect, acknowledge, close; false alarms; alert volumes; noisiest rules; hosts with most alerts; risky sign-ins (from SigninLogs) |
| Microsoft Defender XDR | Same managed identity | Graph application permission `SecurityIncident.Read.All` | Incidents, if Sentinel is not connected |
| Microsoft Defender for Endpoint | Same managed identity | WindowsDefenderATP application permissions `Machine.Read.All`, `Vulnerability.Read.All` | Vulnerabilities by asset type (servers, workstations, mobile), overdue against your deadlines, average age, most exposed hosts, most common weaknesses |
| Microsoft Defender for Cloud | Same managed identity | Security Reader on each subscription | Secure score card, cloud findings by severity, plan coverage |
| Microsoft Entra ID | Same managed identity | Graph application permission `IdentityRiskyUser.Read.All` (Entra ID P2) | Users at risk |
| SentinelOne (EDR) | Service user, Viewer role on the sites in scope | API token (expires; set a rotation reminder) | Unresolved threats card, threats by week, endpoints with unresolved threats, agent coverage, agents infected or out of date, agents by servers and workstations |
| CyberArk | Privilege Cloud: OAuth2 service user in CyberArk Identity. Self-hosted: Vault user | An auditor-style role with list-only rights. Never a role that can retrieve passwords. Discovered accounts need Vault Admins; without it that figure is skipped | Privileged accounts not onboarded (or not automatically managed), vaulted accounts by platform |
| Mimecast | API 2.0 application with a custom role | Monitoring read for URL Protection, Attachment Protection, Impersonation Protection; Awareness Training dashboard read | Phishing blocked (malicious links, attachments, impersonation), malicious links clicked, simulated campaign results |
| Netskope | REST API v2 token | READ on `/api/v2/events/dataexport/alerts/dlp`; optionally on `/api/v2/events/dataexport/events/application` | Data loss violations by week, kind of data involved, people with most violations; optionally risky apps and their users |
| Defender advanced hunting | Same managed identity | WindowsDefenderATP `AdvancedQuery.Read.All`, `Score.Read.All`; Graph `SecurityEvents.Read.All` | Unsupported software, exploitable weaknesses on internet-facing devices, exposure score and secure score (Infrastructure page) |
| Joe Sandbox | Read-only API key (`JOE_API_KEY`; `JOE_API_URL` for an on-premise server) | Analysis list and info only | Verdicts and scores for detonated files and links |
| GitLab | Service account with group access token | `read_api` scope, Security Manager or Developer on the groups (Ultimate) | Code findings by severity |

Granting Microsoft application permissions to a managed identity is done with PowerShell or
the Graph API (the portal does not offer it for managed identities); your Entra admin will
know the routine. Admin consent is required.

## What is live, what is not: the Data sources page

Every system and data item is listed in `secops_mcp/catalog.default.json` with its route, what it
needs and the page it feeds. The Data sources page (and the `data_catalog` tool in Claude) shows
each item as live, ready to connect, to build, needs licence, to confirm or not possible, and a
Sentinel feed-health table shows which connector tables are arriving, late or silent. Copy the
catalogue to the data folder as `catalog.json` to change it. `DATA-AVAILABILITY.md` explains each entry.

## Cloud risks, DevSecOps and SAP: straight from Sentinel

These three pages read only from the Sentinel workspace, so they fill as each feed arrives in
the SIEM. Every figure is a query in `secops_mcp/domains.default.json`; copy it to the data
folder as `domains.json` to change a query, a label, or to add a page.

| Page | Feed into Sentinel | Tables and functions queried |
|---|---|---|
| Cloud risks | Defender for Cloud continuous export (recommendations, secure score); Orca Security Alerts connector; Defender for Cloud alerts | `SecurityRecommendation`, `SecureScores`, `OrcaAlerts_CL`, `SecurityAlert` |
| DevSecOps | Defender for Cloud DevOps security connected to GitLab or GitHub, exported to Sentinel | `SecurityRecommendation` (code, secrets, dependencies, infrastructure templates, container images) |
| SAP (planned) | Microsoft Sentinel solution for SAP applications and its data connector agent | `SecurityAlert` (alerts named "SAP - ..."), `SAPAuditLog` function |

- Each page shows "Some figures on this page are sample data" until its queries return rows,
  and the sidebar counts it among the sample sections.
- SAP stays "Planned" with a list of what it will show. When data arrives, set its `status` to
  `live` in `domains.json`; the page, its area card on the Overview and its sidebar dot appear.
- Table and column names follow Microsoft's connector documentation. Run each query once in
  the Sentinel Logs blade before relying on it; Orca's columns carry `_s` and `_d` suffixes.
- To add another page (for example OT, identity governance, or a business unit): add a domain
  with an id, title, icon and its queries. No code.

## How the figures get into the dashboard

- Systems that report events (Sentinel, Defender XDR, SentinelOne threats, Netskope, Mimecast)
  are counted per week, Monday to Sunday, for the last 12 **completed** weeks. The week in
  progress is left out so a mid-week refresh does not look like a sudden drop.
- Systems that only report "now" (Defender for Cloud score, CyberArk counts, open
  vulnerabilities) are recorded each week in `/app/snapshots/history.json`. Their 12-week lines
  fill in as the weeks pass; until then the line is flat.
- Each section of the page says where it came from: live, export or sample. The sidebar shows
  how many sections are still on sample data, and the API's `_systems` field says which systems
  answered on the last refresh.
- If one system fails, only its figures fall back; the rest of the page still updates.

## Your deadlines

`SECOPS_SLA_DAYS=critical=15,high=30,medium=90,low=180` sets how many days each severity has
before it counts as overdue. Change it to your vulnerability policy.

## Adding another system

Two ways, from simplest:

1. **Measure only.** If the system feeds Sentinel or can export a CSV, add an entry to
   `metrics.json` (see the README). No code.
2. **New connector.** Add a file in `secops_mcp/sources/` with a `summary()` function that returns
   counts, add one line to `sources/registry.py` (what it needs and a cheap check call), and,
   if it should fill an existing section, one function in `secops_mcp/live.py`. The existing
   connectors are 50 to 100 lines each and are the template to copy.

Systems most teams add next: Microsoft Intune (device compliance), Tenable or Qualys
(vulnerabilities), ServiceNow or Jira (remediation tickets and due dates), KnowBe4 (awareness
training), Okta (sign-in risk).

## Outbound: Teams, ServiceNow, Jira and email

The workflows are the only part of the system that writes anywhere, and only once
`SECOPS_ACTIONS_ENABLED=true`.

| Target | Identity | Least access |
|---|---|---|
| Teams | A Workflows (Power Automate) "post to channel when a webhook request is received" flow per channel | The webhook URL is a secret; keep it in Key Vault |
| ServiceNow | Integration user | `itil` role, or a custom role that can only create incidents |
| Jira | Service account API token | Create issues in the named projects only |
| Email | The container's managed identity | Graph `Mail.Send` application permission, restricted by an application access policy to the one sending mailbox |
