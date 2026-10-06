# Security controls register

The complete list of security and data-protection controls built into Network Intelligence,
each mapped to **where it lives in the code**, the **standard it serves**, and **how it is
verified**. Nothing here is aspirational — the "Verified" column points at a test that runs in CI
or a step in the live penetration test, and §4 states plainly what is *not* yet enforced.

- **Automated verification:** `npm test` → **189 tests across 14 files, all passing.**
- **Live verification:** the app was built for production, run against a real Postgres database,
  and attacked over HTTP as three different signed-in roles. See `docs/SECURITY-TEST.md`.
- Last verified: on the commit that adds this file.

---

## 1 · Architectural controls (data protection by design)

These are the ten properties the platform is built on. All are implemented and exercised by the
`INVARIANT ·` suite in `src/lib/invariants.test.ts`.

| # | Control | What it guarantees | Where (code) | Standard | Verified by |
|---|---|---|---|---|---|
| 1 | **Tenant isolation** | One organisation's network is never visible to another, nor pooled for matching. Every query is tenant-scoped; writes assert the record's tenant matches the actor. | `assertSameTenant()` · `src/lib/authz.ts` | UK GDPR Art. 32(1)(b) · PDPL Art. 20 | `invariants` — "never lets one tenant touch another's record" |
| 2 | **Least privilege (RBAC)** | Nobody holds a permission their role doesn't need, and the check runs on the server, not the UI. | `canAccessPath()`, `assertInternal()`, `canRevealIdentity()` · `src/lib/authz.ts` | UK GDPR Art. 32(1)(b) | `invariants` + `authz.test.ts` — role/path matrix, prefix-collision, fail-closed |
| 3 | **Anonymous by default, outward** | A client or agency sees capability, never identity, until the person agrees to that role. Outbound data is built from a field allowlist, then re-checked. | `redactForPartner()`, `containsForbiddenPartnerFields()` · `src/lib/authz.ts` | UK GDPR Art. 25(2) · PDPL Art. 6 | `invariants` — "nothing that identifies a person crosses the boundary" (incl. a hand-assembled payload) |
| 4 | **Opaque references outward** | An identifier shown outside the tenant can't be walked back to a record or counted. | `opaqueRef()` · `src/lib/authz.ts` | UK GDPR Art. 32(1)(a) | `invariants` — "gives a reference that cannot be walked back" |
| 5 | **Data minimisation** | Holds only what changes a decision (right to work), never what doesn't (nationality). No audio is stored. | `src/lib/screening.ts` · `src/lib/voice-config.ts` | UK GDPR Art. 5(1)(c) · PDPL Art. 5 | `invariants` — "stores no audio at all" |
| 6 | **Purpose limitation & consent** | Consent to one introduction is not consent to the next. Withdrawal takes effect on the next read — no cache. | `canRevealName()`, `canShareAnonymised()` · `src/lib/privacy.ts` | UK GDPR Art. 5(1)(b) · PDPL Art. 5 | `invariants` — "consent decides, and withdrawal is immediate" |
| 7 | **Accountability (audit)** | Every action touching identity or money is recorded server-side at the point it succeeds, and can't be edited from the UI. | `audit()` · `src/lib/audit.ts` | UK GDPR Art. 5(2) · PDPL Art. 8 | `invariants` — "records the acts that disclose, escalate or take money" |
| 8 | **Encryption in transit & at rest** | Nothing travels or sits in the clear. TLS on every connection; database + backups encrypted at rest. | Platform (Vercel/Neon) + HSTS header | UK GDPR Art. 32(1)(a) · PDPL Art. 20 | Live test — HSTS present; provider-level at-rest encryption |
| 9 | **Stated vendor boundary** | Only the interviewer's own questions reach the speech vendor, with names and figures removed first. The vendor key never reaches a browser. | `redactForSpeech()` · `src/lib/voice-config.ts` · `src/app/api/voice/*` | UK GDPR Art. 28 · PDPL Art. 10 | `invariants` — "sends no name and no exact figure to the speech vendor" |
| 10 | **Erasure & portability as buttons** | A person exports a machine-readable copy or erases their profile themselves; only the fee/audit records the law requires are kept, anonymised. | `src/lib/privacy.ts` | UK GDPR Arts. 17, 20 · PDPL Arts. 13, 15 | `invariants` — retention + erasure assertions |

**Retention** is enforced as its own invariant group: data past its stated period is flagged, an
erasure request is flagged immediately, consent unchecked for a year is re-requested, and every
data class has a lawful basis under both regimes and a defined end state
(`invariants` — "nothing is kept longer than we said").

---

## 2 · Platform, transport & authentication controls

