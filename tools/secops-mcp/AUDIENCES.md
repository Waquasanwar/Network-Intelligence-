# Who needs what: audiences, measures and data sources

The reference for every view in the dashboard. Research, November 2026; sources at the end.
Each measure lists its target where one exists, where the data comes from, and the decision it
supports. A measure that supports no decision does not belong on an executive page.

## Where each audience looks

| Audience | Page in the sidebar | What it adds |
|---|---|---|
| CISO and CIO | Executive view (the landing page) | What the data says (the four most pressing findings, each with why it matters, the next step and an owner), the period totals and Phase 2 outcomes |
| SOC director | SOC director | Managed service against 98%, quality of what reaches the SOC, results by severity, SIEM ingestion by source against 200 GB a day, noisiest rules |
| SOC team | SOC team | The live queue with clocks, at-risk and breached first |
| Infrastructure | Infrastructure | Exploitable and internet-facing first, unsupported software by service, EDR agent gaps, SAP findings, most exposed hosts |
| Engineering | Engineering | GitLab findings by project and type, introduced against fixed, time to fix, secrets, scanning coverage, top weakness types |
| Everyone | Red team and testing | Red team attack path (seen, blocked, missed), techniques blocked/detected/missed by attack stage, open pen test findings and failed retests, attack simulation trend |
| Everyone | Agents | Six agents (triage, exposure, detection, phishing, provider, reporting): schedule, what each may do alone, what it found, and a queue of proposed actions waiting for approval |
| Everyone | AI use, Web edge, SAP | AI apps and data sent to them; Cloudflare (planned); SecurityBridge and Bowbridge (planned) |

Each page opens in Summary: its insights, headline figures, at most two charts and four sections. Full detail, in the bar at the top, shows the rest. The bar shows only the filters that work on that page. Every chart, bar list and ranked table opens a panel with the figures behind what was selected and
a link to the page that explains it. Role data comes from `secops_mcp/personas.py`: provider
performance and SIEM ingestion are live from Sentinel; the rest is sample until its connector is
confirmed, and each page says so.

## Principles

- **Decisions first.** Each view answers the questions its audience must act on. Boards now
  expect risk set against appetite and business impact, not lists of technical counts.
- **Few, stable measures.** Eight to twelve per audience, the same ones every period, each with a
  trend, a target and a sentence of context. Raw counts (alerts, vulnerabilities) are not shown to
  executives without a rate, a target or a direction.
- **Speed and exposure, not volume.** Time to detect, acknowledge and contain, and how long
  exploitable weaknesses stay open, say more than how many alerts arrived.
- **Check the provider against the raw trail.** Managed-service figures are verified against
  Sentinel's own timestamps, not taken from the provider's summary.

## The audiences

### CISO and CIO

Shared purpose: is the organisation within its risk appetite, is the investment working, and what
needs a decision. The CISO owns cyber risk; the CIO owns the technology estate and its cost and
resilience. They need the same page, read from two angles.

| Question | Measure | Target | Source |
|---|---|---|---|
| Are we within appetite? | Top risks against appetite, each with owner and trend | Agreed per risk | Risk register; the ranked risks on the dashboard |
| Is the programme delivering? | Phase 2 outcomes met and realised | Per outcome | outcomes.json, live figures |
| How fast do we stop attacks? | Time to detect, acknowledge, contain; near misses | 15 min / 24 h | Sentinel incidents; threat paths |
| How exposed are critical services? | Exploitable critical findings open on Tier-1 and internet-facing systems; days open | None past deadline | Defender for Endpoint vulnerability API, Defender for Cloud, Cloudflare |
| Is the technology estate supportable? | Systems on unsupported software, by business service | Falling | Defender for Endpoint software inventory (end-of-support) |
| Is SAP safe? | SAP critical findings and security alerts; SAP patch status | None critical open | SecurityBridge, Sentinel solution for SAP, Bowbridge |
| Is the managed service performing? | Service-level adherence, escalation quality, true positive rate | 98% | Sentinel incidents owned by the provider |
| Is the spend under control? | SIEM ingestion per day against the 200 GB design threshold; cost by source | 200 GB a day | Sentinel `Usage` |
| Is AI being used safely? | Unapproved AI apps in use, data sent to AI apps, AI-related policy violations | Falling | Netskope (generative AI category), Defender for Cloud AI posture |
| What needs our decision? | Decisions and actions with owners | — | Worked out from the figures |

