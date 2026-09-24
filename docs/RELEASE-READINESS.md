# Release readiness

**Status: not production ready.** Verified as of 24 Sept 2026, on branch
`claude/network-intelligence-platform-x2wunj`.

This is an honest assessment, not a sign-off. It separates three things that are easy to
conflate: what is *verified by a test that would fail if it broke*, what is *built but
unverified*, and what is *claimed in the interface but not implemented*. The third category is
the dangerous one, and it is listed first.

---

## 1. Blockers — the interface promises something the code does not do

| # | Finding | Severity | Where |
|---|---|---|---|
| B1 | **`mfaRequired` is a stored flag nothing checks.** `toggleMfa` writes `user.mfaEnabled`; no sign-in path reads it. An owner switching it on gets no second factor. | **High** | `src/server/actions/settings.ts`, `src/auth.ts` |
| B2 | **`restrictExport` says "only owners can export"; `exportPerson` admits any internal user.** A contributor can export a full person record including relationship notes. | **High** | `src/server/actions/people.ts:236` |
| B3 | **`approveBeforeReveal` does not gate anything.** `canRevealIdentity()` checks role only; the setting is never read. | **Medium** | `src/lib/authz.ts` |
| B4 | **`alertOnReveal` has no notification path.** Reveals are audited but nobody is told. | **Medium** | — |
| B5 | **`retentionSweep` has no scheduler.** `retentionDue()` computes the queue correctly; nothing runs it, so nothing is ever actually deleted. | **Medium** | `src/lib/privacy.ts` |
| B6 | **`sessionTimeout` is labelled 12 hours; sessions are 8.** The control does not drive the value either way. | **Low** | `src/auth.config.ts:11` |

**Mitigated for now** (24 Sept): the Security tab no longer counts these as protections. Each
unenforced control is labelled *"not enforced yet"*, the posture panel reads **"3 of 8 enforced ·
5 not yet implemented"**, and the headline says they are *"an intention, not a protection"*.
`SECURITY_CONTROLS[].enforcedBy` carries the mechanism or `null`, and a test asserts the count
matches. That removes the false claim; it does not remove the work.

### Other open items

| # | Finding | Severity |
|---|---|---|
| B7 | **No rate limiting** on sign-in or any API route. Credential stuffing is unthrottled. | **High** |
| B8 | **`script-src 'unsafe-inline'`** in the CSP weakens it materially against XSS. | **Medium** |
| B9 | **No end-to-end tests.** Zero `.spec.ts` in the repo; every check is unit-level. | **Medium** |
| B10 | **The MFA toggle is audited as `user.role_change`** — the wrong action, which corrupts the audit trail's meaning. | **Low** |
| B11 | **The browser prototype is a demo, not the product.** State lives in `localStorage` / the artifact store, there is no server and no auth. Everything built there — Performance, the Security tab, the agreement, the member privacy page — has **not** been ported to the Next.js app. | **Blocker for launch** |

---

## 2. Verified — a test would fail if this broke

`src/lib/invariants.test.ts` — 32 assertions, mutation-tested (see §4).

- **Access control.** Partner, client and member are each refused every internal page, including
  deep links (`/network/:id`, `/network/:id/edit`) and prefix collisions (`/member` allowed,
  `/members-export` refused). Unknown paths and traversal refuse rather than default open. A
  client and a partner cannot reach each other's workspace.
- **Tenant isolation.** `assertSameTenant` throws across tenants, in both directions.
- **Outward redaction.** `redactForPartner` output is scanned — as serialised JSON, not by shape —
  for the person's real name, email, phone, LinkedIn, employer, photo URL and relationship notes.
  None appear. `containsForbiddenPartnerFields` catches a hand-assembled payload at any depth.
- **Opaque references.** Stable, distinct per person, and not derivable back to the id.
- **Consent.** Withdrawal takes effect with no cache (the same object, flipped, gives the opposite
  answer). An erasure request overrides every consent. A name needs both `nameOnIntro` *and*
  agreement to that specific role. Photos are off by default and never leave the network unlocked.
- **Retention.** Overdue classes are flagged; erasure flags immediately; consent goes stale at
  twelve months; every class carries a UK basis, a PDPL basis and an end state; voice retention is
  zero and says no audio is stored.
- **Defaults.** Every security control ships on. Every disclosing or escalating act is in
  `SENSITIVE_ACTIONS`.
- **Vendor boundary.** `redactForSpeech` removes names and exact money, and leaves an ordinary
  question untouched.

Plus 137 further tests across matching, trust, demand, screening, the interview, agreements,
velocity, money and CSV import. **169 total, all passing.**

---

## 3. Built and working, but not independently verified

- NextAuth with JWT sessions; middleware redirects unauthenticated traffic to `/login` and
  role-checks every non-API path through `canAccessPath`. *The middleware itself has no test —
  only the function it calls does.*
- Security headers: HSTS with preload, `X-Frame-Options: DENY`, `nosniff`, a restrictive
  Permissions-Policy, `frame-ancestors 'none'`, `object-src 'none'`.
- CI on every push: Postgres 16 service, migrations, typecheck, lint, tests, build.
- Prisma migrations run non-interactively and are committed.
- Audit writes server-side at the point an action succeeds, with a typed action union.

---

## 4. How the verification itself was verified

Tests that pass on the first run prove nothing until you know they can fail. Three invariants were
deliberately broken and the suite re-run:

| Mutation | Result |
|---|---|
| Leak `firstName lastName` through `redactForPartner` | **Caught** — "leaked: Sarah" |
| Add `/network` to a client's allowed paths | **Caught** — "/network should be refused" |
| Make `canShareAnonymised` ignore an erasure request | **Caught** |

All three restored; suite green.

---

## 5. What "production ready" would require

In order:

1. Implement or remove B1–B6. An unenforced switch must not ship, even labelled.
2. Rate limiting on `/api/auth` and every mutating route (B7).
3. Remove `'unsafe-inline'` from `script-src` (B8).
4. End-to-end tests for the journeys that carry risk: sign-in and redirect, a client portal that
   must never render a name, consent withdrawn mid-shortlist, export, erasure (B9).
5. Port the prototype's work into the Next.js app (B11).
6. A penetration test by somebody who did not write this, against a deployed instance.
7. A DPIA, a record of processing, and a signed processor agreement per account — the contract
   clauses exist; the register does not.
