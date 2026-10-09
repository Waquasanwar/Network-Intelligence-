import { STAGES, CLOSED_STAGES, RELATIONSHIPS, ACTIVITY_TYPES, fillTemplate } from "/lib/scoring.js";
import { toCsv } from "/lib/csv.js";

// ---------- state & api ----------

let S = { leads: [], settings: null, followerLog: [] };
const UI = { q: "", stage: "", sector: "", tier: "", rel: "", sort: "score", openLeadId: null };

async function api(method, path, body) {
  const res = await fetch(`/api/${path}`, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
async function reload() { S = await api("GET", "state"); }

function upsertLocal(lead) {
  const i = S.leads.findIndex((l) => l.id === lead.id);
  if (i === -1) S.leads.push(lead); else S.leads[i] = lead;
}

// ---------- helpers ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const stageLabel = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
const relLabel = Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, r.label]));
const actLabel = Object.fromEntries(ACTIVITY_TYPES.map((a) => [a.key, a.label]));
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => ymd(new Date());
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const fmtDate = (s) => (s ? new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
const name = (l) => `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim();
const isOpen = (l) => !CLOSED_STAGES.includes(l.stage);
const stageIdx = (k) => STAGES.findIndex((s) => s.key === k);
function weekStart() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return ymd(d); }

function toast(msg, bad = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast${bad ? " bad" : ""}`;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3200);
}

const tierBadge = (l) => `<span class="tier ${esc(l.tier)}">${l.tier === "excluded" ? "excluded" : `${l.score} · ${esc(l.tier)}`}</span>`;
const stageBadge = (l) => `<span class="stage s-${esc(l.stage)}">${esc(stageLabel[l.stage] ?? l.stage)}</span>`;
const leadLink = (l) => `<button class="link" data-open="${esc(l.id)}">${esc(name(l))}</button>`;
const sub = (l) => esc([l.position, l.company].filter(Boolean).join(" at ") || l.headline || "");
const empty = (title, body = "") => `<div class="empty"><strong>${esc(title)}</strong>${body ? `<p>${body}</p>` : ""}</div>`;
const stat = (label, value, hint = "", tone = "") => `<div class="stat ${tone}"><div class="label">${esc(label)}</div><div class="value">${value}</div>${hint ? `<div class="hint">${hint}</div>` : ""}</div>`;
function bar(value, goal) {
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return `<div class="goal"><div class="goal-bar"><span style="width:${pct}%"></span></div><span class="goal-num">${value} / ${goal}</span></div>`;
}

function activitiesSince(date, types) {
  let n = 0;
  for (const l of S.leads) for (const a of l.activities ?? []) if (a.at.slice(0, 10) >= date && types.includes(a.type)) n++;
  return n;
}
function followerDelta(since) {
  const log = S.followerLog;
  if (!log.length) return null;
  const latest = log[log.length - 1];
  const before = [...log].reverse().find((e) => e.date < since) ?? log[0];
  const sum = (e) => (e.profileFollowers ?? 0) + (e.pageFollowers ?? 0);
  return { latest, delta: sum(latest) - sum(before) };
}

// ---------- views ----------

function viewToday() {
  const t = today();
  const ws = weekStart();
  const open = S.leads.filter(isOpen);
  const due = open.filter((l) => l.nextFollowUp && l.nextFollowUp <= t).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp) || b.score - a.score);
  const cutoff = addDays(-14);
  const hotUntouched = open
    .filter((l) => l.tier === "hot" && ["new", "warming", "connected"].includes(l.stage) && !(l.activities ?? []).some((a) => a.at.slice(0, 10) >= cutoff) && !(l.nextFollowUp && l.nextFollowUp > t))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  const upcoming = S.leads.filter((l) => l.appointmentAt && l.appointmentAt >= t && l.stage === "booked").sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt));
  const g = S.settings.weeklyGoals;
  const fd = followerDelta(ws);
  const targeted = S.settings.sectors.some((s) => s.priority > 0);

  return `
  <h1>Today</h1>
  <p class="lede">Who to contact, who to follow up, and how this week is tracking.</p>
  ${!targeted ? `<div class="callout">Start in <a href="#/settings">Targeting</a>: tell the tracker which sectors buy your services and which job titles make the decision. Every lead is scored against that.</div>` : ""}
  ${!S.leads.length ? `<div class="callout">No leads yet. <a href="#/import">Import your LinkedIn connections</a> or add followers one at a time.</div>` : ""}
  <div class="stats">
    ${stat("Leads in play", open.length, `${S.leads.length} total`)}
    ${stat("Hot leads", open.filter((l) => l.tier === "hot").length, "score 70+", "good")}
    ${stat("Follow-ups due", due.length, due.length ? "work these first" : "all clear", due.length ? "warn" : "")}
    ${stat("Appointments ahead", upcoming.length, upcoming[0] ? `next ${fmtDate(upcoming[0].appointmentAt)}` : "")}
  </div>

  <section class="card">
    <h2>This week</h2>
    <div class="goals">
      <div><span>Connection requests sent</span>${bar(activitiesSince(ws, ["connection_sent"]), g.connections)}</div>
      <div><span>Conversations started (replies)</span>${bar(activitiesSince(ws, ["replied"]), g.conversations)}</div>
      <div><span>Appointments booked</span>${bar(activitiesSince(ws, ["call_booked"]), g.appointments)}</div>
      <div><span>New followers (profile + page)</span>${fd ? bar(Math.max(0, fd.delta), g.followers) : `<span class="muted">Log your follower counts in <a href="#/growth">Growth</a></span>`}</div>
    </div>
  </section>

  <div class="two">
    <section class="card">
      <h2>Follow-ups due <span class="count">${due.length}</span></h2>
      ${due.length ? `<ul class="list">${due.map((l) => `
        <li><div>${leadLink(l)}<div class="sub">${sub(l)}</div></div>
        <div class="right">${stageBadge(l)}<span class="${l.nextFollowUp < t ? "overdue" : "muted"}">${l.nextFollowUp < t ? "overdue " : ""}${fmtDate(l.nextFollowUp)}</span></div></li>`).join("")}</ul>` : empty("Nothing due", "Set a follow-up date on a lead and it appears here on the day.")}
    </section>
    <section class="card">
      <h2>Hot leads to reach out to <span class="count">${hotUntouched.length}</span></h2>
      ${hotUntouched.length ? `<ul class="list">${hotUntouched.map((l) => `
        <li><div>${leadLink(l)}<div class="sub">${sub(l)}</div></div>
        <div class="right">${tierBadge(l)}<span class="muted">${esc(l.sector || "")}</span></div></li>`).join("")}</ul>` : empty("No untouched hot leads", "Hot = right sector, right title, and warm (follows you or engaged).")}
    </section>
  </div>

  <section class="card">
    <h2>Upcoming appointments</h2>
    ${upcoming.length ? `<ul class="list">${upcoming.map((l) => `<li><div>${leadLink(l)}<div class="sub">${sub(l)}</div></div><div class="right"><strong>${fmtDate(l.appointmentAt)}</strong></div></li>`).join("")}</ul>` : empty("No appointments booked yet")}
  </section>`;
}

