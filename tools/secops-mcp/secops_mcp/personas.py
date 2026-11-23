"""Data for the role views (see AUDIENCES.md) that the other modules do not already hold:
managed SOC provider performance, SIEM ingestion and cost by source, AI use, infrastructure
exposure and engineering findings by project.

Live where Sentinel can answer (provider performance, ingestion); the rest is sample until its
connector is confirmed, and every block says which it is.
"""

from __future__ import annotations

import logging
import os
import random

from .ops import config
from .sources import sentinel
from .sources.base import NotConfigured

log = logging.getLogger("secops-mcp.personas")

MSSP_KQL = """
let provider = "{provider}";
SecurityIncident
| where CreatedTime > ago(84d)
| summarize arg_max(TimeGenerated, *) by IncidentNumber
| where tostring(Owner.assignedTo) has provider or tostring(Owner.userPrincipalName) has provider
| extend week_ending = startofweek(CreatedTime - 1d) + 7d
| where week_ending < startofday(now())
| summarize incidents = count(),
    within = countif(Status == "Closed" and datetime_diff("hour", ClosedTime, CreatedTime) <= iff(Severity == "High", 4, 24)),
    closed = countif(Status == "Closed"),
    true_pos = countif(Classification == "TruePositive"),
    ack_min = avg(datetime_diff("minute", FirstModifiedTime, CreatedTime))
  by week_ending
| order by week_ending asc
"""
USAGE_KQL = "Usage | where TimeGenerated > ago(30d) and IsBillable == true | summarize gb = sum(Quantity) / 1024 by DataType, day = startofday(TimeGenerated)"