Cadence: monthly board pack, weekly one-page report. Decisions: risk acceptance, funding,
escalation with the provider, policy (for example AI use).

### SOC director

Purpose: run the service. Is the SOC (internal and managed) meeting its service levels, is
detection good enough, where is effort wasted, and what is the SOC blind to?

| Measure | Target | Source |
|---|---|---|
| Service-level adherence, by severity and by provider | ≥ 98% | Sentinel incidents (owner, timestamps) |
| Time to acknowledge, detect, contain, by severity | 15 min / — / 24 h | Sentinel incidents |
| True positive rate and false alarms by detection rule | Rising / falling | Sentinel incidents (classification), analytics rules |
| Escalation quality from the managed provider (escalations that were real) | Rising | Sentinel incidents, provider tickets |
| Backlog and age of open incidents | No incident past target | Sentinel incidents |
| Share closed by automation | Rising | Sentinel automation rules and playbooks |
| Detection coverage by ATT&CK stage | Weakest stage rising | Sentinel analytics rules mapped to tactics |
| Source health: which feeds are late or silent | All within 1 h | Sentinel `Usage`, `SentinelHealth` |
| Near misses and what stopped them | Reviewed within 7 days | Threat paths |
| SIEM cost by source; noisy, low-value sources | ≤ 200 GB a day | Sentinel `Usage` |

### SOC team (analysts)

Purpose: work the queue. Live, per incident, nothing aggregated for its own sake.

- The live queue with acknowledge and resolve clocks, at-risk and breached first.
- Per incident: entities, the attack stage reached, related alerts across products, enrichment
  (Joe Sandbox verdicts for files and links, threat intelligence), playbook status.
- Sources that are down, so they know what they cannot see.
- Shift handover: what is open, what is waiting on whom.

### Infrastructure team

Purpose: fix what attackers can use, in the right order, inside the deadlines.

| Measure | Target | Source |
|---|---|---|
| Critical and high findings open on servers, network devices, workstations, cloud | None past deadline | Defender for Endpoint vulnerability API, SentinelOne, Defender for Cloud, Orca |
| Known-exploited and internet-facing first: findings with public exploits on exposed systems | Zero | Defender vulnerability data (exploit flag), Defender for Cloud, Cloudflare |
| Patched inside the agreed time, by team and asset type | ≥ policy | Defender for Endpoint |
| Overdue findings and their age, by owning team | Falling | Defender for Endpoint, scanners |
| Unsupported operating systems and software | Falling | Defender for Endpoint software inventory |
| Endpoints without a working EDR agent, or with an outdated one | Zero | SentinelOne agents, Defender device inventory |
| Cloud misconfigurations by resource and owner | Falling | Defender for Cloud, Orca |
| SAP systems: missing security notes and critical configuration findings | Zero critical | SecurityBridge |

Note: Defender's vulnerability tables are not available in Sentinel, so these figures come from
the Defender API (the `defender_xdr` connector), not from the SIEM.

### Engineering team (GitLab)

Purpose: ship without adding risk, and fix what is found while the code is fresh.

