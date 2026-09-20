# Network Intelligence Platform

**Known. Not just matched.**

A human-led relationship and expertise intelligence platform. It turns real conversations, trusted introductions, observed delivery evidence and current professional context into a searchable, commercially useful network. It is not a recruitment agency, an ATS, a CV database or an AI screening tool.

> Human relationships create the intelligence. AI makes the intelligence usable. The final judgement stays human.

This repository contains the **MVP (Phase 0 + Phase 1)**: the Founder Network OS with AI-assisted conversation structuring, natural-language search, per-opportunity matching with human approval, the Amana Expert Network workspace, restricted partner access, relocation advisory pipeline, scheduling integrations and security foundations.

## What is in the box

| Area | Route | What it does |
| --- | --- | --- |
| Overview | `/overview` | Actionable dashboard: suggested next actions, my week, reconnect queue, evidence gaps, opportunity intelligence, Amana panel, partner activity, relocation signals, audit trail. |
| Network | `/network`, `/network/[id]` | Table with plain-language search ("programme director available soon who we have worked with, open to Dubai"), filters, saved views. Profile tabs: Overview, Relationships, Evidence, Conversations, Opportunities, Relocation, Activity. Add a person in under a minute; provenance is mandatory. |
| Conversations | `/conversations` | Upcoming, follow-ups, needs review, completed. Capture notes or a transcript, AI structures it, a human edits and approves before anything touches the profile. |
| Opportunities | `/opportunities`, `/opportunities/[id]` | Problem-led intake (no CV, no JD). List and board views. Matching panel scores fit *for this opportunity* across named dimensions with evidence, provenance and explicit uncertainty. Human decision: Recommend / Possible / Need more evidence / Not for this requirement. Introductions require a Recommend and consent; permanent placements route through a licensed partner. |
| Amana Expert Network | `/amana` | Exclusive workspace: trusted bench, SOW-ready experts, capability gaps against live requirements, team builder, engagement history. |
| Partners | `/partners`, `/partner-portal` | Configurable subscription and commercial model per partner (nothing hard-coded). Partner portal shows anonymised results only; identities are revealed after human approval and consent. |
| Relocation | `/relocation` | Advisory pipeline: current and target location, move window, family and school needs, individual or employer funded. Separate from recruitment economics. |
| Settings | `/settings/integrations`, `/settings/security` | Outlook / Calendly / manual scheduling with least-privilege scope display. Users, roles, MFA flag, session details, audit log, retention, data requests. |

## Quick start

Requirements: Node 20+, PostgreSQL 14+.

```bash
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
npm install
npx prisma migrate dev          # creates the schema
npm run db:seed                 # demo tenant, partners, 18 people, opportunities, matches
npm run dev                     # http://localhost:3000
```

Demo accounts (all use password `Password123!`, development only):

| Account | Role | Sees |
| --- | --- | --- |
| `waqas@networkintelligence.local` | Owner | Everything |
| `richard@amana.local`, `soban@amana.local` | Contributors (Amana) | Everything internal |
| `partner@harboursearch.local` | Recruitment partner | Restricted partner portal only |
| `client@meridian.local` | Direct client | Client workspace only |

## Requirements, co-pilot and the client / agency portal

Demand comes from three kinds of paying party, all modelled as **accounts**: direct clients, recruitment agencies, and expert networks such as Amana.