def _sample() -> dict:
    rnd = random.Random(5)
    weeks = 12
    sla = [round(min(99.5, 91 + i * 0.55 + rnd.gauss(0, 0.8)), 1) for i in range(weeks)]
    mssp = {"provider": os.environ.get("SECOPS_MSSP_NAME", "Managed SOC"), "source": "sample",
            "sla_pct": sla, "true_positive_pct": [round(52 + i * 1.1 + rnd.gauss(0, 2), 1) for i in range(weeks)],
            "ack_minutes": [round(max(6, 14 - i * 0.45 + rnd.gauss(0, 1)), 1) for i in range(weeks)],
            "escalations": [rnd.randint(18, 30) for _ in range(weeks)], "escalations_real_pct": [round(min(95, 61 + i * 1.6 + rnd.gauss(0, 3)), 1) for i in range(weeks)],
            "by_severity": [{"severity": "High", "incidents": 42, "within_pct": 95.2, "ack_minutes": 7.8},
                            {"severity": "Medium", "incidents": 188, "within_pct": 97.9, "ack_minutes": 10.4},
                            {"severity": "Low", "incidents": 251, "within_pct": 99.2, "ack_minutes": 16.1}],
            "closed_by_automation_pct": [round(18 + i * 1.4 + rnd.gauss(0, 1), 1) for i in range(weeks)]}
    sources = [("Microsoft Defender XDR", 46.2, "High"), ("SentinelOne", 31.5, "High"), ("Netskope web transactions", 38.9, "Medium"),
               ("Microsoft Entra ID sign-ins", 22.4, "High"), ("Firewall logs", 29.7, "Low"), ("Mimecast", 6.1, "High"),
               ("Microsoft Defender for Cloud", 2.3, "High"), ("SecurityBridge (SAP)", 4.8, "High"), ("GitLab audit", 0.6, "Medium"), ("Other", 3.5, "Low")]
    daily = [round(158 + i * 0.6 + rnd.gauss(0, 6), 1) for i in range(30)]
    siem = {"source": "sample", "threshold_gb": 200, "daily_gb": daily,
            "by_source": [{"source": s, "gb_per_day": g, "detection_value": v} for s, g, v in sources]}
    ai = {"source": "sample", "apps_in_use": 61, "unapproved": 38, "users": 1420, "data_to_ai_mb_week": [round(820 + i * 55 + rnd.gauss(0, 60)) for i in range(weeks)],
          "violations": [round(38 + i * 2.2 + rnd.gauss(0, 4)) for i in range(weeks)],
          "top_apps": [{"app": "ChatGPT (personal accounts)", "users": 612, "approved": False, "upload_mb": 1840},
                       {"app": "Microsoft 365 Copilot", "users": 980, "approved": True, "upload_mb": 0},
                       {"app": "Claude (enterprise)", "users": 240, "approved": True, "upload_mb": 0},
                       {"app": "Gemini (personal accounts)", "users": 133, "approved": False, "upload_mb": 410},
                       {"app": "AI PDF and file converters", "users": 96, "approved": False, "upload_mb": 760},
                       {"app": "AI meeting note-takers", "users": 54, "approved": False, "upload_mb": 220}]}
    infra = {"source": "sample",
             "exploitable_exposed": [{"host": "NET-FW-EDGE-02", "cve": "CVE-2026-1001", "what": "VPN gateway remote code execution", "days_open": 19, "team": "Infrastructure"},
                                     {"host": "SRV-WEB-033", "cve": "CVE-2026-1005", "what": "Web server request smuggling", "days_open": 11, "team": "Customer Apps"},
                                     {"host": "SRV-APP-114", "cve": "CVE-2026-1008", "what": "Logging library remote code execution", "days_open": 6, "team": "Customer Apps"}],
             "end_of_support": [{"software": "Windows Server 2012 R2", "devices": 14, "service": "Finance reporting"},
                                {"software": "Windows 10 (out of servicing)", "devices": 212, "service": "Corporate workstations"},
                                {"software": "Red Hat Enterprise Linux 7", "devices": 9, "service": "Warehouse management"},
                                {"software": "SAP NetWeaver 7.40 (unsupported support pack)", "devices": 3, "service": "SAP ERP"},
                                {"software": "Java 8 runtime", "devices": 61, "service": "Various"}],
             "edr": {"devices": 9100, "no_agent": 364, "outdated_agent": 287, "infected": 7},
             "sap": {"systems": 11, "missing_security_notes": 23, "critical_config_findings": 6, "malware_uploads_blocked_30d": 4}}
    projects = [("customer-portal", 3, 18, 2, 21, 9, 4, 1, 12.5, True, 9, 14), ("payments-api", 2, 11, 1, 9, 6, 3, 2, 6.1, True, 4, 7),
                ("data-pipeline", 1, 14, 0, 15, 4, 0, 3, 18.2, True, 6, 5), ("mobile-app", 0, 9, 0, 11, 5, 0, 0, 9.4, True, 3, 6),
                ("infra-terraform", 0, 6, 1, 0, 0, 0, 8, 7.0, True, 2, 4), ("auth-service", 1, 5, 0, 4, 3, 2, 0, 4.8, True, 1, 3),
                ("legacy-intranet", 2, 12, 3, 17, 7, 0, 0, 41.0, False, 5, 0), ("sap-abap-custom", 1, 7, 0, 0, 8, 0, 0, 22.5, False, 2, 1)]
    eng = {"source": "sample",
           "projects": [{"project": p, "critical": c, "high": h, "secrets": s, "dependency": d, "code": cd, "container": ct, "iac": i, "mttr_days": m,
                         "scanning": sc, "introduced_week": iw, "fixed_week": fw} for p, c, h, s, d, cd, ct, i, m, sc, iw, fw in projects],
           "mttr_critical": [round(max(3, 19 - i * 0.9 + rnd.gauss(0, 1.5)), 1) for i in range(weeks)],
           "mttr_high": [round(max(6, 31 - i * 1.1 + rnd.gauss(0, 2)), 1) for i in range(weeks)],
           "introduced": [rnd.randint(28, 44) for _ in range(weeks)], "fixed": [rnd.randint(30, 48) + i for i in range(weeks)],
           "top_cwes": [{"cwe": "CWE-79 Cross-site scripting", "count": 24}, {"cwe": "CWE-89 SQL injection", "count": 9}, {"cwe": "CWE-798 Hard-coded credentials", "count": 7},
                        {"cwe": "CWE-502 Unsafe deserialisation", "count": 6}, {"cwe": "CWE-22 Path traversal", "count": 5}]}
    tactics = [("Initial Access", 6, 3, 2, 1), ("Execution", 7, 4, 2, 1), ("Persistence", 5, 1, 2, 2), ("Privilege Escalation", 6, 1, 2, 3),
               ("Defense Evasion", 8, 1, 2, 5), ("Credential Access", 6, 2, 3, 1), ("Discovery", 5, 0, 1, 4), ("Lateral Movement", 6, 1, 1, 4),
               ("Collection", 3, 0, 1, 2), ("Command and Control", 5, 2, 2, 1), ("Exfiltration", 4, 2, 1, 1), ("Impact", 3, 2, 1, 0)]
    offsec = {"source": "sample",
              "engagements": [
                  {"name": "Annual red team", "type": "Red team", "ended": "2026-10-24", "provider": "External red team",
                   "objective": "Reach the payments database from a phished laptop", "reached": True, "days_to_objective": 3,
                   "steps": 11, "detected_steps": 4, "blocked_steps": 1, "first_detected_step": 6,
                   "findings": {"critical": 2, "high": 5, "medium": 7, "low": 3}, "open": 9, "retested": 5, "retest_passed": 4},
                  {"name": "Customer portal pen test", "type": "Pen test", "ended": "2026-09-30", "provider": "CREST pen test provider",
                   "objective": "Web application and API", "reached": None, "findings": {"critical": 1, "high": 4, "medium": 9, "low": 6},
                   "open": 6, "retested": 8, "retest_passed": 7},
                  {"name": "External perimeter pen test", "type": "Pen test", "ended": "2026-08-15", "provider": "CREST pen test provider",
                   "objective": "Internet-facing services", "reached": None, "findings": {"critical": 0, "high": 3, "medium": 6, "low": 8},
                   "open": 2, "retested": 9, "retest_passed": 9},
                  {"name": "SAP authorisation review", "type": "Pen test", "ended": "2026-07-11", "provider": "SAP security specialist",
                   "objective": "SAP ERP roles and RFC interfaces", "reached": None, "findings": {"critical": 1, "high": 2, "medium": 4, "low": 2},
                   "open": 3, "retested": 4, "retest_passed": 3}],
              "open_findings": [
                  {"id": "RT-03", "title": "Domain admin credentials cached on a jump server", "severity": "Critical", "source": "Annual red team", "owner": "Infrastructure", "days_open": 30, "retest": "Failed"},
                  {"id": "RT-01", "title": "No MFA on the legacy VPN profile", "severity": "Critical", "source": "Annual red team", "owner": "Infrastructure", "days_open": 30, "retest": "Not yet"},
                  {"id": "PT-CP-02", "title": "Broken object-level authorisation on the orders API", "severity": "Critical", "source": "Customer portal pen test", "owner": "Customer Apps", "days_open": 54, "retest": "Not yet"},
                  {"id": "SAP-01", "title": "RFC user with SAP_ALL in production", "severity": "Critical", "source": "SAP authorisation review", "owner": "SAP basis", "days_open": 135, "retest": "Failed"},
                  {"id": "RT-05", "title": "Lateral movement over SMB not alerted", "severity": "High", "source": "Annual red team", "owner": "SOC", "days_open": 30, "retest": "Not yet"},
                  {"id": "PT-EX-04", "title": "Outdated TLS on the partner file transfer service", "severity": "High", "source": "External perimeter pen test", "owner": "Infrastructure", "days_open": 100, "retest": "Not yet"}],
              "tactics": [{"tactic": t, "tested": n, "blocked": b, "detected": d, "missed": m} for t, n, b, d, m in tactics],
              "bas_detected_pct": [round(min(80, 44 + i * 1.6 + rnd.gauss(0, 2)), 1) for i in range(weeks)],
              "bas_blocked_pct": [round(min(60, 21 + i * 0.9 + rnd.gauss(0, 2)), 1) for i in range(weeks)]}
    agents = {"source": "sample", "runs": [
        {"agent": "Triage agent", "does": "Reads every new incident, enriches it (Joe Sandbox, threat intelligence, asset owner) and proposes a severity and next step.",
         "last_run": "4 minutes ago", "checked": 312, "found": "Closed 104 duplicates and known-good alerts; raised 3 incidents to high", "proposed": 2, "mode": "Acts on low risk, asks on the rest"},
        {"agent": "Exposure agent", "does": "Joins vulnerabilities, internet exposure, exploit intelligence and pen test findings to rank what to fix first.",
         "last_run": "1 hour ago", "checked": 18420, "found": "3 exploitable internet-facing weaknesses; 1 matches an open red team finding", "proposed": 3, "mode": "Asks before raising tickets"},
        {"agent": "Detection agent", "does": "Replays red team and attack simulation steps against the detection rules and drafts rules for the gaps.",
         "last_run": "Yesterday", "checked": 64, "found": "Lateral movement over SMB has no working rule; 2 draft rules ready for review", "proposed": 2, "mode": "Drafts only"},
        {"agent": "Phishing agent", "does": "Looks at every reported email, pulls matching messages from other mailboxes and notifies repeat clickers' managers.",
         "last_run": "12 minutes ago", "checked": 146, "found": "Pulled 38 copies of one invoice lure; 2 people clicked", "proposed": 1, "mode": "Acts on confirmed phishing"},
        {"agent": "Provider agent", "does": "Checks the managed SOC's work against Sentinel timestamps and flags breaches and weak escalations.",
         "last_run": "This morning", "checked": 481, "found": "6 high-severity incidents closed late; 5 escalations with no action needed", "proposed": 1, "mode": "Reports only"},
        {"agent": "Reporting agent", "does": "Writes the weekly brief and the board pack from the figures and sends them for approval.",
         "last_run": "Monday 07:00", "checked": 48, "found": "Weekly brief drafted; board pack due 1 Dec", "proposed": 1, "mode": "Asks before sending"}]}
    return {"mssp": mssp, "siem": siem, "ai": ai, "infra": infra, "eng": eng, "offsec": offsec, "agents": agents}


