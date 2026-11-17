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
| GitLab | Service account with group access token | `read_api` scope, Security Manager or Developer on the groups (Ultimate) | Code findings by severity |

Granting Microsoft application permissions to a managed identity is done with PowerShell or
the Graph API (the portal does not offer it for managed identities); your Entra admin will
know the routine. Admin consent is required.

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
