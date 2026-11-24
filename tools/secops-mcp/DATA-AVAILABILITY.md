# What data each system can give the dashboard

What is possible, what needs an extra licence or setup, and what is not possible, for every
system on the list. November 2026. "Built" means a connector or query exists in this repository
and has passed simulated tests; none has yet been run against your own tenants.

Key: **Yes** available with the access listed. **Licence** needs a plan or add-on you may not
have. **Setup** needs a connector or export configured first. **No** not possible, or not sensibly.

## Summary

| System | Best route into the dashboard | Built here | Main gaps |
|---|---|---|---|
| Microsoft Sentinel (SIEM) | Log Analytics query API | Built | Only holds what is sent to it; retention limits history |
| Microsoft Defender XDR / for Endpoint | Graph security API, Defender API and advanced hunting | Built (incl. unsupported software, exposed weaknesses, scores) | Vulnerability tables are not in Sentinel; some inventory needs the Defender Vulnerability Management add-on |
| Microsoft Defender for Cloud | Azure Resource Graph, or export to Sentinel | Built | Attack paths and AI posture need the Defender CSPM plan |
| Microsoft Entra ID | Graph API, or sign-in logs in Sentinel | Built (risky users); sign-in locations via Sentinel | Risk data needs Entra ID P2 |
| SentinelOne (EDR) | Management API v2.1; or its Sentinel connector | Built | Application vulnerabilities need the Vulnerability Management (Ranger Insights) licence |
| CyberArk | Privilege Cloud / PVWA API; events by syslog to Sentinel | Built | Discovery figures need extra rights; passwords never |
| Mimecast | API 2.0; or its Sentinel connector | Built | No confirmed API for the SAFE score |
| Netskope | REST API v2 data export; or its Sentinel connector | Built | Gen AI detail depends on licensed features |
| GitLab | GraphQL and REST API | Built (counts by severity) | Vulnerability management needs GitLab Ultimate |
| Orca | Its Sentinel connector (OrcaAlerts_CL); or Orca API | Via Sentinel | Direct API connector not built |
| SecurityBridge (SAP) | Its Sentinel connector (SecurityBridge_CL) | Planned page | API export details not public; confirm with vendor |
| Bowbridge (SAP anti-virus) | Custom feed (event handler or log forward) into Sentinel | No | No documented Sentinel connector or syslog format |
| Cloudflare | Logpush to Azure storage, Sentinel connector (CloudflareV2_CL) | Planned page | Field set depends on plan |
| Joe Sandbox | Its API, or its Defender integration | Built (API) | No native Sentinel connector |
| MSSP / managed SOC | Sentinel incidents they own; their ticket export | Built (from Sentinel) | Their internal triage is invisible unless shared |
| AI use | Netskope, Defender for Cloud Apps, Purview DSPM for AI | Sample only | Each source needs its own licence |
| Red team, pen tests, attack simulation | Engagement exports; simulation platform API | Sample only | Reports are documents, not data, unless exported |
| Sites and offices | offices.json, joined by office tag or IP range | File built; joins not built | Needs a site list and a way to map devices and users to sites |
| "EDR W4C" | Unknown | No | Product not identified; please confirm the name |

## By system

### Microsoft Sentinel (SIEM)

| Data | Possible | Notes |
|---|---|---|
| Incidents: severity, status, owner, classification, tactics, created/first-modified/closed times | Yes | `SecurityIncident`. Gives detect, acknowledge, contain and close times, and SLA per severity and per owner (including the MSSP) |
| Alerts by product and rule, false-positive rate by rule | Yes | `SecurityAlert` plus incident classification |
| Analytics rules and their ATT&CK mapping (coverage) | Yes | Sentinel REST API |
| Automation and playbook runs (share closed by automation) | Yes | `SentinelHealth`, incident comments and closing classification |
| Ingestion volume and cost by source, against 200 GB/day | Yes | `Usage` table |
| Feed health: late or silent sources | Yes | `SentinelHealth`, last-record time per table |
| Sign-in failures and locations (attack origins, risky sign-ins) | Setup | Needs the Entra ID connector (`SigninLogs`) |
| Anything from another product | Setup | Only once that product's connector sends data |
| History older than retention | No | Set retention or archive to keep 12 months and more |
| Defender vulnerability data | No | Not ingested into Sentinel; use the Defender API |

### Microsoft Defender XDR and Defender for Endpoint