def build(live: bool) -> dict:
    out = _sample()
    if not live:
        return out
    try:
        rows = sentinel.query(MSSP_KQL.replace("{provider}", os.environ.get("SECOPS_MSSP_NAME", "Managed SOC").replace('"', "")))
        if rows and {"within", "closed", "true_pos", "incidents"} <= set(rows[0]):
            m = out["mssp"]
            m.update(source="live", sla_pct=[round(100 * r["within"] / r["closed"], 1) if r["closed"] else None for r in rows],
                     true_positive_pct=[round(100 * r["true_pos"] / r["incidents"], 1) if r["incidents"] else None for r in rows],
                     ack_minutes=[round(r["ack_min"] or 0, 1) for r in rows])
    except NotConfigured:
        return out
    except Exception as exc:  # noqa: BLE001
        log.warning("provider query failed: %s", exc)
    try:
        rows = sentinel.query(USAGE_KQL)
        if rows and {"DataType", "day", "gb"} <= set(rows[0]):
            names = config()["systems_by_table"]
            by_day, by_src = {}, {}
            for r in rows:
                by_day[str(r["day"])[:10]] = by_day.get(str(r["day"])[:10], 0) + r["gb"]
                src = names.get(r["DataType"], r["DataType"])
                by_src[src] = by_src.get(src, 0) + r["gb"]
            days = max(1, len(by_day))
            out["siem"].update(source="live", daily_gb=[round(by_day[d], 1) for d in sorted(by_day)],
                               by_source=[{"source": k, "gb_per_day": round(v / days, 1), "detection_value": ""} for k, v in sorted(by_src.items(), key=lambda x: -x[1])[:12]])
    except Exception as exc:  # noqa: BLE001
        log.warning("usage query failed: %s", exc)
    return out
