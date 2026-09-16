# Security by design

Security is a product requirement (spec §12). This is what the MVP does today and what is deferred.

## Identity and sessions
- Auth.js v5. Credentials (bcrypt) for the prototype; Microsoft Entra ID OIDC when configured. SSO users must be pre-provisioned; sign-in never creates tenants.
- JWT sessions, HttpOnly, SameSite=Lax, 8-hour max age. Sign-out clears the session.
- `User.mfaEnabled` is recorded and surfaced; enforcement via the IdP (Entra) is the enterprise path. TOTP/passkeys are a later phase.

## Authorisation
- Route-level: `middleware.ts` redirects unauthenticated users and blocks partners/clients from internal routes (`canAccessPath`).
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
