# Deploying Network Intelligence to production

A step-by-step guide to running this on the public internet with adequate security:
the Next.js app on **Vercel**, Postgres on **Neon**, and the sign-in rate limiter backed by
**Upstash Redis**. Allow about 30–45 minutes for a first deploy.

```
            ┌────────────────────────┐
  Browser ──►   Vercel (Next.js)      │   app + edge middleware (auth, rate limit)
            │   HTTPS, security hdrs  │
            └───────┬─────────┬───────┘
                    │         │
       pooled SQL   │         │  REST
                    ▼         ▼
            ┌──────────────┐  ┌──────────────┐
            │ Neon Postgres│  │ Upstash Redis│  (sign-in throttle, shared across instances)
            └──────────────┘  └──────────────┘
```

Everything else (Anthropic, Microsoft Entra SSO, Microsoft Graph / Calendly scheduling,
ElevenLabs screening voice) is optional and off by default.

---

## 1 · Database — Neon Postgres

1. Create a project at **neon.tech**. Pick a region close to your users (London or Frankfurt
   for UK/UAE).
2. From the dashboard, copy **two** connection strings:
   - the **pooled** one (host contains `-pooler`) → this becomes `DATABASE_URL`
   - the **direct** one (no `-pooler`) → this becomes `DIRECT_URL`
3. Make sure both end with `?sslmode=require`. For the pooled one, Neon's snippet already adds
   the pooler host; keep it.

The app runs its queries through the pooled connection (serverless opens many short-lived
connections). **Migrations use the direct connection**, because pooled connections can't hold the
advisory lock Prisma needs — this is why `schema.prisma` declares both `url` and `directUrl`.

---

## 2 · Rate-limit store — Upstash Redis

The sign-in limiter must be shared across Vercel's many serverless instances, so it needs a
central store. (Without it the limiter falls back to per-instance memory, which barely slows a
real attacker.)

1. Create a database at **upstash.com** → Redis. Pick a region near your Vercel region.
2. Copy **REST URL** and **REST token** → `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.

No code change is needed — the limiter (`src/lib/rate-limit.ts`) switches to Redis automatically
when both variables are present.

---

## 3 · Secrets

Generate the session-signing secret:

```bash
openssl rand -base64 32
```

Use the output as `AUTH_SECRET`. Generate a **different** one for each environment (preview vs
production). Never reuse the demo value.

---

## 4 · Deploy to Vercel

1. Push your branch and open **vercel.com → Add New → Project**, import this GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Build command and output are default.
3. Add the environment variables below under **Settings → Environment Variables**
   (set them for *Production*, and for *Preview* if you want preview deploys to work).
4. Deploy.

### Required environment variables

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** string + `?sslmode=require` | app queries |
| `DIRECT_URL` | Neon **direct** string + `?sslmode=require` | migrations |
| `AUTH_SECRET` | `openssl rand -base64 32` | unique per environment. The app refuses to start in production with a missing, short or placeholder value. It also keys invitation links, MFA secrets at rest and the references clients see, so changing it signs everyone out, invalidates every invitation link already sent and means people re-enrol MFA |
| `AUTH_URL` | `https://your-domain.com` | your real public URL (HTTPS) |
| `AUTH_TRUST_HOST` | `true` | required behind Vercel's proxy |
| `UPSTASH_REDIS_REST_URL` | from Upstash | shared rate limits: sign-in, registration, AI and voice. Without it the limits are per server instance only |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash | as above |
| `CRON_SECRET` | `openssl rand -base64 32` | gates the daily retention sweep (`/api/cron/retention`); Vercel Cron sends it automatically |
| `AI_PROVIDER` | `heuristic` | no external AI calls; set `anthropic` + `ANTHROPIC_API_KEY` to enable the Claude co-pilot |
| `SHOW_DEMO_ACCOUNTS` | *(unset / `false`)* | keep the demo panel off the login page |
| `PUBLIC_NETWORK_SLUG` | your tenant slug, e.g. `amana` | the network the public page at `/` speaks for: its name, and where applications and needs land. Unset, it is the first tenant that runs a network |

> **Client addresses.** Rate limits key on the visitor's address from `x-real-ip` (set by Vercel).
> If you host elsewhere, put the app behind a proxy that sets `x-real-ip` itself and strips any
> value sent by the client; otherwise only the per-account limits and lockout protect sign-in.

