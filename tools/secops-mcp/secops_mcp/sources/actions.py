"""Outbound actions: post to a Teams channel, raise a ServiceNow incident, create a Jira issue,
send an email through Microsoft Graph, or call a webhook.

These are the only parts of the system that write anywhere. They run only when
SECOPS_ACTIONS_ENABLED=true; otherwise the workflow engine records a dry run. Each target system
gets its own least-privilege identity:
  Teams        a Workflows (Power Automate) webhook per channel, URL held as a secret
  ServiceNow   an integration user with the itil role, limited to creating incidents
  Jira         an API token for a service account that can create issues in the named projects
  Email        the managed identity with Graph Mail.Send, restricted by an application access
               policy to the one sending mailbox
"""

from __future__ import annotations

import base64
import os

from .base import TokenCache, client, entra_token, env

_graph = TokenCache()


def teams(webhook_env: str, title: str, text: str, link: str | None = None) -> dict:
    url = env(webhook_env)[webhook_env]
    body = [{"type": "TextBlock", "text": title, "weight": "Bolder", "size": "Medium", "wrap": True},
            {"type": "TextBlock", "text": text, "wrap": True}]
    card = {"type": "AdaptiveCard", "$schema": "http://adaptivecards.io/schemas/adaptive-card.json", "version": "1.4", "body": body,
            "actions": [{"type": "Action.OpenUrl", "title": "Open the dashboard", "url": link}] if link else []}
    with client() as c:
        r = c.post(url, json={"type": "message", "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "content": card}]})
    r.raise_for_status()
    return {"posted": True, "status": r.status_code}


def servicenow(group: str, summary: str, detail: str, priority: str = "2") -> dict:
    cfg = env("SERVICENOW_URL", "SERVICENOW_USER", "SERVICENOW_PASSWORD")
    urgency = impact = {"1": "1", "2": "2"}.get(priority, "3")
    with client() as c:
        r = c.post(cfg["SERVICENOW_URL"].rstrip("/") + "/api/now/table/incident", auth=(cfg["SERVICENOW_USER"], cfg["SERVICENOW_PASSWORD"]),
                   headers={"Accept": "application/json"},
                   json={"short_description": summary[:160], "description": detail, "urgency": urgency, "impact": impact,
                         "assignment_group": group, "category": os.environ.get("SERVICENOW_CATEGORY", "Security")})
    r.raise_for_status()
    res = r.json().get("result", {})
    return {"ticket": res.get("number"), "sys_id": res.get("sys_id")}


def jira(project: str, summary: str, detail: str, issue_type: str | None = None) -> dict:
    cfg = env("JIRA_URL", "JIRA_EMAIL", "JIRA_API_TOKEN")
    token = base64.b64encode(f"{cfg['JIRA_EMAIL']}:{cfg['JIRA_API_TOKEN']}".encode()).decode()
    adf = {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": detail}]}]}
    with client() as c:
        r = c.post(cfg["JIRA_URL"].rstrip("/") + "/rest/api/3/issue", headers={"Authorization": f"Basic {token}", "Accept": "application/json"},
                   json={"fields": {"project": {"key": project}, "summary": summary[:250], "description": adf,
                                    "issuetype": {"name": issue_type or os.environ.get("JIRA_ISSUE_TYPE", "Task")}}})
    r.raise_for_status()
    return {"ticket": r.json().get("key")}


def email(to_env: str, subject: str, text: str) -> dict:
    cfg = env("SECOPS_MAIL_SENDER", to_env)
    token = entra_token(_graph, "https://graph.microsoft.com/.default")
    msg = {"message": {"subject": subject, "body": {"contentType": "Text", "content": text},
                       "toRecipients": [{"emailAddress": {"address": a.strip()}} for a in cfg[to_env].split(",")]}, "saveToSentItems": False}
    with client() as c:
        r = c.post(f"https://graph.microsoft.com/v1.0/users/{cfg['SECOPS_MAIL_SENDER']}/sendMail", headers={"Authorization": f"Bearer {token}"}, json=msg)
    r.raise_for_status()
    return {"sent": True}


def webhook(url_env: str, payload: dict) -> dict:
    url = env(url_env)[url_env]
    with client() as c:
        r = c.post(url, json=payload)
    r.raise_for_status()
    return {"status": r.status_code}
