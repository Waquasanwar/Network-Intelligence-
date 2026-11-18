# Security by design

Security is a product requirement (spec §12). This is what the MVP does today and what is deferred.

## Identity and sessions
- Auth.js v5. Credentials (bcrypt) for the prototype; Microsoft Entra ID OIDC when configured. SSO users must be pre-provisioned; sign-in never creates tenants.
- JWT sessions, HttpOnly, SameSite=Lax, 8-hour max age. Sign-out clears the session.
- `User.mfaEnabled` is recorded and surfaced; enforcement via the IdP (Entra) is the enterprise path. TOTP/passkeys are a later phase.

## Authorisation
- Route-level: `middleware.ts` redirects unauthenticated users and blocks partners/clients from internal routes (`canAccessPath`).
- Pages with no session: `/` (the public page), `/login`, `/join` (needs a sealed invitation) and `/vouch` (needs a sealed, single-use reference link). The public page shows the network's name and its published standard, never who is in it. Its two forms (`applyToJoin`, `sendNeed`) and the referee's answer (`answerReference`) are the only public server actions besides joining; each is throttled per connection, carries a trap field for scripts, and writes only to a holding table (`PublicRequest`) or one reference for one person. Nothing sent in becomes a member, a client or a requirement until someone on the team accepts it. Declining deletes it; the daily retention sweep deletes the rest after 90 to 180 days.
- **Members seeing members.** The community board and member directory are open only to members whose screening has been accepted. A member appears to other members only if they switch on "Show me to other members", and sees others only once they have done the same. Email, phone and LinkedIn are shared only between two members after one accepts the other's request. The team can take any post down.
- **Work shared on the board runs through the network.** Every "work I know about" or "looking for someone" post is also created as a lead in the owner's Requirements, and posting one requires agreeing that it is introduced through the network. A member who shared the work, referred the person or introduced them earns the rate card's share of the fee when someone is placed (`ReferralCredit`); only the owner can mark a share paid.
- **Client and agency search.** Off for every account until the owner switches it on. It shows only people who switched on "Let companies with search access find me", only as anonymised cards keyed to that account (`partnerRef`), twenty at a time, rate-limited and audited. It matches on skills, sectors and place only, never on names, employers or headlines (`src/lib/search-match.ts`), so a client cannot search for someone by name to learn they are in the network. Asking about a card creates a requirement on the client's account with that person marked as the client's interest; the name is released only through the normal consent and approval.
- **The trust framework.** Seventeen of the 22 checks are read from the record; five (email, LinkedIn, met, known personally, qualifications) are confirmed by a person on the team and stored with their name and the date (`Person.checks`), audited on change. No check reads a caution in a member's own view.
- References by link are an outside voice, not a vouch from inside the network: they are counted and shown apart, weighted lower in the trust score, and the team can read every word. A person could forward their own link to a friend, which is why a reference alone never stands in for the other five proofs.
- Object-level: every page and server action loads the record and calls `assertSameTenant` before reading or writing. Cross-tenant lookups return 404, never 403, so record existence is not leaked.
- Role gates: approvals (`canApprove`) are internal only; commercial terms and role changes are OWNER/ADMIN; identity reveal is audited.

## Partner data boundary
- Partners only ever receive `PartnerSafePerson` produced by `redactForPartner()`: opaque reference, capabilities, sectors, seniority, region (country only), availability band, evidence count. No names, contact details, employer, city, notes, evidence text, cautions or ids.
- `containsForbiddenPartnerFields()` walks every partner response and throws if a forbidden key is present. Unit tests assert the boundary (`src/lib/authz.test.ts`).
- Identity reveal requires a human-approved introduction (`Match.humanDecision = RECOMMEND`) and person consent, and writes an `identity.reveal` audit entry.

## AI security
- Transcripts and notes are untrusted input. The heuristic provider only pattern-matches; the Anthropic adapter wraps them in `<transcript>` with an explicit instruction that content is data, validates the output against a Zod schema with length limits, and falls back to the heuristic provider on any failure.
- Authorisation and tenant scoping run before AI context retrieval. No AI write-back: everything lands in `aiSummary` for human review.
- No tenant data is used to train shared models. Provider choice is a single environment variable.

## Data protection
- TLS, encrypted database and object storage, KMS-managed secrets are deployment concerns; `SchedulingConnection.encryptedCredentialReference` stores a KMS reference, never a token.
- `.env` is git-ignored; `.env.example` documents every variable.
- Consent reference on every conversation; export and deletion requests are audited (`person.export`, `data.deletion_request`) and listed on the security page. Retention defaults are displayed; automated enforcement is Phase 9.

## Audit
Logged: `auth.login`, `person.create/update/export`, `relationship.create`, `evidence.create`, `conversation.create/schedule/transcript`, `summary.generate/approve/reject`, `opportunity.create/update`, `match.generate/decide`, `introduction.request/approve`, `identity.reveal`, `partner.requirement/update`, `relocation.update`, `integration.connect/disconnect`, `user.role_change`, `data.deletion_request`, `team.add/remove`.

## Application hardening
- Security headers and a strict CSP in `next.config.ts` (no external scripts, `frame-ancestors 'none'`, `form-action 'self'`).
- Server actions use Zod validation; Prisma parameterises every query.
- CSRF: server actions are origin-checked by Next.js; Auth.js uses its own CSRF token.
- Rate limiting and WAF belong at the edge (Vercel/Azure) for the prototype.

## Secure SDLC
- CI runs lint, typecheck, unit tests, migrations, seed and build against a real Postgres; a separate job runs `npm audit` and gitleaks secret scanning.
- Branch protection, SAST and IaC scanning are to be enabled on the repository/hosting side.

## Deferred to later phases
Row-level security policies in Postgres, automated cross-tenant integration tests against the live app, passkeys, SCIM, SIEM export, retention jobs, per-tenant encryption keys.

## Checked on every test run

`tools/e2e/security.mjs` (part of `npm run test:e2e`) drives the real app and fails if any of these
stops being true:

- every response carries the CSP, frame, content-type, referrer, permissions, HSTS and noindex headers;
- signed out, every private page redirects to sign-in, and private APIs and the retention job refuse;
- a client, an agency and a member cannot open the team's pages or anyone's record by guessing an address;
- repeated wrong passwords from one place are throttled (and each account allows 12 attempts per 5 minutes);
- script typed into the public forms is shown as text and never runs on the team's screens;
- the session cookie is HttpOnly and SameSite, so page scripts cannot read it;
- the installed app's service worker keeps only code and icons on the device, never pages or data.

## Dependencies

`npm audit --omit=dev` reports no known vulnerabilities. Next.js is pinned to a patched release,
PostCSS (including the copy Next.js bundles) is forced to a patched release through `overrides`, and
so is `deepmerge-ts`, which only the Prisma command-line tool uses when it reads its own config.
Re-run the audit before each release.