### Optional

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY`, `AI_MODEL` | The Claude co-pilot (agentic search over the network), conversation structuring, profile drafts, outreach drafts. `AI_MODEL` defaults to `claude-opus-5-5`. Set the key as a Vercel environment variable (Production, encrypted). |
| `AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER` | Microsoft Entra (Azure AD) SSO |
| `MICROSOFT_GRAPH_*`, `CALENDLY_*` | calendar scheduling providers |
| `ELEVENLABS_API_KEY` | screening-call voice (server-side only; never exposed to the member) |
| `AVAILABILITY_STALE_DAYS` | days before an availability status is treated as stale (default 45) |

---

## 5 · Run migrations against the production database

From your machine, with the production values exported (or in a `.env.production.local`):

```bash
DATABASE_URL="<neon pooled>" DIRECT_URL="<neon direct>" npx prisma migrate deploy
```

`migrate deploy` only applies committed migrations — it never generates or resets. Re-run it
after every deploy that adds a migration. (You can also wire it into the Vercel build command:
`prisma migrate deploy && next build`, but running it deliberately is safer for a first launch.)

---

## 6 · Create the first real owner account

The seed script (`npm run db:seed`) creates **demo** data and must not be run against a real
database. Instead, create one real platform-owner account, then invite everyone else from inside
the app.

A short script does this safely (prompts for email + password, hashes with bcrypt, creates the
owner tenant + user). If one isn't in the repo yet, create `scripts/create-owner.ts` from the
`authorize` logic in `src/auth.ts` as the reference, or insert the row directly with a bcrypt hash
you generate. Then sign in at `https://your-domain.com/login`.

---

## Security configuration — what's already true

Verified by the live security test (`docs/SECURITY-TEST.md`) and enforced in code:

- **Transport & headers** — HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  a restrictive `Content-Security-Policy`, `Referrer-Policy`, and `Permissions-Policy`
  (`next.config.ts`). `x-powered-by` is off. On Vercel everything is HTTPS, so the session cookie
  is `Secure; HttpOnly; SameSite=Lax`.
- **Tenant isolation** — every query is scoped to the caller's tenant; the live test confirmed no
  cross-tenant leak, and a regression guard fails the build if a `"use server"` export trusts a
  caller-supplied identity.
- **Role-scoped access** — partners, clients and members reach only their own workspace; internal
  pages refuse them (`src/lib/authz.ts`, enforced in `src/middleware.ts`).
- **Anonymity** — no real name reaches a client or partner view without the person's consent.
- **Sign-in throttling** — 12 attempts per IP per 5 minutes, returning `429` (`src/lib/rate-limit.ts`,
  enforced in `src/middleware.ts`). Distributed via Upstash in production.
- **Audit log** — every sign-in and mutating action is recorded.
- **Secrets** — the login page hides demo accounts in production; no secrets are shipped to the
  browser.

## Pre-launch gate

Most of the original gate is now done in code (see `docs/SECURITY-CONTROLS.md`): MFA (TOTP),
nonce-based CSP, owner-only export, owner-approved reveal, the retention sweep, and removing the
`xlsx` advisory. What's left before real customer data:

1. **Backups & recovery.** Enable Neon point-in-time restore and test a restore once.
2. **Secret rotation plan.** Document how to rotate `AUTH_SECRET` (it invalidates sessions) and the
   database credentials.
3. **Load & QA pass** on realistic data volumes (`docs/QA-SCHEDULE.md`).
4. **Nice-to-haves, not blockers:** a real-time alert channel for identity reveals, and a
   tenant-wide "require MFA for everyone" mandate (per-account MFA already works).

## Operations

- **Deploys** — push to the production branch; Vercel builds and promotes. Run `prisma migrate
  deploy` for any release with a new migration.
- **Monitoring** — turn on Vercel log drains / alerts; watch for spikes of `429` (attack) or `5xx`.
- **Rollback** — Vercel keeps previous deployments; promote the last good one. Database changes are
  forward-only — never roll a migration back in production, write a new one.

---

*Generated by [Claude Code](https://claude.ai/code)*


## Installing it as an app

The platform is an installable web app (manifest, icons and a small service worker in `public/sw.js`).
Once it is on its own HTTPS address:

- **iPhone / iPad:** open it in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap the menu, then **Install app**.
- **Mac / Windows:** in Chrome or Edge, click the install icon at the right of the address bar.

It then opens full screen with its own icon. The service worker caches only the app's code and icons,
never pages or data, because those hold private information about people. With no connection it shows
an offline screen.
