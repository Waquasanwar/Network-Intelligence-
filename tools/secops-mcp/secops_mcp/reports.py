"""Board deck (PowerPoint) and weekly report (HTML, for email or Teams), built from the same
figures as the dashboard. Generated on demand at /api/report.pptx and /api/report.html, and
each Monday by the weekly report workflow."""

from __future__ import annotations

import datetime as dt
import html
import io

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.util import Emu, Pt

from . import insights

NAVY, BLUE, INK, MUTED, OK, BAD, WARN, LINE = (RGBColor(0x0A, 0x17, 0x40), RGBColor(0x1F, 0x4B, 0xFF), RGBColor(0x0A, 0x17, 0x40), RGBColor(0x45, 0x52, 0x7C),
                                               RGBColor(0x0B, 0x9A, 0x5E), RGBColor(0xE2, 0x33, 0x6B), RGBColor(0xC2, 0x74, 0x00), RGBColor(0xD9, 0xDE, 0xEC))
W, H = Emu(12192000), Emu(6858000)


def _summary(data: dict, live: dict, threats: dict, days: int = 30) -> dict:
    end = dt.date.fromisoformat(data["daily"][-1]["date"]) if data.get("daily") else dt.date.today() - dt.timedelta(days=1)
    start = end - dt.timedelta(days=days - 1)
    cur, prev = insights.period(data, start, end)
    oc = data.get("outcomes", {}).get("outcomes", [])
    ms = [m for o in oc for m in o["measures"]]
    measured = [m for m in ms if m.get("meets") is not None]
    near = [p for p in threats["paths"] if p["near_miss"] and (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(p["created"].replace("Z", "+00:00"))).days < days]
    return {"start": start, "end": end, "days": days, "cur": cur, "prev": prev, "verdicts": insights.verdicts(data, cur, prev),
            "decisions": insights.decisions(data, cur, prev), "outcomes": oc, "met": sum(m["meets"] for m in measured), "measured": len(measured),
            "realised": [o["outcome"] for o in oc if o["status"] == "Realised"], "near": near, "signals": [n for n in data.get("notes", []) if n.get("confidence") == "High"][:3],
            "sample": [k for k, v in data.get("_sources", {}).items() if v == "sample"]}


def _fmt(v, unit=""):
    if v is None:
        return "—"
    return (f"{v:,.1f}" if isinstance(v, float) and not v.is_integer() else f"{int(v):,}") + unit


def _text(slide, x, y, w, h, text, size=14, bold=False, color=INK):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    lines = text if isinstance(text, list) else [text]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text, p.font.size, p.font.bold, p.font.color.rgb = line, Pt(size), bold, color
        p.space_after = Pt(6)
    return tb


def _title(prs, title, sub=None):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bar = s.shapes.add_shape(1, 0, 0, W, Emu(80000))
    bar.fill.solid(); bar.fill.fore_color.rgb = BLUE; bar.line.fill.background()
    _text(s, Emu(500000), Emu(300000), Emu(11000000), Emu(700000), title, 28, True)
    if sub:
        _text(s, Emu(500000), Emu(950000), Emu(11000000), Emu(500000), sub, 14, False, MUTED)
    return s


def _table(slide, rows, x, y, w, col_w, size=11, header=True, tones=None):
    t = slide.shapes.add_table(len(rows), len(rows[0]), x, y, w, Emu(300000 * len(rows))).table
    for j, cw in enumerate(col_w):
        t.columns[j].width = Emu(cw)
    for i, r in enumerate(rows):
        for j, v in enumerate(r):
            c = t.cell(i, j)
            c.text = str(v)
            c.fill.solid()
            c.fill.fore_color.rgb = NAVY if header and i == 0 else RGBColor(0xFF, 0xFF, 0xFF) if i % 2 else RGBColor(0xF4, 0xF6, 0xFC)
            for p in c.text_frame.paragraphs:
                p.font.size = Pt(size)
                p.font.bold = header and i == 0
                p.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF) if header and i == 0 else (tones or {}).get((i, j), INK)
    return t


