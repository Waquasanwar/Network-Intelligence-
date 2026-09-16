# Architecture

## Stack

- **Next.js 15 (App Router)**, React 19, TypeScript. Server Components for reads, server actions for writes. No client-side data fetching layer to secure.
- **PostgreSQL + Prisma 6.** Schema in `prisma/schema.prisma`; migrations in `prisma/migrations`.
- **Auth.js v5.** Credentials provider for the prototype, Microsoft Entra ID (OIDC) when `AUTH_MICROSOFT_ENTRA_ID_*` is set. JWT sessions (8h) carry `tenantId`, `role`, `tenantType`.
- **Tailwind CSS 4** with design tokens in `src/app/globals.css`. Hand-written shadcn-style primitives in `src/components/ui`.
- **Recharts** for the single dashboard chart. **Lucide** icons.
- **Vitest** for the domain layer.

## Layout

```
prisma/               schema, migrations, seed
src/app/              routes (App Router)
  (app)/              authenticated shell: overview, network, conversations, opportunities, amana, partners, relocation, settings, partner-portal, client-workspace
  api/                Auth.js handlers, OAuth callbacks, Calendly webhook, health
  login/  forbidden/
src/components/       ui primitives, app shell (sidebar, command palette), domain components and drawers
src/lib/              framework-free domain logic
  authz.ts            RBAC, tenant checks, partner redaction, leak detection
  matching.ts         per-opportunity matching engine
  availability.ts     freshness / staleness model
  labels.ts           product language for every enum
  audit.ts            audit writer
  ai/                 AIProvider interface, heuristic provider, Anthropic adapter
  scheduling/         SchedulingProvider interface, Manual, Microsoft Graph, Calendly adapters
src/server/           session helpers and server actions (all writes)
```

## Tenant model

| Tenant type | Example | Role(s) | Access |
| --- | --- | --- | --- |
| `PLATFORM_OWNER` | Network Intelligence (founder tenant, hosts the Amana Expert Network workspace) | OWNER, ADMIN, CONTRIBUTOR | Full internal app |
| `RECRUITMENT_PARTNER` | Harbour Search | PARTNER | `/partner-portal` only, redacted data |
| `DIRECT_CLIENT` | Meridian Energy | CLIENT | `/client-workspace` only |
| `CONSULTANCY` | reserved for licensing the platform to another consultancy (Phase 10) | | |

People, opportunities, introductions, scheduled conversations, saved views and audit entries carry `tenantId`. Relationship notes and evidence hang off people and inherit the tenant boundary. The Amana workspace is a view over the founder tenant flagged by `Person.amanaBench`, `Person.usedByAmana` and `Opportunity.isAmana`, which matches how Amana actually uses the founder's network today; it can be split into its own tenant later without changing the data model.

## Core objects

`Person`, `Relationship` (provenance: source, introducer, worked-together, would-work-again, private notes), `Evidence` (observed delivery, references, cautions, with confidence and visibility), `Conversation` (raw notes, transcript, `aiSummary`, `approvedSummary`, approval status, consent reference), `ScheduledConversation`, `SchedulingConnection`, `Opportunity` (problem statement, outcomes, route, budget, capabilities), `Match` (dimension scores, explanation, uncertainty, human decision), `Introduction` (consent, status, route, partner, configurable commercial model), `TeamShortlistMember` (Amana team builder), `Partner`, `PartnerRequirement`, `RelocationProfile`, `SavedView`, `AuditLog`.

## Founder conversation workflow

1. **Add person** (`addPerson`): name, source, relationship type, optional introducer, private notes. Under a minute; provenance is required by the schema and the form.
2. **Book conversation** (`scheduleConversation`): picks a `SchedulingProvider`. Manual always works; Outlook and Calendly create real events when credentials are configured and a connection exists, otherwise record a proposed slot.
3. **Conversation**: natural prompts are shown in the capture drawer, not enforced as a script.
4. **AI structuring** (`captureConversation`): the `AIProvider` returns an `ExtractedSummary` validated by Zod into `Conversation.aiSummary`; status becomes `NEEDS_REVIEW`.
5. **Human approval** (`approveSummary`): the reviewer edits every field in a form; the edited result is stored as `approvedSummary`. Optionally merged into the profile (capabilities, sectors, preferences, availability with a fresh confirmation date and next-check date).
6. **Network intelligence**: the person is searchable and eligible for matching.

## Matching

`retrieveMatches(opportunity, people)` scores each person on ten named dimensions (required capability, preferred capability, observed evidence, relationship provenance, conversation completeness, industry relevance, location/mobility, availability and engagement preference, seniority, commercial fit), produces a weighted per-opportunity fit, a plain-language explanation and a list of uncertainties. Results are capped and only used inside one opportunity. The engine never labels people, never rejects, never touches protected characteristics. `generateMatches` runs authorisation and tenant scoping *before* any AI call, then asks the `AIProvider` for a narrative explanation. The human decision lives on `Match.humanDecision` and is the only thing that enables `approveIntroduction`.

## Provider abstractions

```ts
interface SchedulingProvider { connect; disconnect; getAvailability; createMeeting; updateMeeting; cancelMeeting; requestedScopes; isConfigured }
interface AIProvider { structureConversation; explainFit; parseSearch }
```

`getAIProvider()` and `getSchedulingProvider()` are the only places that know about vendors. The heuristic AI provider is deterministic and offline so the full workflow can be demonstrated and tested without network access; the Anthropic adapter wraps transcripts as untrusted data, validates output against the same schema and falls back to the heuristic provider on failure.

## Events (future)

Domain events listed in the spec (PersonCreated, ConversationCompleted, SummaryApproved, StatusBecameStale, OpportunityCreated, MatchApproved, IntroductionApproved, PlacementConfirmed, RelocationRequested) map one-to-one onto existing audit actions, so an outbox can be added later without changing call sites.
