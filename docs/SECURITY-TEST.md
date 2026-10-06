# Security test — findings

**Date:** 25 Sept 2026 · **Target:** the Next.js app, run as a production build against a real
Postgres 16 database, seeded, and attacked over HTTP as three different signed-in roles.

This is an active test — requests fired at a running instance — not a code read. Every result below
was reproduced against `localhost:3100`. Method and commands are in §5 so it can be re-run.

---

## 1. Fixed in this pass

### F1 · Cross-tenant data leak through exposed server actions — **High**

Six functions were exported from `"use server"` files. In Next.js, **every export of a
`"use server"` module is a public POST endpoint** the browser can invoke with arguments it
controls. These six trusted their arguments:

| Function | Took | Would have leaked |
|---|---|---|
| `resolveMemberPerson(user, …)` | a `SessionUser` the caller supplies | any person, by forging `isInternal` + `tenantId` |
| `resolvePortalAccount(user, …)` | a `SessionUser` | any tenant's portal account |
| `feeSummary(tenantId)` | a bare tenant id | any tenant's fee pipeline |
| `alertsFor(tenantId)` | a bare tenant id | any tenant's alert feed — **including expert names** |
| `loadRateCard(tenantId)` | a bare tenant id | any tenant's commercial rate card |
| `loadVoiceSettings(tenantId)` | a bare tenant id | voice config + whether the ElevenLabs key is set |

A signed-in client or partner could have called any of these with another tenant's id.

**Fix:** moved all six into `src/server/queries.ts`, a `server-only` module with **no**
`"use server"` directive, so they are no longer registered as endpoints — reachable only through
server code that has already resolved and authorised the real session. The registered server-action
count dropped from **70 to 64**. Pages and actions that used them now import from the query module;
typecheck, build and the full test suite are green, and the client portal / requirements pages still
work.

**Regression guard:** `src/lib/server-actions.test.ts` scans every `"use server"` file and fails the
build if any export trusts a `SessionUser`, is keyed on a bare `tenantId`, or the file imports no
auth guard at all. This closes the class, not just the six instances.

---

## 2. Open findings — confirmed by attack

### O1 · No rate limiting on sign-in — **High** — FIXED

Originally reproduced: **30 password guesses against a real account in under a second, none
refused, no lockout.** Now throttled: the sign-in POST (`/api/auth/callback/credentials`) is
limited to **12 attempts per IP per 5 minutes** in `src/middleware.ts`, returning `429` with a
`Retry-After` header. The limiter (`src/lib/rate-limit.ts`) uses Upstash Redis when
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are set (required in production so the limit
is shared across serverless instances), and falls back to in-process memory otherwise. Verified:
attempts 1–12 pass through, 13+ return `429`.

### O2 · `script-src 'unsafe-inline'` in the CSP — **Medium** — FIXED

The CSP is now set per-request in `src/middleware.ts` with a fresh nonce. In production
`script-src` is `'self' 'nonce-…' 'strict-dynamic'` — no `'unsafe-inline'`. Verified on a prod
build: the header carries the nonce, the app hydrates, login works, and there are zero CSP
violations in the console.

### O3 · Unenforced security switches — **Medium** — MOSTLY FIXED

Seven of the eight switches are now enforced by code: MFA (real TOTP at sign-in), 8h sessions,
owner-approved reveal, owner-only export, notes stay internal, speech redaction, and a daily
retention sweep. Only "alert on reveal" remains partial (reveals are audited, not pushed) — see
`docs/SECURITY-CONTROLS.md` §3.

---

## 3. Tested and holding

| Attack | Result |
|---|---|
| Unauthenticated GET of 15 protected pages | all redirect to `/login` |
| Unauthenticated POST to voice APIs | refused (307) |
| CLIENT reaching 11 internal pages (incl. deep links) | all refused → `/forbidden` |
| PARTNER reaching internal pages | all refused |
| CLIENT / PARTNER reaching each other's workspace | refused |
| IDOR: client fetching an internal person by id | 307 / 404, no data |
| **Anonymity: all 22 real names vs. the rendered client & partner pages** | **not one name appears** |
| Wrong password | no session issued |
| Security headers (HSTS, XFO, nosniff, CSP, Referrer-Policy, Permissions-Policy) | all present |
| `x-powered-by` stack disclosure | absent |
| Session cookie | `HttpOnly; SameSite=Lax` (`Secure` added over HTTPS) |

Plus the 32 invariant assertions and the 20 server-action guards in the unit suite (§4 of the
readiness doc records the mutation testing that proves those have teeth).

---

## 4. Dependency audit

`xlsx` (the one with no upstream fix, and the only advisory on the runtime surface) has been
**removed** — contact import is now CSV-only. The remaining advisories (`postcss` bundled in Next,
`braces`, `deepmerge-ts`) are in the build/dev toolchain, not the deployed runtime; take them when a
non-breaking fix or a Next update lands.

---

## 5. How to re-run

```bash
# database
/usr/lib/postgresql/16/bin/initdb -D /tmp/pgdata -U postgres --auth=trust
/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o '-p 5432 -k /tmp/pgsock -h 127.0.0.1' start
createdb -h 127.0.0.1 -U postgres network_intelligence

export DATABASE_URL=postgresql://postgres@127.0.0.1:5432/network_intelligence?schema=public
export AUTH_SECRET=test AUTH_URL=http://localhost:3100 AUTH_TRUST_HOST=true AI_PROVIDER=heuristic
npx prisma migrate deploy && npx prisma db seed
npx next build && npx next start -p 3100

# static guards (no server needed)
npx vitest run src/lib/server-actions.test.ts src/lib/invariants.test.ts

# live attacks: perimeter, role escalation, IDOR, anonymity, brute force
# (the scripts used are in the session transcript; each signs in as a seeded role and
#  fires the requests in §3 against :3100)
```

Seed logins (`Password123!`): `waqas@…` owner, `richard@…`/`soban@…` contributor,
`partner@harboursearch.local` partner, `client@meridian.local` client,
`sarah.okonkwo@example.com` member.