def deck(data: dict, live: dict, threats: dict, days: int = 30) -> bytes:
    S = _summary(data, live, threats, days)
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H
    span = f"{S['start']:%d %b} to {S['end']:%d %b %Y}"

    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(1, 0, 0, W, H); bg.fill.solid(); bg.fill.fore_color.rgb = NAVY; bg.line.fill.background()
    _text(s, Emu(700000), Emu(2200000), Emu(10500000), Emu(1200000), "Security Operations", 44, True, RGBColor(0xFF, 0xFF, 0xFF))
    _text(s, Emu(700000), Emu(3300000), Emu(10500000), Emu(900000), [f"Information Security report, {span}", f"Prepared {dt.date.today():%d %B %Y}"], 18, False, RGBColor(0xC8, 0xD3, 0xF5))

    s = _title(prs, f"{S['met']} of {S['measured']} outcome targets met. {len(S['realised'])} outcomes realised.", span)
    c = S["cur"]
    pts = [f"Incidents: {_fmt(c['incidents'])} ({_fmt(S['prev']['incidents'])} in the {days} days before), contained in {_fmt(c['contain'], ' hours')} on average.",
           f"Closed inside the agreed time: {_fmt(c['sla'], '%')}. Acknowledged in {_fmt(c['mtta'], ' minutes')} on average.",
           f"Near misses: {len(S['near'])} attacks got deep into the chain and were stopped before data left or damage was done.",
           f"Decisions needed: {sum(1 for d in S['decisions'] if d.get('decision'))}. Actions: {len(S['decisions'])}."]
    _text(s, Emu(500000), Emu(1600000), Emu(11000000), Emu(4500000), pts, 18)

    s = _title(prs, "Phase 2 outcomes", "Targets, the value now, and declared status")
    rows = [["Outcome", "Measure", "Target", "Now", "Against target", "Status"]]
    tones = {}
    for o in S["outcomes"]:
        for i, m in enumerate(o["measures"]):
            tgt = "—" if m.get("text") else "To be agreed" if m.get("target") is None else ("≤ " if m.get("better") == "lower" else "≥ ") + _fmt(m["target"], (" " + m["unit"]) if m.get("unit") and m["unit"] != "%" else m.get("unit") or "")
            now = m["now"] if isinstance(m["now"], str) else _fmt(m["now"], (" " + m["unit"]) if m.get("unit") and m["unit"] != "%" else m.get("unit") or "")
            ag = "In place" if m.get("text") else "Met" if m.get("meets") else "Not yet" if m.get("meets") is False else "Target to be set"
            rows.append([o["outcome"] if i == 0 else "", m["label"], tgt, now, ag, o["status"] if i == 0 else ""])
            tones[(len(rows) - 1, 4)] = OK if ag in ("Met", "In place") else BAD if ag == "Not yet" else MUTED
    _table(s, rows, Emu(500000), Emu(1500000), Emu(11200000), [3000000, 2800000, 1300000, 1300000, 1500000, 1300000], 10, tones=tones)

    s = _title(prs, f"Performance over the last {days} days", "Against the period before, and against target where one exists")
    rows = [["Measure", "This period", "Period before", "Verdict"]]
    tones = {}
    for v in S["verdicts"]:
        rows.append([v["label"], _fmt(v["value"], v["unit"]), _fmt(v["previous"], v["unit"]), v["verdict"]])
        tones[(len(rows) - 1, 3)] = OK if v["verdict"] in ("On target", "Better than before") else BAD if v["verdict"] == "Off target" else WARN if v["verdict"] == "Worse than before" else MUTED
    _table(s, rows, Emu(500000), Emu(1500000), Emu(6200000), [2700000, 1200000, 1200000, 1100000], 11, tones=tones)
    weeks = data.get("weekly", [])[-12:]
    cd = CategoryChartData()
    cd.categories = [w["week_ending"][5:] for w in weeks]
    cd.add_series("Incidents", [w["incidents"] for w in weeks])
    ch = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Emu(7000000), Emu(1500000), Emu(4700000), Emu(3600000), cd).chart
    ch.has_legend, ch.has_title = False, True
    ch.chart_title.text_frame.text = "Incidents per week"
    ch.plots[0].series[0].format.fill.solid(); ch.plots[0].series[0].format.fill.fore_color.rgb = BLUE

    s = _title(prs, "Threat paths and near misses", f"{len(S['near'])} near misses in the last {days} days")
    counts = {st: 0 for st in threats["stages"]}
    for p in threats["paths"]:
        for st in p["path"]:
            counts[st] += 1
    cd = CategoryChartData()
    cd.categories = [k for k, v in counts.items() if v]
    cd.add_series("Incidents reaching this stage", [v for v in counts.values() if v])
    ch = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Emu(500000), Emu(1500000), Emu(5400000), Emu(4600000), cd).chart
    ch.has_legend = False
    ch.category_axis.reverse_order = True
    ch.category_axis.tick_labels.font.size = Pt(10)
    ch.plots[0].series[0].format.fill.solid(); ch.plots[0].series[0].format.fill.fore_color.rgb = BLUE
    rows = [["Near miss", "Furthest stage", "Stopped by"]] + [[p["title"], p["stopped_at"] or "", p.get("stopped_by", "")] for p in S["near"][:8]]
    _table(s, rows, Emu(6200000), Emu(1500000), Emu(5500000), [2300000, 1600000, 1600000], 10)

    s = _title(prs, "Decisions and actions", "From the figures in this report")
    rows = [["", "What", "Why", "Owner"]] + [["Decision" if d.get("decision") else "Action", d["title"], d["why"], d["owner"]] for d in S["decisions"][:8]]
    tones = {(i, 0): BAD if r[0] == "Decision" else WARN for i, r in enumerate(rows) if i}
    _table(s, rows, Emu(500000), Emu(1500000), Emu(11200000), [1100000, 4000000, 4400000, 1700000], 11, tones=tones)

    if S["signals"]:
        s = _title(prs, "Signals", "Patterns across systems, with where to look")
        y = 1500000
        for n in S["signals"]:
            _text(s, Emu(500000), Emu(y), Emu(11200000), Emu(400000), n["title"], 16, True)
            _text(s, Emu(500000), Emu(y + 380000), Emu(11200000), Emu(1000000), [n["pattern"], "Where to look: " + n["look"]], 11, False, MUTED)
            y += 1550000

    s = _title(prs, "About these figures")
    note = ["Sources: Microsoft Sentinel and the connected security systems, refreshed hourly.",
            "Sections still on sample data: " + (", ".join(S["sample"]) if S["sample"] else "none") + ".",
            "Signals are leads to check, prepared from the weekly figures; a person reviews them before action is taken."]
    _text(s, Emu(500000), Emu(1600000), Emu(11000000), Emu(3000000), note, 14, False, MUTED)

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def html_report(data: dict, live: dict, threats: dict, days: int = 7) -> str:
    S = _summary(data, live, threats, days)
    e = html.escape
    tone = {"On target": "#0b9a5e", "Better than before": "#0b9a5e", "Off target": "#e2336b", "Worse than before": "#c27400"}
    rows = "".join(f"<tr><td>{e(v['label'])}</td><td style='text-align:right'>{e(_fmt(v['value'], v['unit']))}</td><td style='text-align:right;color:#45527c'>{e(_fmt(v['previous'], v['unit']))}</td>"
                   f"<td style='color:{tone.get(v['verdict'], '#45527c')}'>{e(v['verdict'])}</td></tr>" for v in S["verdicts"])
    acts = "".join(f"<li><b>{'Decision: ' if d.get('decision') else ''}{e(d['title'])}</b><br><span style='color:#45527c'>{e(d['why'])} Owner: {e(d['owner'])}.</span></li>" for d in S["decisions"])
    near = "".join(f"<li>{e(p['title'])}: reached {e(p['stopped_at'] or '')}, stopped by {e(p.get('stopped_by', ''))}.</li>" for p in S["near"][:6])
    return f"""<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;color:#0a1740;max-width:760px;margin:auto;padding:24px">
<p style="color:#45527c;margin:0">Information Security, {S['start']:%d %b} to {S['end']:%d %b %Y}</p>
<h1 style="margin:6px 0 4px;font-size:26px">Security operations: {S['met']} of {S['measured']} outcome targets met</h1>
<p>{S['cur']['incidents']} incidents, contained in {_fmt(S['cur']['contain'], ' hours')} on average. {len(S['near'])} near misses. {sum(1 for d in S['decisions'] if d.get('decision'))} decisions needed.</p>
<h2 style="font-size:18px">Decisions and actions</h2><ul>{acts or '<li>None this period.</li>'}</ul>
<h2 style="font-size:18px">Performance against the period before</h2>
<table style="border-collapse:collapse;width:100%;font-size:14px"><tr style="text-align:left;color:#45527c"><th>Measure</th><th style="text-align:right">This period</th><th style="text-align:right">Before</th><th>Verdict</th></tr>{rows}</table>
<h2 style="font-size:18px">Near misses</h2><ul>{near or '<li>None this period.</li>'}</ul>
<p style="color:#8791b5;font-size:12px">Sections on sample data: {e(', '.join(S['sample']) or 'none')}.</p></body></html>"""