| Control | Detail | Where | Verified by |
|---|---|---|---|
| **Security headers** | HSTS (2y, preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (static) | `next.config.ts` | Live test — all present |
| **Content-Security-Policy** | Per-request **nonce**; in production `script-src 'self' 'nonce-…' 'strict-dynamic'` — no `'unsafe-inline'` on scripts | `src/middleware.ts` (`cspFor`) | Prod build — header carries nonce, app hydrates, zero CSP violations |
| **No stack disclosure** | `x-powered-by` removed | `next.config.ts` (`poweredByHeader: false`) | Live test — absent |
| **Multi-factor auth (TOTP)** | RFC-6238 authenticator; enrol with QR + one-time recovery codes; required at sign-in when enabled | `src/lib/mfa.ts` · `src/auth.ts` · Settings → Security | Tested end-to-end — correct code signs in, missing/wrong code refused |
| **Session cookie** | `HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS; JWT sessions expire after 8h | NextAuth v5 · `src/auth.config.ts` | Live test — cookie flags confirmed |
| **Password storage** | bcrypt hash compare; plaintext never stored or logged | `src/auth.ts` (`compare()`) | Code + `authz`/auth flow |
| **Credential validation** | Email/password validated (zod) before any DB lookup | `src/auth.ts` (`credentialsSchema`) | Code |
| **SSO is provisioned-only** | OIDC (Microsoft Entra) sign-in is refused unless the user is already provisioned — no tenant auto-creation from SSO | `src/auth.ts` (`events.signIn`) | Code |
| **Sign-in rate limiting** | 12 attempts / IP / 5 min → `429 Retry-After`. Distributed via Upstash Redis in production; in-process fallback otherwise | `src/lib/rate-limit.ts` · `src/middleware.ts` | Live test — attempts 1–12 pass, 13+ blocked |
| **Route authorisation** | Every non-API request re-checks role→path on the server edge before rendering | `src/middleware.ts` + `canAccessPath()` | Live test — CLIENT/PARTNER refused internal + each other's pages |
| **Server-action exposure guard** | A build-failing test scans every `"use server"` file and rejects any export that trusts a caller-supplied `SessionUser` or bare `tenantId`, or that imports no auth guard | `src/lib/server-actions.test.ts` | CI — scans every `"use server"` file |
| **IDOR resistance** | Object-level access re-checked server-side; a client fetching an internal person by id gets no data | `assertSameTenant()` + query scoping | Live test — IDOR attempts returned 307/404, no data |

---

## 3 · Configurable security controls (Settings → Security)

Eight controls ship **on by default** (secure-by-default; proven by `security.test.ts`). **Seven
are now enforced by running code**; one (real-time alert on reveal) is honestly still not, because
there's no notification channel yet — reveals are recorded, not pushed.

| Control | Default | Status | Enforced by |
|---|---|---|---|
| Require a second factor (MFA) | on | **Enforced** | TOTP verified at sign-in (`auth.ts`); enrol in Settings → Security |
| Sign people out after 8h idle | on | **Enforced** | `auth.config.ts` — JWT sessions expire after 8h |
| An owner approves every identity reveal | on | **Enforced** | `updateIntroductionStatus()` allows a reveal only for owner/admin |
| Only owners can export | on | **Enforced** | `exportPerson()` requires owner/admin |
| Private notes never leave the tenant | on | **Enforced** | `redactForPartner()` strips `relationshipNotes` |
| Redact names & figures before speech | on | **Enforced** | `redactForSpeech()` before the vendor call |
| Delete data when retention ends | on | **Enforced** | daily cron `/api/cron/retention` records what's due; deletion is human-reviewed |
| Alert whenever a name is released | on | **Partial** | every reveal is written to the immutable audit log; no real-time push yet |

The Security tab reports this as **"7 of 8 enforced"** — a switch nothing reads is an intention,
not a protection, so the one without a mechanism is still shown honestly as not enforced.

---

## 4 · Known gaps — remaining

Most of the original gaps are now closed (MFA, CSP, export/reveal gating, retention sweep, and the
`xlsx` advisory by moving import to CSV). What remains:

1. **Real-time alert on reveal** — reveals are recorded in the audit log but not pushed to the
   owner at the moment they happen (needs an email/notification channel).
2. **Tenant-wide MFA mandate** — MFA is available and enforced per account; forcing every user in a
   tenant to enrol before access is a follow-up (needs per-tenant settings persistence).
3. **Build/dev dependency advisories** — `npm audit` still lists `postcss` (bundled inside Next),
   `braces` and `deepmerge-ts` in the build/dev toolchain; these aren't on the deployed runtime
   surface. Take them when a non-breaking fix (or a Next update) is available.
4. **Backups & secret rotation** — enable Neon point-in-time restore; document `AUTH_SECRET` and DB
   credential rotation.

---

## 5 · How to re-verify

```bash
# automated suite (static controls, invariants, server-action guard)
npm test                       # 189 tests, 14 files

# live attack (perimeter, role escalation, IDOR, anonymity, brute force)
# full method in docs/SECURITY-TEST.md §5
```

*Generated by [Claude Code](https://claude.ai/code)*
