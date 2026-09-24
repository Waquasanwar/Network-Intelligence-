# Testing and QA schedule

Everything below is a command somebody can run, not a practice somebody is supposed to remember.
Where a gate is not yet automated it says so, rather than implying it is.

---

## On every commit — the author, before pushing

```bash
npx tsc --noEmit                 # types
npx vitest run                   # 169 tests, ~3s
node prototype/build.mjs         # the prototype bundles
```

**Gate:** all three clean. Nothing is pushed red.

---

## On every push — CI (`.github/workflows/ci.yml`, automated)

Postgres 16 service · migrations · typecheck · lint · tests · `next build`.

**Gate:** CI green before review. *Not yet in CI: the two browser harnesses below — they need a
served build, so they are run by hand until that is wired up.*

---

## On every change that touches UI — by hand, before review

```bash
node prototype/build.mjs
(cd prototype/dist && python3 -m http.server 8787 &)
node tools/layout-qa.mjs         # 29 pages x 1440/1180/900/390
node tools/design-audit.mjs      # families, sizes, weights, radii, controls, headings
```

**Layout gate — `total issues: 0`.** Checks each page for sideways scroll, text overflowing its
box, elements outside their column, controls under a comfortable tap target, and card headings off
their left edge.

**Design gate — the counts must not grow:**

| | ceiling | today |
|---|---|---|
| Font families | 2 | 2 |
| Font sizes | 12 | 12 |
| Font weights | 4 | 4 |
| Border radii | 5 (+`50%` for circles) | 5 |
| Button heights | 3 | 3 |
| Heading styles | 5 | 5 |

A new value is a decision, not an accident: change the ceiling in this table in the same commit,
or use one that exists.

---

## On every change to auth, consent, redaction or retention

```bash
npx vitest run src/lib/invariants.test.ts src/lib/authz.test.ts src/lib/security.test.ts
```

**Gate:** 32 invariants green — and, because a test that has never failed proves nothing, break
one deliberately and confirm it is caught before you trust it. The three mutations used to
validate the suite are recorded in `docs/RELEASE-READINESS.md` §4.

---

## Weekly

- Re-run the full sweep above on the main branch, including both browser harnesses.
- Review the audit log for `identity.reveal` and `person.export` — anything unexpected is
  investigated the same day.
- Work the retention queue by hand until B5 is fixed: anything `retentionDue()` flags is deleted
  or anonymised, and the sweep is recorded.

## Monthly

- `npm audit` and dependency bumps; anything High is fixed that week.
- Re-read `docs/RELEASE-READINESS.md` and move items between sections. It is wrong the moment it
  stops being edited.
- Restore the database from backup into a scratch environment and confirm the app runs against it.
  A backup nobody has restored is not a backup.

## Quarterly

- Consent review: everybody whose consent is over twelve months old (`consentStale()`) is re-asked.
- Access review: every user's role, and every account with a portal enabled.
- Re-run the mutation checks in §4 of the readiness doc against the current code.

## Before any release to a real client

1. The blocker list in `docs/RELEASE-READINESS.md` §1 is empty.
2. End-to-end tests exist and pass for: sign-in and redirect · a client portal that must never
   render a name · consent withdrawn while a card sits on a live shortlist · export · erasure.
3. A penetration test by somebody who did not write the code, against a deployed instance.
4. A restore rehearsal completed within the last month.
5. DPIA, record of processing, and a signed processor agreement per account.

---

## What is deliberately not automated

- **Whether the writing is any good.** Tone, honesty and whether a sentence means anything are
  read by a person.
- **Whether a number is *true*.** The harnesses check that figures line up and do not overflow.
  They cannot tell you a median is measuring the wrong thing.
- **Whether the design is right.** The audit counts consistency. Consistency is not quality — it
  is the floor below which quality cannot be judged.