| Data | Possible | Notes |
|---|---|---|
| Incidents and alerts across endpoint, email (MDO), identity, cloud apps | Yes | Graph security API, `SecurityIncident.Read.All` |
| Device inventory: OS, type, exposure level, onboarding and sensor health | Yes | Defender API, `Machine.Read.All` |
| Vulnerabilities by device, severity, first seen, exploit available | Yes | `Vulnerability.Read.All`; Defender for Endpoint P2 core vulnerability management |
| Secure score and exposure score | Yes | Graph `secureScores`; Defender API |
| Unsupported (end-of-support) software | Yes, check tier | The end-of-support tag is in the software inventory; confirm the licence tier with Microsoft |
| Browser extensions, certificates, network shares, firmware assessment | Licence | Defender Vulnerability Management add-on |
| Attack paths and critical assets (Exposure Management) | Licence | Exposure Management; advanced hunting `ExposureGraph` tables |
| Advanced hunting beyond 30 days | No | Hunting keeps 30 days; stream to Sentinel for longer |

### Microsoft Defender for Cloud

| Data | Possible | Notes |
|---|---|---|
| Secure score, recommendations by severity and resource, regulatory compliance | Yes | Resource Graph, Security Reader |
| Cloud security alerts | Yes | Also flows to Sentinel |
| DevOps security for GitLab/GitHub (code, secrets, dependencies, IaC, containers) | Setup | Connect the DevOps connector |
| Attack paths, cloud security explorer, AI security posture | Licence | Defender CSPM plan |
| Data in other clouds (AWS, GCP) | Setup | Connect each cloud account |

### Microsoft Entra ID

| Data | Possible | Notes |
|---|---|---|
| Risky users and risk detections | Licence | Entra ID P2, `IdentityRiskyUser.Read.All` |
| Sign-in logs with location, MFA result, Conditional Access result | Licence | P1 or P2; best via the Sentinel connector |
| MFA registration coverage | Yes | Graph reports |
| Privileged role assignments | Yes | Graph; PIM details need P2 |

### SentinelOne (EDR)

| Data | Possible | Notes |
|---|---|---|
| Threats: status, verdict, analyst verdict, mitigation, affected endpoint | Yes | Management API v2.1, Viewer role |
| Agents: coverage, version, health, infected, last seen | Yes | |
| Activities (audit trail) | Yes | |
| Application and OS vulnerabilities (EPSS, KEV) | Licence | Singularity Vulnerability Management (formerly Ranger Insights) |
| Unmanaged devices found on the network | Licence | Ranger network discovery |
| Deep Visibility / hunting queries | Licence | Depends on plan; rate-limited |

### CyberArk

| Data | Possible | Notes |
|---|---|---|
| Vaulted accounts by platform and safe; managed and not managed by the CPM; last verified and last rotated | Yes | Auditor-style, list-only user |
| Privileged sessions and recordings (PSM) | Yes | Counts and metadata |
| Risky privileged activity (Privilege Threat Analytics) | Setup | Send PTA/EPV events by syslog to Sentinel |
| Discovered accounts not yet onboarded | Licence | Discovery feature, extra rights |
| Passwords or secrets | No | By design; never request retrieve rights |

### Mimecast

| Data | Possible | Notes |
|---|---|---|
| Malicious links blocked and clicked (URL Protect), attachments, impersonation | Yes | API 2.0 TTP logs |
| Message tracking and delivery outcomes | Yes | |
| Phishing simulation results per campaign and per person (clicks, reports, training) | Yes | Awareness Training endpoints, Dashboard Read permission |
| Time-stamped user reports of simulated phishing | Yes | Added to API in 2025 |
| SAFE score per person | Check | No API endpoint confirmed; CSV export possible |
| Email content | No | Not requested by design |

### Netskope

| Data | Possible | Notes |
|---|---|---|
| DLP incidents: policy, kind of data, user, app | Yes | Data export API v2 |
| Risky and unapproved apps with Cloud Confidence Index, users, upload volume | Yes | Application events |
| Generative AI app use and data sent to it | Yes, check features | App category in events; DLP on AI depends on licensed features |
| Malware, compromised credentials, user behaviour alerts | Licence | UEBA and threat protection features |

### GitLab

