# Ring control rollout tracker

Phased rollout of 34 technical controls (18 initial, 10 medium coverage, 6 full coverage) across Rings 1–5, which is 170 deployments to track.

| File | What it is |
|---|---|
| `Ring_Control_Rollout_Tracker.xlsx` | The tracker. Update only the **Deployment Matrix** sheet; every other sheet is driven by formulas. |
| `deployments.csv` / `rings.csv` | The same data the dashboard reads |
| `build/` | Scripts that regenerate the sample data and workbook, plus the dashboard page source |

**Workbook sheets:** Dashboard · README · Control Register · Ring Plan · Deployment Matrix · Heatmap · Expected vs Actual · Ring x Tier Summary · Lookups (the status date is in Lookups!B3).

All control names, statuses and dates are **sample data**. Replace them with your real control set and plan.

To rebuild: `python3 build/gen_data.py && python3 build/build_xlsx.py`, then open the workbook in Excel so the formulas recalculate.