- **Co-pilot** (`/requirements`): type the need in plain words ("2 BAs already in Dubai with a visa, perm, retail banking, AED 360k"). `src/lib/demand.ts` structures it into roles, headcount, route, location, must-be-local, work rights, seniority, sectors, budget, duration and start, lists every assumption it made and every question it could not answer, and retrieves people from the network. Hard requirements (already in the location, work rights, open to the route) are checked and labelled met / unmet / to confirm; nobody is hidden.
- **Requirement detail** (`/requirements/:id`): the brief in their words and in structure, the shortlist with human decisions (candidate → proposed → client interested → introduced → placed), commercial terms for this brief, fee lines, and a preview of exactly what the client sees.
- **Portal** (`/portal`): what a client or agency sees. They submit requirements in plain words (with a preview of how we read them), accept terms, see anonymised cards (opaque reference, capability summary, region, availability band, work-rights status, rate band, evidence summary) and request introductions. Names appear only after introduction and consent. Every card passes `redactForPartner()` and a leak check.
- **Commercials** (`/settings/commercials`): the rate card. Success fee % on permanent placements, referral share of an agency's fee, margin on day rates (or a share of the agency's margin), platform take on Amana expert hours, share of SOW value, flat introduction fee, and optional monthly portal access per account. Every number is editable; each account and each brief can override it. Fees are estimated as briefs are saved and recorded as forecast → agreed → invoiced → paid.

## Loading your own contacts

1. Sign in as the owner and open **Setup → Import contacts** (`/network/import`), or click **Import** on the Network page.
2. Download the CSV template, or export from Excel / Google Sheets / LinkedIn with columns such as `first_name, last_name, email, company, role, city, country, capabilities, source, relationship, introduced_by, notes`. Header names are matched loosely ("Surname", "Job Title", "Skills" all work).
3. Upload the file or paste rows. The preview validates every row, flags duplicates already in the network, and links `introduced_by` to people by name.
4. Confirm. Everyone arrives as *Needs refresh* with you as the relationship owner, so the reconnect queue becomes your call list.

To remove the seeded demo network first and keep your user accounts:

```bash
npm run db:clear-demo
```

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # production build (also lints and typechecks)
npm test             # vitest: matching engine, availability model, partner data boundary, AI extraction
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run db:migrate   # prisma migrate dev
npm run db:seed      # reseed demo data
npm run db:clear-demo # remove demo people/opportunities, keep users and partners
```

## Architecture in one paragraph

Next.js 15 App Router with React Server Components and server actions; PostgreSQL via Prisma; Auth.js v5 with JWT sessions carrying tenant and role; Tailwind 4 with a restrained design system (off-white canvas, deep navy, teal for trusted, amber for attention, red for risk only). Two provider abstractions keep vendors at arm's length: `SchedulingProvider` (Microsoft Graph, Calendly, Manual) and `AIProvider` (a local heuristic provider that works offline, and an Anthropic adapter enabled by `AI_PROVIDER=anthropic`). All authorisation is server-side and object-level; partners only ever receive a redacted projection produced by `redactForPartner()`, and a defensive leak check runs on every partner response. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Product principles enforced in code

- **Provenance is mandatory.** You cannot add a person without a source and a relationship type.
- **Nothing is authoritative until a human approves it.** AI summaries sit in `aiSummary`; the profile only changes from `approvedSummary`.
- **AI retrieves and explains; it does not decide.** Match scores are per-opportunity, never a global ranking; no protected characteristics are inferred; nobody is auto-rejected; every suggestion lists its uncertainty.
- **Availability is a spectrum with a shelf life.** Fourteen statuses, a confirmation date, a confidence and a next-check date; stale statuses are flagged everywhere.
- **Partners never get the black book.** No names, contact details, employers, notes or evidence text before an approved, consented identity reveal.
- **Commercial terms are configuration.** Share percentages and fees live on the partner and introduction records.
- **Sensitive actions are audited.** Login, creates and edits, exports, identity reveals, approvals, permission changes and integration changes.

## Product language

Use *Person, Expert, Network Member, Relationship, Evidence, Conversation, Opportunity, Requirement, Match, Recommendation, Introduction, Engagement, Open to Conversations.*
Avoid *Candidate, Applicant, CV Score, Talent Pool, AI Rejection, Screening Score, Human Resource.*

## MVP acceptance criteria

See [docs/ROADMAP.md](docs/ROADMAP.md#mvp-acceptance-criteria) for the fifteen criteria and how each is met.