| Data | Possible | Notes |
|---|---|---|
| Open findings by project and severity: SAST, DAST, dependencies, containers, secrets, IaC | Licence | Vulnerability report needs Ultimate |
| Time to fix by severity, introduced against fixed | Licence | Vulnerability history (Ultimate) |
| Which projects run security scanning | Yes | Pipeline and security configuration |
| Audit events | Licence | Premium or Ultimate |

### Orca

| Data | Possible | Notes |
|---|---|---|
| Alerts by risk score, asset, category; attack paths; compliance | Yes | Orca API; Sentinel connector (`OrcaAlerts_CL`) |
| Vulnerabilities on cloud workloads | Yes | |

### SecurityBridge (SAP)

| Data | Possible | Notes |
|---|---|---|
| SAP threat detection events | Yes | Sentinel connector (Log Ingestion API, `SecurityBridge_CL`) |
| Missing SAP security notes, configuration findings, ABAP code findings | Check | In the product; confirm export to Sentinel or by API with SecurityBridge |

### Bowbridge (SAP anti-virus)

| Data | Possible | Notes |
|---|---|---|
| Malware found in files uploaded to SAP, blocked active content | Setup | Through its scriptable event handlers or log forwarding into a custom Sentinel table |
| Ready-made Sentinel connector | No | None found; confirm SIEM options with the vendor |

### Cloudflare (later)

| Data | Possible | Notes |
|---|---|---|
| Web attacks blocked by the WAF, firewall events, HTTP requests | Yes | Logpush, now on all plans with usage-based pricing; fields vary by plan |
| Bot management and DDoS detail | Licence | Depends on plan and add-ons |
| Zero Trust (Access, Gateway) logs | Setup | Only if you use Cloudflare Zero Trust |

### Joe Sandbox

| Data | Possible | Notes |
|---|---|---|
| Verdicts, scores, indicators and ATT&CK techniques per analysis | Yes | Joe Sandbox API |
| Enrichment of Defender alerts | Setup | Joe Security's Defender integration |
| In Sentinel | Setup | Logic App or function writing verdicts to a custom table |
| Volume and trends | Yes | List of analyses through the API |

### MSSP / managed SOC

| Data | Possible | Notes |
|---|---|---|
| Acknowledge and close times, SLA by severity, escalations, true positive rate | Yes | From Sentinel incidents they own (works when they operate in your workspace) |
| Whether escalations needed action | Setup | Agree a ticket export with the provider |
| What they closed in their own tools without escalating | No | Unless the contract requires them to share it |

### AI use

| Data | Possible | Notes |
|---|---|---|
| Unapproved AI apps, users, data uploaded | Yes | Netskope (Gen AI category) |
| Shadow AI discovery | Licence | Defender for Cloud Apps |
| Sensitive data in AI prompts, Copilot interactions | Licence | Purview DSPM for AI (E5 compliance) |
| Security posture of your own AI services (Azure OpenAI and similar) | Licence | Defender for Cloud, Defender CSPM |

### Red team, pen tests and attack simulation

| Data | Possible | Notes |
|---|---|---|
| Findings, severity, owner, retest result | Setup | CSV or ticket export per engagement |
| Attack steps seen, blocked or missed | Setup | From the red team report, or purple-team results |
| Simulation detection and block rates by ATT&CK stage | Setup | Breach and attack simulation platform API or its Sentinel connector |

## What this means for the dashboard

- Everything marked Built works today against simulated responses. The next step is to run
  `python -m secops_mcp.check` against your tenants and compare a few figures with each console.
- The quickest wins are the Sentinel connectors you already own: Entra ID sign-ins, SentinelOne,
  Mimecast, Netskope, Orca and SecurityBridge. Each fills a page with no new code.
- Before promising anything below, check your licences: Defender Vulnerability Management
  add-on, Defender CSPM, Entra ID P2, GitLab Ultimate, SentinelOne Vulnerability Management,
  Purview DSPM for AI.
- The sections shown as sample on the dashboard today are: AI use, red team and testing, agent
  activity, site figures, and the SAP and web edge pages.

## Sources

- Microsoft: Defender Vulnerability Management capabilities and FAQ; Sentinel SAP partner
  solutions; SecurityBridge connector for Sentinel.
- Cloudflare: Logpush datasets and changelog (Logpush on all plans).
- Mimecast: API 2.0 Awareness Training endpoints; 2025 service update on reporting data.
- SentinelOne: Singularity Vulnerability Management (Ranger Insights).
- bowbridge: Anti-Virus Cloud quick start and datasheet.