function filteredLeads() {
  const q = UI.q.trim().toLowerCase();
  let rows = S.leads.filter((l) =>
    (!q || [name(l), l.company, l.position, l.headline, l.location, l.notes, (l.tags ?? []).join(" ")].join(" ").toLowerCase().includes(q)) &&
    (!UI.stage || (UI.stage === "open" ? isOpen(l) : l.stage === UI.stage)) &&
    (!UI.sector || (UI.sector === "__none" ? !l.sector : l.sector === UI.sector)) &&
    (!UI.tier || l.tier === UI.tier) &&
    (!UI.rel || (l.relationship ?? []).includes(UI.rel)));
  const sorts = {
    score: (a, b) => b.score - a.score,
    name: (a, b) => name(a).localeCompare(name(b)),
    followup: (a, b) => (a.nextFollowUp || "9999").localeCompare(b.nextFollowUp || "9999"),
    recent: (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  };
  return rows.sort(sorts[UI.sort] ?? sorts.score);
}

function opts(list, current) { return list.map(([v, label]) => `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(label)}</option>`).join(""); }

function viewLeads() {
  const rows = filteredLeads();
  const sectors = [...new Set(S.leads.map((l) => l.sector).filter(Boolean))].sort();
  return `
  <div class="head-row"><h1>Leads</h1><div class="actions"><a class="btn ghost" href="/api/export.csv">Export CSV</a><a class="btn" href="#/import">Add leads</a></div></div>
  <div class="filters">
    <input type="search" id="f-q" placeholder="Search name, company, title, notes…" value="${esc(UI.q)}" />
    <select data-filter="stage">${opts([["", "All stages"], ["open", "Open (not closed)"], ...STAGES.map((s) => [s.key, s.label])], UI.stage)}</select>
    <select data-filter="sector">${opts([["", "All sectors"], ...sectors.map((s) => [s, s]), ["__none", "Unknown sector"]], UI.sector)}</select>
    <select data-filter="tier">${opts([["", "All scores"], ["hot", "Hot (70+)"], ["warm", "Warm (45–69)"], ["cool", "Cool (<45)"], ["excluded", "Excluded"]], UI.tier)}</select>
    <select data-filter="rel">${opts([["", "Any relationship"], ...RELATIONSHIPS.map((r) => [r.key, r.label])], UI.rel)}</select>
    <select data-filter="sort">${opts([["score", "Sort: score"], ["followup", "Sort: follow-up date"], ["recent", "Sort: recently updated"], ["name", "Sort: name"]], UI.sort)}</select>
  </div>
  <p class="muted small">${rows.length} of ${S.leads.length} leads</p>
  ${rows.length ? `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Score</th><th>Sector</th><th>Relationship</th><th>Stage</th><th>Follow-up</th><th></th></tr></thead>
    <tbody>${rows.slice(0, 500).map((l) => `
      <tr>
        <td>${leadLink(l)}<div class="sub">${sub(l)}</div></td>
        <td>${tierBadge(l)}</td>
        <td>${esc(l.sector || "—")}</td>
        <td><div class="chips">${(l.relationship ?? []).map((r) => `<span class="chip">${esc(relLabel[r] ?? r)}</span>`).join("")}</div></td>
        <td>${stageBadge(l)}</td>
        <td class="${l.nextFollowUp && l.nextFollowUp < today() && isOpen(l) ? "overdue" : ""}">${fmtDate(l.nextFollowUp) || "—"}</td>
        <td class="right">${l.profileUrl ? `<a class="btn ghost sm" href="${esc(profileHref(l.profileUrl))}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>
    ${rows.length > 500 ? `<p class="muted small">Showing the first 500. Narrow the filters to see the rest.</p>` : ""}` : empty("No leads match", "Clear a filter, or add leads from the Add & import page.")}`;
}

function profileHref(url) {
  const u = String(url).trim();
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u.replace(/^\/+/, "")}`;
}

function viewPipeline() {
  const cols = STAGES.filter((s) => !["lost", "not_fit"].includes(s.key));
  const closed = S.leads.filter((l) => ["lost", "not_fit"].includes(l.stage)).length;
  return `
  <div class="head-row"><h1>Pipeline</h1><span class="muted">Drag a card to move it. ${closed} lost / not a fit hidden.</span></div>
  <div class="board">${cols.map((c) => {
    const items = S.leads.filter((l) => l.stage === c.key).sort((a, b) => b.score - a.score);
    return `<div class="col" data-drop="${c.key}">
      <div class="col-head"><span>${esc(c.label)}</span><span class="count">${items.length}</span></div>
      <div class="col-body">${items.slice(0, 100).map((l) => `
        <div class="kcard" draggable="true" data-drag="${esc(l.id)}" data-open="${esc(l.id)}">
          <div class="kname">${esc(name(l))}</div>
          <div class="sub">${sub(l)}</div>
          <div class="kmeta">${tierBadge(l)}${l.nextFollowUp ? `<span class="${l.nextFollowUp < today() ? "overdue" : "muted"}">${fmtDate(l.nextFollowUp)}</span>` : ""}</div>
        </div>`).join("")}${items.length > 100 ? `<div class="muted small">+${items.length - 100} more</div>` : ""}</div>
    </div>`;
  }).join("")}</div>`;
}

function viewSectors() {
  const prio = Object.fromEntries(S.settings.sectors.map((s) => [s.name, s.priority]));
  const groups = new Map();
  for (const l of S.leads) {
    const k = l.sector || "Unknown";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  }
  const reached = (l, from) => stageIdx(l.stage) >= stageIdx(from) && !["lost", "not_fit"].includes(l.stage);
  const rows = [...groups.entries()].map(([sector, ls]) => ({
    sector,
    priority: prio[sector] ?? 0,
    total: ls.length,
    followers: ls.filter((l) => (l.relationship ?? []).some((r) => ["follows_me", "follows_page", "engaged"].includes(r))).length,
    hot: ls.filter((l) => l.tier === "hot").length,
    conversations: ls.filter((l) => reached(l, "conversation")).length,
    booked: ls.filter((l) => reached(l, "booked")).length,
    won: ls.filter((l) => l.stage === "won").length,
  })).sort((a, b) => b.priority - a.priority || b.followers - a.followers || b.total - a.total);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const prioLabel = ["Not targeted", "Low", "Medium", "High"];
  // Sectors you're not targeting but whose people already follow or engage with you are a signal worth acting on.
  const hidden = rows.filter((r) => r.priority === 0 && r.sector !== "Unknown" && r.followers >= 3).slice(0, 3);
  return `
  <h1>Sectors</h1>
  <p class="lede">Which sectors follow you, talk to you and book calls. Use it to decide where to aim your content and outreach.</p>
  ${hidden.length ? `<div class="callout">Untapped demand: ${hidden.map((r) => `<strong>${esc(r.sector)}</strong> (${r.followers} following/engaging)`).join(", ")}. You aren't targeting ${hidden.length > 1 ? "these" : "this"} yet. Consider adding ${hidden.length > 1 ? "them" : "it"} in <a href="#/settings">Targeting</a>.</div>` : ""}
  ${rows.length ? `<div class="table-wrap"><table>
    <thead><tr><th>Sector</th><th>Priority</th><th class="num">Leads</th><th class="num">Followers / engaged</th><th class="num">Hot</th><th class="num">Conversations</th><th class="num">Booked</th><th class="num">Won</th><th class="num">Lead → booked</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td><button class="link" data-sector-filter="${esc(r.sector === "Unknown" ? "__none" : r.sector)}">${esc(r.sector)}</button></td>
      <td><span class="prio p${r.priority}">${prioLabel[r.priority]}</span></td>
      <td class="num">${r.total}</td><td class="num">${r.followers}</td><td class="num">${r.hot}</td>
      <td class="num">${r.conversations}</td><td class="num">${r.booked}</td><td class="num">${r.won}</td><td class="num">${pct(r.booked, r.total)}</td>
    </tr>`).join("")}</tbody></table></div>` : empty("No leads yet")}`;
}

function chart(log) {
  if (log.length < 2) return `<p class="muted">Log at least two dates to see the trend.</p>`;
  const W = 720, H = 220, P = 34;
  const series = [
    { key: "profileFollowers", label: "Profile followers", cls: "l1" },
    { key: "pageFollowers", label: "Page followers", cls: "l2" },
    { key: "connections", label: "Connections", cls: "l3" },
  ].filter((s) => log.some((e) => e[s.key] != null));
  const vals = series.flatMap((s) => log.map((e) => e[s.key]).filter((v) => v != null));
  const min = Math.min(...vals), max = Math.max(...vals);
  const t0 = Date.parse(log[0].date), t1 = Date.parse(log[log.length - 1].date);
  const x = (d) => P + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v) => H - P - ((v - min) / Math.max(1, max - min)) * (H - 2 * P);
  const lines = series.map((s) => {
    const pts = log.filter((e) => e[s.key] != null).map((e) => `${x(e.date).toFixed(1)},${y(e[s.key]).toFixed(1)}`);
    return `<polyline class="${s.cls}" fill="none" points="${pts.join(" ")}" />`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Follower growth">
    <line class="axis" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" />
    <text x="${P}" y="${P - 10}" class="tick">${max.toLocaleString()}</text>
    <text x="${P}" y="${H - P + 18}" class="tick">${fmtDate(log[0].date)}</text>
    <text x="${W - P}" y="${H - P + 18}" class="tick" text-anchor="end">${fmtDate(log[log.length - 1].date)}</text>
    ${lines}
  </svg>
  <div class="legend">${series.map((s) => `<span><i class="${s.cls}"></i>${s.label}</span>`).join("")}</div>`;
}

function viewGrowth() {
  const log = S.followerLog;
  const last = log[log.length - 1];
  const fd = followerDelta(weekStart());
  const d30 = followerDelta(addDays(-30));
  const followerLeads = S.leads.filter((l) => (l.relationship ?? []).some((r) => r === "follows_me" || r === "follows_page"));
  const followerSectors = Object.entries(followerLeads.reduce((m, l) => ((m[l.sector || "Unknown"] = (m[l.sector || "Unknown"] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return `
  <h1>Growth</h1>
  <p class="lede">LinkedIn doesn't share follower history, so log your counts once a week (Monday works well). The trend shows whether your content is landing.</p>
  <div class="stats">
    ${stat("Profile followers", last?.profileFollowers?.toLocaleString() ?? "—")}
    ${stat("Page followers", last?.pageFollowers?.toLocaleString() ?? "—")}
    ${stat("New this week", fd ? (fd.delta >= 0 ? "+" : "") + fd.delta : "—", `goal ${S.settings.weeklyGoals.followers}`, fd && fd.delta >= S.settings.weeklyGoals.followers ? "good" : "")}
    ${stat("Last 30 days", d30 ? (d30.delta >= 0 ? "+" : "") + d30.delta : "—")}
  </div>
  <section class="card">
    <h2>Log today's numbers</h2>
    <form id="follower-form" class="inline-form">
      <label>Date<input type="date" name="date" value="${today()}" required /></label>
      <label>Profile followers<input type="number" min="0" name="profileFollowers" value="${last?.profileFollowers ?? ""}" /></label>
      <label>Page followers<input type="number" min="0" name="pageFollowers" value="${last?.pageFollowers ?? ""}" /></label>
      <label>Connections<input type="number" min="0" name="connections" value="${last?.connections ?? ""}" /></label>
      <button class="btn" type="submit">Save</button>
    </form>
    <p class="muted small">Profile followers: your profile → "Followers" under your name. Page followers: your Company Page → Analytics → Followers.</p>
  </section>
  <section class="card">
    <h2>Trend</h2>
    ${chart(log)}
  </section>
  <div class="two">
    <section class="card">
      <h2>Who follows you, by sector</h2>
      ${followerSectors.length ? `<ul class="list">${followerSectors.map(([s, n]) => `<li><span>${esc(s)}</span><strong>${n}</strong></li>`).join("")}</ul><p class="muted small">Write more for the sectors at the top, and for the target sectors that aren't there yet.</p>` : empty("No followers tagged yet", "Tag leads as “Follows me” or “Follows my page” when you add them.")}
    </section>
    <section class="card">
      <h2>History</h2>
      ${log.length ? `<table class="compact"><thead><tr><th>Date</th><th class="num">Profile</th><th class="num">Page</th><th class="num">Connections</th><th></th></tr></thead><tbody>${[...log].reverse().slice(0, 20).map((e) => `<tr><td>${fmtDate(e.date)}</td><td class="num">${e.profileFollowers ?? "—"}</td><td class="num">${e.pageFollowers ?? "—"}</td><td class="num">${e.connections ?? "—"}</td><td class="right"><button class="link danger" data-del-follow="${esc(e.date)}">Remove</button></td></tr>`).join("")}</tbody></table>` : empty("Nothing logged yet")}
    </section>
  </div>`;
}

const relCheckboxes = (prefix, checked = []) => RELATIONSHIPS.map((r) => `<label class="check"><input type="checkbox" name="${prefix}" value="${r.key}"${checked.includes(r.key) ? " checked" : ""} /> ${esc(r.label)}</label>`).join("");

function viewImport() {
  return `
  <h1>Add &amp; import</h1>
  <p class="lede">Bring in your connections, followers and anyone who engages with you. Duplicates are merged, never doubled.</p>
  <div class="two">
    <section class="card">
      <h2>1. Import your LinkedIn connections</h2>
      <ol class="steps">
        <li>On LinkedIn: <strong>Me → Settings &amp; Privacy → Data privacy → Get a copy of your data</strong>.</li>
        <li>Choose <strong>Connections</strong> only, request the archive, and download it (usually ready in about 10 minutes).</li>
        <li>Upload <code>Connections.csv</code> below. Sector and score are worked out from each person's title and company.</li>
      </ol>
      <p class="muted small">Also works with Sales Navigator, CRM or spreadsheet exports. Recognised columns include First/Last Name, Name, URL, Company, Position/Title, Headline, Location, Industry, Email.</p>
      <form id="csv-form">
        <label class="file">CSV file<input type="file" name="file" accept=".csv,text/csv" /></label>
        <details><summary>…or paste CSV text</summary><textarea name="text" rows="5" placeholder="First Name,Last Name,URL,Company,Position"></textarea></details>
        <fieldset><legend>Everyone in this file…</legend>${relCheckboxes("rel", ["connection"])}</fieldset>
        <label>Tags (optional, comma separated)<input name="tags" placeholder="e.g. webinar-oct, dubai-event" /></label>
        <button class="btn" type="submit">Import</button>
      </form>
    </section>
    <section class="card">
      <h2>2. Paste followers or post engagers</h2>
      <p class="muted small">LinkedIn doesn't let you export follower lists or post reactions. Open <strong>My Network → Followers</strong>, your <strong>Page → Followers</strong>, or a post's reactions, and paste one person per line:</p>
      <pre class="example">Sarah Khan - Head of Operations at Gulf Bank
James Lee | Founder, Brightline Analytics
Priya Patel, CFO, Meridian Health</pre>
      <form id="paste-form">
        <textarea name="lines" rows="7" placeholder="Name - Title at Company"></textarea>
        <fieldset><legend>These people…</legend>${relCheckboxes("rel", ["follows_me"])}</fieldset>
        <label>Tags (optional)<input name="tags" /></label>
        <button class="btn" type="submit">Add people</button>
      </form>
    </section>
  </div>
  <section class="card">
    <h2>3. Add one lead</h2>
    <form id="lead-form" class="grid-form">
      <label>First name<input name="firstName" required /></label>
      <label>Last name<input name="lastName" /></label>
      <label>Job title<input name="position" /></label>
      <label>Company<input name="company" /></label>
      <label class="wide">LinkedIn profile URL<input name="profileUrl" placeholder="https://www.linkedin.com/in/…" /></label>
      <label class="wide">Headline<input name="headline" /></label>
      <label>Location<input name="location" /></label>
      <label>Email<input name="email" type="email" /></label>
      <fieldset class="wide"><legend>Relationship</legend>${relCheckboxes("rel")}</fieldset>
      <label class="wide">Notes<textarea name="notes" rows="2"></textarea></label>
      <div class="wide"><button class="btn" type="submit">Add lead</button></div>
    </form>
  </section>`;
}

const PRIO = [[0, "Not targeted"], [1, "Low"], [2, "Medium"], [3, "High"]];

function sectorRow(s, i) {
  return `<tr data-sector-row="${i}">
    <td><input name="name" value="${esc(s.name)}" /></td>
    <td><select name="priority">${PRIO.map(([v, l]) => `<option value="${v}"${v === s.priority ? " selected" : ""}>${l}</option>`).join("")}</select></td>
    <td><input name="keywords" value="${esc(s.keywords.join(", "))}" /></td>
    <td><button type="button" class="link danger" data-remove-row>Remove</button></td>
  </tr>`;
}
function templateRow(t) {
  return `<div class="tpl" data-template-row data-id="${esc(t.id)}">
    <input name="name" value="${esc(t.name)}" placeholder="Template name" />
    <textarea name="body" rows="3">${esc(t.body)}</textarea>
    <button type="button" class="link danger" data-remove-row>Remove</button>
  </div>`;
}

function viewSettings() {
  const st = S.settings;
  const g = st.weeklyGoals;
  return `
  <h1>Targeting</h1>
  <p class="lede">Describe who buys from you. Every lead is re-scored as soon as you save.</p>
  <form id="settings-form">
    <section class="card">
      <h2>What you sell</h2>
      <textarea name="services" rows="2" placeholder="e.g. Interim programme leadership and transformation recovery for banks and insurers in the UK and GCC">${esc(st.services)}</textarea>
    </section>
    <section class="card">
      <h2>Sectors</h2>
      <p class="muted small">Set a priority on the sectors that buy your services. Keywords are matched against each lead's title, headline and company to work out their sector.</p>
      <div class="table-wrap"><table class="edit"><thead><tr><th style="width:24%">Sector</th><th style="width:16%">Priority</th><th>Keywords (comma separated)</th><th></th></tr></thead>
        <tbody id="sector-rows">${st.sectors.map(sectorRow).join("")}</tbody></table></div>
      <button type="button" class="btn ghost sm" data-add-sector>+ Add sector</button>
    </section>
    <div class="two">
      <section class="card">
        <h2>Decision-maker titles</h2>
        <p class="muted small">Titles of people who sign off on your services. Matching leads score +25.</p>
        <textarea name="targetTitles" rows="3" placeholder="e.g. coo, head of transformation, chief operating officer, programme director">${esc(st.targetTitles.join(", "))}</textarea>
      </section>
      <section class="card">
        <h2>Target locations</h2>
        <p class="muted small">Matching leads score +10.</p>
        <textarea name="targetLocations" rows="3" placeholder="e.g. london, dubai, riyadh, uae">${esc(st.targetLocations.join(", "))}</textarea>
      </section>
    </div>
    <section class="card">
      <h2>Exclude</h2>
      <p class="muted small">Anyone whose title, headline or company contains one of these scores 0 (e.g. competitors, recruiters, students).</p>
      <textarea name="excludeKeywords" rows="2" placeholder="e.g. student, recruiter, competitor ltd">${esc(st.excludeKeywords.join(", "))}</textarea>
    </section>
    <section class="card">
      <h2>Weekly goals</h2>
      <div class="inline-form">
        <label>Connection requests<input type="number" min="0" name="goal-connections" value="${g.connections}" /></label>
        <label>Conversations<input type="number" min="0" name="goal-conversations" value="${g.conversations}" /></label>
        <label>Appointments<input type="number" min="0" name="goal-appointments" value="${g.appointments}" /></label>
        <label>New followers<input type="number" min="0" name="goal-followers" value="${g.followers}" /></label>
      </div>
      <p class="muted small">Keep connection requests under about 100 a week; LinkedIn restricts accounts that send more.</p>
    </section>
    <section class="card">
      <h2>Message templates</h2>
      <p class="muted small">Placeholders: {firstName}, {lastName}, {company}, {position}, {sector}. Templates are filled in on each lead so you can copy, personalise and send yourself.</p>
      <div id="template-rows">${st.templates.map(templateRow).join("")}</div>
      <button type="button" class="btn ghost sm" data-add-template>+ Add template</button>
    </section>
    <div class="sticky-save"><button class="btn" type="submit">Save and re-score all leads</button></div>
  </form>
  <section class="card">
    <h2>Your data</h2>
    <p class="muted small">Everything is stored in one file on the machine running the tracker (<code>data/leads.json</code>). Take a backup now and then.</p>
    <div class="actions">
      <a class="btn ghost" href="/api/export.csv">Export leads (CSV)</a>
      <a class="btn ghost" href="/api/backup">Download full backup (JSON)</a>
      <label class="btn ghost file-btn">Restore from backup<input type="file" id="restore-file" accept=".json,application/json" hidden /></label>
    </div>
  </section>`;
}

// ---------- lead drawer ----------

function drawerHtml(l) {
  const sectors = S.settings.sectors.map((s) => s.name);
  if (l.sector && !sectors.includes(l.sector)) sectors.push(l.sector);
  const tpls = S.settings.templates;
  return `
  <div class="drawer-head">
    <div><h2>${esc(name(l))}</h2><div class="sub">${sub(l)}</div></div>
    <button class="icon" data-close aria-label="Close">✕</button>
  </div>
  <div class="drawer-body">
    <div class="score-box">${tierBadge(l)}${stageBadge(l)}${l.profileUrl ? `<a class="btn sm" href="${esc(profileHref(l.profileUrl))}" target="_blank" rel="noopener">Open on LinkedIn ↗</a>` : ""}</div>
    <ul class="reasons">${(l.scoreReasons ?? []).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>

    <h3>Log what happened</h3>
    <div class="quick">${["engaged_post", "connection_sent", "connection_accepted", "message_sent", "replied", "call_booked", "call_held"].map((k) => `<button class="btn ghost sm" data-quick-activity="${k}">${esc(actLabel[k])}</button>`).join("")}</div>
    <form id="activity-form" class="activity-form">
      <select name="type">${ACTIVITY_TYPES.map((a) => `<option value="${a.key}">${esc(a.label)}</option>`).join("")}</select>
      <input type="date" name="at" value="${today()}" />
      <input name="note" placeholder="Note (optional)" />
      <button class="btn sm" type="submit">Log</button>
    </form>

    <h3>Next step</h3>
    <div class="quick">
      <span class="muted small">Follow up:</span>
      <button class="btn ghost sm" data-followup="1">Tomorrow</button>
      <button class="btn ghost sm" data-followup="3">In 3 days</button>
      <button class="btn ghost sm" data-followup="7">Next week</button>
      <button class="btn ghost sm" data-followup="30">In a month</button>
      ${l.nextFollowUp ? `<button class="btn ghost sm" data-followup="clear">Clear</button>` : ""}
    </div>

    <h3>Message</h3>
    ${tpls.length ? `<div class="tpl-use">
      <select id="tpl-select">${tpls.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select>
      <textarea id="tpl-text" rows="4">${esc(fillTemplate(tpls[0].body, l))}</textarea>
      <div class="actions"><button class="btn sm" data-copy>Copy message</button><span class="muted small">Paste it into LinkedIn and personalise before sending.</span></div>
    </div>` : `<p class="muted small">Add templates in Targeting.</p>`}

    <h3>Details</h3>
    <form id="edit-form" class="grid-form">
      <label>First name<input name="firstName" value="${esc(l.firstName)}" /></label>
      <label>Last name<input name="lastName" value="${esc(l.lastName)}" /></label>
      <label>Job title<input name="position" value="${esc(l.position)}" /></label>
      <label>Company<input name="company" value="${esc(l.company)}" /></label>
      <label class="wide">Headline<input name="headline" value="${esc(l.headline)}" /></label>
      <label>Sector<select name="sector"><option value="">Auto-detect</option>${sectors.map((s) => `<option${s === l.sector && l.sectorManual ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label>Stage<select name="stage">${STAGES.map((s) => `<option value="${s.key}"${s.key === l.stage ? " selected" : ""}>${esc(s.label)}</option>`).join("")}</select></label>
      <label>Next follow-up<input type="date" name="nextFollowUp" value="${esc(l.nextFollowUp)}" /></label>
      <label>Appointment date<input type="date" name="appointmentAt" value="${esc(l.appointmentAt)}" /></label>
      <label>Location<input name="location" value="${esc(l.location)}" /></label>
      <label>Email<input name="email" value="${esc(l.email)}" /></label>
      <label class="wide">LinkedIn URL<input name="profileUrl" value="${esc(l.profileUrl)}" /></label>
      <fieldset class="wide"><legend>Relationship</legend>${relCheckboxes("rel", l.relationship ?? [])}</fieldset>
      <label class="wide">Tags<input name="tags" value="${esc((l.tags ?? []).join(", "))}" /></label>
      <label class="wide">Notes<textarea name="notes" rows="3">${esc(l.notes)}</textarea></label>
      <div class="wide actions"><button class="btn" type="submit">Save</button><button type="button" class="link danger" data-delete-lead>Delete lead</button></div>
    </form>

    <h3>History</h3>
    ${(l.activities ?? []).length ? `<ul class="timeline">${l.activities.map((a) => `<li><span class="when">${fmtDate(a.at)}</span><span><strong>${esc(actLabel[a.type] ?? a.type)}</strong>${a.note ? ` — ${esc(a.note)}` : ""}</span><button class="link danger small" data-del-activity="${esc(a.id)}">×</button></li>`).join("")}</ul>` : `<p class="muted small">Nothing logged yet.</p>`}
    <p class="muted small">Added ${fmtDate(l.createdAt)}${l.source ? ` via ${esc(l.source)}` : ""}${l.connectedOn ? ` · connected ${esc(l.connectedOn)}` : ""}</p>
  </div>`;
}

function openDrawer(id) {
  const l = S.leads.find((x) => x.id === id);
  if (!l) return closeDrawer();
  UI.openLeadId = id;
  const d = $("#drawer");
  d.innerHTML = drawerHtml(l);
  d.hidden = false;
  $("#scrim").hidden = false;
}
function closeDrawer() {
  UI.openLeadId = null;
  $("#drawer").hidden = true;
  $("#scrim").hidden = true;
}

// ---------- router ----------

const VIEWS = { today: viewToday, leads: viewLeads, pipeline: viewPipeline, sectors: viewSectors, growth: viewGrowth, import: viewImport, settings: viewSettings };
const route = () => (location.hash.replace(/^#\//, "").split("?")[0] || "today");

function render() {
  const r = VIEWS[route()] ? route() : "today";
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === r));
  const focusId = document.activeElement?.id;
  const caret = document.activeElement?.selectionStart;
  $("#view").innerHTML = VIEWS[r]();
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret); } }
  if (UI.openLeadId) openDrawer(UI.openLeadId);
}

// ---------- events ----------

const formRels = (form) => [...form.querySelectorAll('input[name="rel"]:checked')].map((i) => i.value);

async function guarded(fn) {
  try { await fn(); } catch (e) { toast(e.message, true); }
}

document.addEventListener("click", (e) => guarded(async () => {
  const t = e.target.closest("[data-open],[data-close],[data-followup],[data-quick-activity],[data-copy],[data-delete-lead],[data-del-activity],[data-del-follow],[data-add-sector],[data-add-template],[data-remove-row],[data-sector-filter]");
  if (!t) { if (e.target.id === "scrim") closeDrawer(); return; }
  const lead = () => S.leads.find((l) => l.id === UI.openLeadId);

  if (t.dataset.open && !t.closest("#drawer")) return openDrawer(t.dataset.open);
  if ("close" in t.dataset) return closeDrawer();
  if (t.dataset.sectorFilter) { Object.assign(UI, { sector: t.dataset.sectorFilter, stage: "", tier: "", rel: "", q: "" }); location.hash = "#/leads"; return; }
  if (t.dataset.followup) {
    const v = t.dataset.followup === "clear" ? "" : addDays(Number(t.dataset.followup));
    upsertLocal(await api("PATCH", `leads/${UI.openLeadId}`, { nextFollowUp: v }));
    toast(v ? `Follow-up set for ${fmtDate(v)}` : "Follow-up cleared");
    return render();
  }
  if (t.dataset.quickActivity) {
    upsertLocal(await api("POST", `leads/${UI.openLeadId}/activities`, { type: t.dataset.quickActivity }));
    toast(`Logged: ${actLabel[t.dataset.quickActivity]}`);
    return render();
  }
  if ("copy" in t.dataset) {
    const txt = $("#tpl-text").value;
    try { await navigator.clipboard.writeText(txt); } catch { $("#tpl-text").select(); document.execCommand("copy"); }
    return toast("Message copied");
  }
  if ("deleteLead" in t.dataset) {
    const l = lead();
    if (!confirm(`Delete ${name(l)} and their history?`)) return;
    await api("DELETE", `leads/${l.id}`);
    S.leads = S.leads.filter((x) => x.id !== l.id);
    closeDrawer();
    toast("Lead deleted");
    return render();
  }
  if (t.dataset.delActivity) {
    upsertLocal(await api("DELETE", `leads/${UI.openLeadId}/activities/${t.dataset.delActivity}`));
    return render();
  }
  if (t.dataset.delFollow) {
    await api("DELETE", `followers/${t.dataset.delFollow}`);
    S.followerLog = S.followerLog.filter((x) => x.date !== t.dataset.delFollow);
    return render();
  }
  if ("addSector" in t.dataset) {
    $("#sector-rows").insertAdjacentHTML("beforeend", sectorRow({ name: "", priority: 2, keywords: [] }, Date.now()));
    return $("#sector-rows tr:last-child input").focus();
  }
  if ("addTemplate" in t.dataset) return $("#template-rows").insertAdjacentHTML("beforeend", templateRow({ id: "", name: "", body: "" }));
  if ("removeRow" in t.dataset) return t.closest("[data-sector-row],[data-template-row]").remove();
}));

document.addEventListener("input", (e) => {
  if (e.target.id === "f-q") { UI.q = e.target.value; render(); }
});

document.addEventListener("change", (e) => guarded(async () => {
  const t = e.target;
  if (t.dataset.filter) { UI[t.dataset.filter] = t.value; return render(); }
  if (t.id === "tpl-select") {
    const tpl = S.settings.templates.find((x) => x.id === t.value);
    $("#tpl-text").value = fillTemplate(tpl?.body ?? "", S.leads.find((l) => l.id === UI.openLeadId));
    return;
  }
  if (t.id === "restore-file" && t.files[0]) {
    if (!confirm("Replace everything in the tracker with this backup?")) return;
    S = await api("POST", "restore", JSON.parse(await t.files[0].text()));
    toast("Backup restored");
    return render();
  }
}));

document.addEventListener("submit", (e) => guarded(async () => {
  const f = e.target;
  e.preventDefault();
  const fd = new FormData(f);
  const val = (k) => String(fd.get(k) ?? "").trim();

  if (f.id === "csv-form") {
    const file = fd.get("file");
    const csv = file && file.size ? await file.text() : val("text");
    if (!csv) throw new Error("Choose a CSV file or paste CSV text");
    const r = await api("POST", "import", { csv, relationship: formRels(f), tags: val("tags"), source: file && file.size ? file.name : "Pasted CSV" });
    await reload();
    toast(`Imported: ${r.created} new, ${r.updated} merged${r.skipped ? `, ${r.skipped} skipped` : ""}`);
    location.hash = "#/leads";
    return render();
  }
  if (f.id === "paste-form") {
    const rows = val("lines").split(/\n+/).map(parseLine).filter(Boolean);
    if (!rows.length) throw new Error("Paste at least one name");
    const csv = toCsv([["Name", "Position", "Company", "Headline"], ...rows.map((r) => [r.name, r.position, r.company, r.headline])]);
    const r = await api("POST", "import", { csv, relationship: formRels(f), tags: val("tags"), source: "Pasted list" });
    await reload();
    toast(`Added ${r.created} new, ${r.updated} merged`);
    f.reset();
    return render();
  }
  if (f.id === "lead-form") {
    const lead = await api("POST", "leads", { ...Object.fromEntries(fd), relationship: formRels(f), source: "Added by hand" });
    upsertLocal(lead);
    f.reset();
    toast(`${name(lead)} added (score ${lead.score})`);
    return openDrawer(lead.id);
  }
  if (f.id === "edit-form") {
    const body = Object.fromEntries(fd);
    delete body.rel;
    body.relationship = formRels(f);
    body.tags = val("tags").split(",");
    body.sectorManual = Boolean(body.sector);
    upsertLocal(await api("PATCH", `leads/${UI.openLeadId}`, body));
    toast("Saved");
    return render();
  }
  if (f.id === "activity-form") {
    upsertLocal(await api("POST", `leads/${UI.openLeadId}/activities`, { type: val("type"), at: val("at"), note: val("note") }));
    toast("Logged");
    return render();
  }
  if (f.id === "follower-form") {
    await api("POST", "followers", Object.fromEntries(fd));
    await reload();
    toast("Saved");
    return render();
  }
  if (f.id === "settings-form") {
    const sectors = [...f.querySelectorAll("[data-sector-row]")].map((row) => ({
      name: row.querySelector('[name="name"]').value,
      priority: Number(row.querySelector('[name="priority"]').value),
      keywords: row.querySelector('[name="keywords"]').value.split(","),
    }));
    const templates = [...f.querySelectorAll("[data-template-row]")].map((row) => ({ id: row.dataset.id, name: row.querySelector('[name="name"]').value, body: row.querySelector('[name="body"]').value }));
    await api("PUT", "settings", {
      services: val("services"),
      sectors,
      templates,
      targetTitles: val("targetTitles").split(","),
      targetLocations: val("targetLocations").split(","),
      excludeKeywords: val("excludeKeywords").split(","),
      weeklyGoals: { connections: val("goal-connections"), conversations: val("goal-conversations"), appointments: val("goal-appointments"), followers: val("goal-followers") },
    });
    await reload();
    toast("Saved. All leads re-scored.");
    return render();
  }
}));

/** "Sarah Khan - Head of Ops at Gulf Bank" / "James Lee | Founder, Brightline" / "Priya Patel, CFO, Meridian". */
export function parseLine(line) {
  const s = line.trim();
  if (!s) return null;
  const m = s.match(/^(.+?)\s*(?:\s[-–—|•·]\s|\t|,)\s*(.+)$/);
  const nm = (m ? m[1] : s).trim();
  const rest = (m ? m[2] : "").trim();
  let position = "", company = "";
  const at = rest.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at) { position = at[1]; company = at[2]; }
  else if (rest.includes(",")) { const [p, ...c] = rest.split(","); position = p.trim(); company = c.join(",").trim(); }
  else position = rest;
  return { name: nm, position, company, headline: rest };
}

// Pipeline drag and drop.
document.addEventListener("dragstart", (e) => {
  const card = e.target.closest?.("[data-drag]");
  if (card) e.dataTransfer.setData("text/plain", card.dataset.drag);
});
document.addEventListener("dragover", (e) => { const col = e.target.closest?.("[data-drop]"); if (col) { e.preventDefault(); col.classList.add("over"); } });
document.addEventListener("dragleave", (e) => e.target.closest?.("[data-drop]")?.classList.remove("over"));
document.addEventListener("drop", (e) => guarded(async () => {
  const col = e.target.closest?.("[data-drop]");
  if (!col) return;
  e.preventDefault();
  col.classList.remove("over");
  const id = e.dataTransfer.getData("text/plain");
  const l = S.leads.find((x) => x.id === id);
  if (!l || l.stage === col.dataset.drop) return;
  upsertLocal(await api("PATCH", `leads/${id}`, { stage: col.dataset.drop }));
  toast(`${name(l)} → ${stageLabel[col.dataset.drop]}`);
  render();
}));

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && UI.openLeadId) closeDrawer(); });
window.addEventListener("hashchange", () => { closeDrawer(); render(); });

guarded(async () => { await reload(); render(); });
