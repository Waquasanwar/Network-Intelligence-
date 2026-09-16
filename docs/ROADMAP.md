# Roadmap

Phases follow the master specification. **Phase 0 and Phase 1 are implemented in this repository.**

| Phase | Name | Goal | Key deliverables | Exit criteria | Status |
| --- | --- | --- | --- | --- | --- |
| 0 | Founder Network OS | Replace memory, spreadsheets and scattered messages | People; relationships; conversations; opportunities; dashboard; manual recommendation; scheduling (manual / live Outlook); Amana workspace | 50 people; 20 conversations; weekly use; 3 real opportunities managed | **Built** |
| 1 | AI-Assisted Intelligence | Make conversations searchable and matchable | Transcript upload; structured extraction; human approval; natural-language search; reconnect engine; stale-status detection; matching; evidence-gap detection | 150 profiles; 75 conversations; first successful introduction via platform | **Built** (heuristic provider offline; hosted model behind `AI_PROVIDER`) |
| 2 | Amana Expert Network | Use the network for delivery, proposals and SOW teams | Multi-user; Richard / Soban contributor views; SOW team builder; proposal shortlist; expert bench; engagement history; Amana-only analytics | Live proposal; SOW team assembled through the platform | Foundations built (contributors, bench, team builder, gaps); Amana-only analytics next |
| 3 | Partner Network | Monetise controlled access | Subscriptions; partner portal; requirement intake; anonymised results; identity-reveal approval; commercial tracking; permanent route via licensed recruiter | 3 partners; repeat requirements; paid revenue | Foundations built (portal, redaction, requirements, intro requests, configurable terms); billing next |
| 4 | Direct Client Workspace | Sell directly to clients | Client accounts; problem-led intake; curated recommendations; route recommendation; shortlist feedback; secure collaboration | First direct client engagement | Preview built (client workspace read view) |
| 5 | Member Self-Service | Keep data fresh at source | Own profile; availability; consent; location preference; introduction approval; referrals | 30% of active members self-update | Not started (MEMBER role reserved) |
| 6 | Relocation Advisory | Monetise relocation guidance | Move profile; advisory package; appointment booking; guidance workspace; provider directory; employer-sponsored package; location knowledge base | First paid individual and employer case | Pipeline built (profile, status, funding); packages next |
| 7 | Network Graph Intelligence | Expose relationship paths | Graph; introduction-path analysis; multi-hop discovery; connector analytics; relationship health; dormant opportunities | Useful introduction-path insights | Not started (provenance data already captured) |
| 8 | Engagement Intelligence | Compound evidence from delivery | Post-engagement feedback; delivery evidence; client outcome; repeat-use signals; reference capture; evidence score by context; team-combination history | Evidence improves matching | Not started (evidence model in place) |
| 9 | Workflow Automation | Reduce admin | Triggers; reminders; follow-up automation; stale-profile campaigns; approval workflows; partner SLAs; webhooks | Manual admin materially reduced | Not started (audit actions map to domain events) |
| 10 | Enterprise / SaaS | Licence the platform | Multi-tenancy; branded tenants; white label; billing; SSO; SAML; SCIM; API; MCP / agent interface; warehouse export; enterprise audit; policies | Second non-Amana tenant | Tenant model and SSO hook in place |
| 11 | AI Network Agent | Move from suggestions to prepared work | Call briefs; relationship summaries; suggested introductions; shortlists; evidence gaps; drafted follow-ups; SOW team options | Human-approved agent workflows | Not started; only once data quality is strong |

## MVP acceptance criteria

| # | Criterion | How it is met |
| --- | --- | --- |
| 1 | Add a person in under 60 seconds | Add-person drawer on Overview and Network: name, source, relationship, introducer, expertise, location. |
| 2 | Source and provenance mandatory | `Relationship` created in the same transaction; `sourceType` and `relationshipType` are required by schema and form. |
| 3 | A conversation can be scheduled | Book drawer on every profile: Outlook / Calendly / manual via `SchedulingProvider`. |
| 4 | Notes captured and approved | Capture drawer → AI draft → review form → `approveSummary` with optional profile merge. |
| 5 | Search by relationship, expertise, location, status | Network page: plain-language query parsed to intent, plus explicit filters and saved views. |
| 6 | Opportunity without CV or JD | New-opportunity drawer starts from a problem statement and outcomes. |
| 7 | Platform suggests matches | Matching panel with dimension scores, explanation and uncertainty. |
| 8 | Human must approve any recommendation | `Match.humanDecision`; `approveIntroduction` refuses anything not marked Recommend. |
| 9 | Amana has a dedicated view | `/amana`: bench, SOW-ready, gaps, team builder, history. |
| 10 | Partner records with restricted boundaries | Partner tenants, `redactForPartner`, leak check, portal. |
| 11 | Relocation interest captured | Relocation tab on profile and `/relocation` pipeline. |
| 12 | Audit log records sensitive actions | `AuditLog` written by every action; visible on Security and per-person Activity. |
| 13 | Cross-tenant / partner leak tests pass | `src/lib/authz.test.ts`; browser smoke test verifies partner portal contains no names and internal routes are blocked. |
| 14 | Dashboard shows actionable work | Overview leads with suggested next actions, reconnect queue, review inbox, evidence gaps. |
| 15 | End-to-end demo under 10 minutes | Seeded data covers the full loop: add → book → capture → approve → opportunity → match → decide → introduce → partner view. |