| Measure | Target | Source |
|---|---|---|
| Open findings by project and severity: code, dependencies, secrets, containers, infrastructure templates | Critical: zero past deadline | GitLab vulnerability report |
| Time to fix, by severity (GitLab's 12-week chart) | Per policy | GitLab security dashboard |
| New findings introduced in merge requests against findings fixed | Fixed ≥ introduced | GitLab merge request security widget, vulnerability history |
| Secrets committed | Zero | GitLab secret detection; Defender for Cloud DevOps security |
| Projects with security scanning in their pipelines | 100% of production projects | GitLab security configuration |
| Most common weakness types (CWE) | Falling | GitLab security dashboard |
| SAP custom code (ABAP) findings | Falling | SecurityBridge code scanning |

## The data sources

| Source | Useful data | For | How it reaches the dashboard |
|---|---|---|---|
| Microsoft Sentinel (the SIEM) | Incidents with severity, status, owner, tactics, timestamps; alerts by product; analytics rules; automation runs; `Usage` (ingestion and cost by source); `SentinelHealth` | Everyone | Log Analytics query API (built) |
| SentinelOne (EDR) | Threats and their status, agents (coverage, version, infected), activities; application vulnerabilities | SOC, infrastructure | Management API (built); Sentinel CCF connector tables `SentinelOneThreats_CL`, `SentinelOneAgents_CL`, `SentinelOneActivities_CL` |
| Microsoft Defender XDR / for Endpoint | Incidents and alerts; device inventory with OS and exposure; vulnerabilities by device with severity and first seen; software end-of-support | SOC, infrastructure, CIO | Graph and Defender APIs (built). Vulnerability tables are not in Sentinel |
| Microsoft Defender for Cloud | Secure score, recommendations by severity and resource, DevOps security findings, AI security posture | CISO, infrastructure, engineering | Resource Graph (built); continuous export to Sentinel `SecurityRecommendation`, `SecureScores` |
| Netskope | Data loss incidents by kind of data, risky and unapproved apps, generative AI app use and data sent to it, user risk | CISO, SOC | REST API v2 (built); Sentinel CCF connector (`NetskopeAlertEvents_CL`, web transactions) |
| SecurityBridge | SAP threat detection events, SAP vulnerability and missing patch findings, ABAP code findings, compliance checks | CIO, SOC, infrastructure, engineering | SecurityBridge connector for Sentinel (built by SecurityBridge); queries in the SAP page |
| Bowbridge | Malware found in files uploaded to SAP, blocked active content | SOC, CIO | No confirmed Sentinel connector; forward its events (syslog or the SAP virus-scan log) to a custom table |
| Mimecast | Phishing blocked and delivered, malicious links clicked, impersonation, simulated phishing results, staff reporting | SOC, CISO | API 2.0 (built); Sentinel connector (audit, awareness training tables) |
| Cloudflare (later) | Web attacks blocked by the WAF, bot and DDoS events, exposure of public services | CISO, infrastructure | Logpush to Azure storage, Sentinel codeless connector (`CloudflareV2_CL`) |
| Joe Sandbox | Verdicts, scores and indicators for detonated files and links | SOC | No native Sentinel connector; Joe Security's Defender connector enriches Defender alerts, or a Logic App writes verdicts to a custom table |
| Red team, pen tests, attack simulation | Engagement findings and retest results, attack steps seen or missed, technique outcomes by ATT&CK stage, simulation detection and block rates | CISO, SOC director, infrastructure | Pen test and red team reports (CSV export per engagement); breach and attack simulation platform API or its Sentinel connector |
| MSSP services | Incidents they own: acknowledge and resolve times, escalations and whether they were real, closures without escalation | SOC director, CISO | Sentinel incidents (owner and timestamps); provider ticket export for escalation outcomes |
| AI | Two meanings. AI used across the company: unapproved apps, data sent to them, policy violations (Netskope, Defender for Cloud). AI in the SOC: automated closures, Security Copilot use, the dashboard's own signals, always reviewed by a person | CISO, CIO, SOC director | Netskope, Defender for Cloud, Sentinel automation |

## Gaps to close

- Defender vulnerability data is not in Sentinel; keep the API connector for infrastructure views.
- Sentinel table names differ by connector version for SentinelOne, Netskope and Mimecast; confirm
  each in the workspace before switching a page to live.
- Bowbridge and Joe Sandbox need a small custom feed into Sentinel.
- Escalation quality needs the provider's ticket outcomes; agree an export in the service review.
- Business-service mapping (which systems are Tier-1, which service each serves) is needed for
  the CISO and CIO risk views; hold it as a tag in Defender and Sentinel or as a CSV.
- The EU AI Act's high-risk obligations apply from 2 August 2026; an AI-use inventory is now a
  compliance matter, not only a security one.

## Sources

- Board and executive reporting: EY on risk-informed metrics; IANS on board ratings of CISO
  reporting (2026); IDC on business framing (2026); Gartner on cybersecurity value for CIOs.
- Managed service measurement: DigitalXRAID, N-able, Check Point and SC Media buyer guidance;
  Gartner (2025) on the limits of detection and response service metrics.
- GitLab security dashboards and mean time to remediate (GitLab documentation, 18.6).
- Microsoft: Defender vulnerability table not ingested into Sentinel; Exposure Management attack
  paths; Sentinel SAP solution; SecurityBridge connector; Cloudflare connector.
- Vendor documentation and community pages for SentinelOne, Netskope, Mimecast and Joe Sandbox
  Sentinel connectors (table names vary by version).
- Shadow AI: Cloud Security Alliance research note (May 2026); Netskope Cloud and Threat Report
  (2026, via Cisco).
