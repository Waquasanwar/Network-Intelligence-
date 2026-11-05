# Prompt: Ring-Based Technical Control Rollout – Tracker & Executive Dashboard

> Copy everything inside the box below into Claude (or another capable AI model).
> It will produce (1) a working Excel tracker and (2) an executive-grade
> risk & control dashboard. Change the values in **[square brackets]** first.

---

```text
ROLE
You are a senior cyber-risk and technology-controls consultant (Big-4 / tier-1
consultancy standard). You are building the single source of truth that a
programme board, CISO and risk committee will use to drive and track a phased
rollout of technical security controls across five deployment rings.

CONTEXT
- We are rolling out technical controls to our estate in phases ("rings").
  Each ring is a group of devices, users, applications or sites, starting
  small and low-risk (Ring 1) and ending with the full estate (Ring 5).
- Controls are grouped into three coverage tiers, which are rolled out in order:
    1. Initial Controls (baseline)   – 18 controls  (IDs IC-01 … IC-18)
    2. Medium Coverage               – 10 controls  (IDs MC-01 … MC-10)
    3. Full Coverage                 –  6 controls  (IDs FC-01 … FC-06)
    Total = 34 controls × 5 rings = 170 control/ring deployments to track.
- Rings and target dates (edit as needed):
    | Ring   | Scope / description          | Initial target | Medium target | Full target |
    |--------|------------------------------|----------------|---------------|-------------|
    | Ring 1 | [Pilot – IT / early adopters] | [2026-11-30]   | [2026-12-31]  | [2027-01-31]|
    | Ring 2 | [Wider IT + champions]        | [2026-12-31]   | [2027-01-31]  | [2027-02-28]|
    | Ring 3 | [Business unit wave 1]        | [2027-01-31]   | [2027-02-28]  | [2027-03-31]|
    | Ring 4 | [Business unit wave 2]        | [2027-02-28]   | [2027-03-31]  | [2027-04-30]|
    | Ring 5 | [Remaining estate / critical] | [2027-03-31]   | [2027-04-30]  | [2027-05-31]|
- Today's date (status date): [2026-11-05]
- If I have not supplied real control names, create realistic placeholder
  names appropriate for [endpoint / identity / network / cloud] controls
  (e.g. MFA enforcement, EDR deployed, disk encryption, patch SLA, admin rights
  removal, logging to SIEM, application allow-listing, conditional access,
  network segmentation, PAM, DLP, backup immutability) and clearly mark them
  as "PLACEHOLDER – replace".

DELIVERABLE 1 – EXCEL TRACKER (.xlsx), with these sheets:

1. "README"  – purpose, how to update, status definitions, RAG rules, owner.

2. "Control Register" – one row per control (34 rows):
   Control ID | Tier | Control name | Description | Framework mapping
   (e.g. NIST CSF 2.0 / CIS v8 / ISO 27001:2022 / Essential Eight) |
   Risk mitigated | Risk rating if absent (H/M/L) | Control owner |
   Technical owner | Dependency (prerequisite control IDs) | Evidence required.

3. "Ring Plan" – one row per ring: Ring | Scope | Population size
   (users/devices/apps) | Business owner | Change window | Planned start |
   Target date per tier (Initial / Medium / Full) | Go/no-go criteria |
   Exit criteria.

4. "Deployment Matrix" (the core data – 170 rows, long format so it can be
   filtered and pivoted):
   Control ID | Tier | Ring | Planned date (defaults to the ring's tier
   target date, overridable) | Actual date | Status | % deployed (coverage of
   the ring population) | Evidence link | Exception / risk acceptance ref |
   Blocker / comment | Last updated | Updated by
   Calculated columns:
     - Days variance = Actual (or today if not done) − Planned
     - Schedule state = "Due" if Planned ≤ today, "Not yet due" otherwise
     - RAG (see rules below)

   Status values (data-validation drop-down):
     Not started | Planned | In progress | Deployed – pending evidence |
     Implemented (verified) | Exception / risk accepted | Not applicable |
     Blocked

5. "Heatmap" – a 34 × 5 grid (controls down the side, grouped and subtotalled
   by tier; Ring 1–5 across the top). Each cell shows status (or %), driven by
   formulas from the Deployment Matrix, with conditional formatting:
     - Dark green  = Implemented (verified)
     - Light green = Deployed – pending evidence
     - Amber       = In progress, on schedule
     - Red         = Overdue (planned date passed and not implemented) or Blocked
     - Blue        = Planned / not yet due
     - Grey        = Not started and not yet due, or N/A
     - Purple      = Exception / risk accepted
   This MUST answer at a glance: "Where are controls applied, where should
   they already be applied but aren't?" Add a second heatmap that shows
   Expected-by-today vs Actual (cells where expected = yes and actual = no
   are highlighted red).

6. "Ring × Tier Summary" – 5 rings × 3 tiers, each cell showing
   "Implemented / Total (%)", with:
     - Expected-by-today count, Implemented count, Gap (expected − implemented)
     - Remaining (left to do), Overdue, Exceptions
     - Totals per ring and per tier, and a grand total.

7. "Lookups" – status list, RAG thresholds, colour codes, tier/ring lists.

RAG RULES (per cell, roll-up by ring and tier):
  - GREEN : Implemented (verified), or not yet due and on track
  - AMBER : due within the next 14 days and not implemented, or
            Deployed – pending evidence for > 10 days, or % deployed 50–94%
            at the planned date
  - RED   : planned date passed and not implemented, or Blocked, or a
            dependency control is not in place
  - Roll-up: a ring/tier is RED if ≥ 10% of its due controls are red, AMBER if
    any are amber/red, otherwise GREEN.

Build requirements:
  - Use real Excel formulas (COUNTIFS, SUMPRODUCT, XLOOKUP/INDEX-MATCH, TODAY()),
    not hard-coded results, so the workbook stays live when statuses change.
  - Freeze panes, filters on all tables, named tables, data validation,
    consistent professional palette, no merged cells in data tables.
  - Populate the Deployment Matrix with realistic SAMPLE data consistent with
    today's date: Ring 1 mostly complete, Ring 2 in progress, Rings 3–5 mostly
    planned, plus a handful of overdue, blocked and exception items, so the
    heatmap and dashboard demonstrate every state. Label as sample data.

DELIVERABLE 2 – EXECUTIVE DASHBOARD
Build a single-page, consultancy-grade dashboard (an interactive HTML page
AND a "Dashboard" sheet in the workbook) that reads from the same data.
Layout, top to bottom:

  A. Header: programme name "[Technical Control Rollout Programme]",
     status date, overall RAG, one-sentence executive summary
     (auto-generated from the data, e.g. "112 of 170 deployments complete
     (66%); 9 overdue, concentrated in Ring 3 Medium Coverage").

  B. KPI tiles (6): Overall completion % | Controls implemented vs total |
     Expected by today vs achieved (schedule adherence %) | Overdue count |
     Blocked count | Open exceptions / risk acceptances.

  C. Heatmap: Controls (34, grouped by tier) × Rings (1–5) using the colour
     key above, with hover/tooltip detail (planned date, actual date,
     owner, comment). Filters: tier, ring, status, owner.

  D. Ring × Tier matrix: 15 cells with % complete and RAG, clearly showing
     what is applied for each ring and what is left.

  E. Timeline / Gantt: for each ring, the three tier milestones (planned vs
     actual/forecast), a vertical "today" line, slipped milestones in red.

  F. Burn-up chart: cumulative planned vs actual implemented deployments
     over time (170 = full scope), with a forecast line based on current run rate
     and the forecast completion date vs target.

  G. Risk view: top 10 open risks = controls that are overdue/blocked in rings
     with the largest population or highest risk rating, with owner, days
     overdue, risk if not implemented, and the mitigating action.

  H. Exceptions & blockers register: ID, ring, control, reason, owner,
     risk acceptance expiry date.

  I. Next 30 days: deployments due, by ring and owner (the "what we need to
     do next" list for the weekly programme meeting).

Design standard:
  - Clean, restrained consultancy style (think board pack): neutral
    background, one accent colour, consistent typography, clear titles that
    state the insight ("Ring 3 is 4 weeks behind on Medium Coverage") rather
    than generic labels.
  - Colour-blind-safe palette; RAG always paired with a text label or icon.
  - Prints cleanly to A4/Letter landscape for the steering committee pack.
  - No fabricated precision: show counts and % to the nearest whole number.

OUTPUT
1. The .xlsx file.
2. The dashboard HTML file (self-contained, data embedded as JSON so I can
   replace it with an export from the Deployment Matrix).
3. A short "How to run this weekly" note: who updates what, by when,
   and how the dashboard refreshes.
4. A list of assumptions you made and the questions I should answer to
   replace placeholders with real data.

Before building, briefly confirm your understanding of rings, tiers, control
counts (18 / 10 / 6 = 34) and dates, then proceed without waiting unless
something is contradictory.
```

---

## Notes for the person running this prompt

- **Control counts** are set to Initial 18, Medium 10, Full 6 (34 total). If
  those change, update the CONTEXT block — everything else derives from it.
- **Dates** in the Ring table are placeholders staggered one month apart per
  ring and per tier. Replace them with the real deployment plan.
- If you already have a control list, paste it under CONTEXT as
  `Control ID | Tier | Name | Owner` and remove the placeholder instruction.
- To keep it live, update only the **Deployment Matrix** each week
  (Status, Actual date, % deployed). The heatmap, summary and dashboard all
  derive from it.
