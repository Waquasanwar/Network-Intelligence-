# Control rollout tracker

`Control_Rollout_Tracker.xlsx` tracks 34 controls (18 initial, 10 medium coverage, 6 full coverage) across Rings 1–5. It has two tabs:

- **Dashboard**: headline figures, a heatmap of % applied (ring × tier), applied/in-scope counts, overdue counts, and the default target dates. All of it is calculated by formulas.
- **Tracker**: one row per control. Each ring has a **Target** date and a **Status** (Not started / In progress / Applied / N/A). A status cell turns red when its target date has passed and the control isn't applied.

The status date on the Dashboard is `=TODAY()`. Target dates are placeholders.

To rebuild the blank template, run `python3 build/build_tracker.py`.
