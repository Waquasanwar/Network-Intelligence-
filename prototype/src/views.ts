/* Views, drawers, actions and forms for the live prototype. */
import type { State, Person, Conversation, Opportunity, Match, Introduction, Relocation, Relationship, Evidence, Scheduled, TeamMember, Partner, Vouch } from "./types";
import type { View, Raw as RawT } from "./app";
import { readXlsx } from "./xlsx";
import { demandViews } from "./demand-views";
import { memberViews } from "./member-views";

export type Ctx = {
  S: () => State; ai: any; esc: (s: unknown) => string; raw: (s: string) => RawT; h: any; uid: () => string; nowISO: () => string; full: (p: { firstName: string; lastName: string }) => string; list: (s: string | null | undefined) => string[];
  person: (id: string) => Person | undefined; userName: (id: string) => string; relsOf: (id: string) => Relationship[]; evOf: (id: string) => Evidence[]; convOf: (id: string) => Conversation[]; fresh: (p: Person) => string; depth: (p: Person) => number; toMatchPerson: (p: Person) => any;
  commit: (c: string, doc: any, audit?: { action: string; entityType: string; entityId?: string | null; detail?: string | null }) => Promise<void>; removeDoc: (c: string, id: string) => Promise<void>; logAudit: (a: string, t: string, id: string | null, d: string | null) => void;
  toast: (m: string, tone?: string) => void; openDrawer: (t: string, d: string, body: RawT, onSubmit: any, opts?: { wide?: boolean; submitLabel?: string }) => void; setDrawerStep: (t: string, d: string, body: RawT, onSubmit: any, opts?: { submitLabel?: string; back?: boolean; step?: [number, number] }) => void; setStepBack: (fn: (() => void) | null) => void; closeDrawer: () => void; render: () => void; constellation: (c: HTMLCanvasElement | null) => void;
  retrieveMatches: any; capabilityCoverage: any; suggestNextCheck: any; ACTIVE_STATUSES: string[]; redactForPartner: any; parseCsv: any; mapHeaders: any; SOURCE_ALIASES: Record<string, string>; RELATIONSHIP_ALIASES: Record<string, string>; templateCsv: () => string; seed: () => State; persistMode: () => string; savePref: (k: string, v: unknown) => void;
  series: typeof import("@/lib/series");
  credibility: typeof import("@/lib/credibility");
  privacy: typeof import("@/lib/privacy");
  traits: typeof import("@/lib/traits");
  automation: typeof import("@/lib/automation");
  suitability: typeof import("@/lib/suitability");
  saveRateCard: (card: any) => Promise<void>; saveScript: (sections: any[]) => Promise<void>; toBriefPerson: (p: Person) => any; demand: any;
  trustOf: (p: Person) => any; fitOf: (p: Person) => any; vouchesOf: (id: string) => any[]; alerts: () => any[]; setViewAs: (v: any) => void; trust: any; screening: any; fit: any;
  labels: Record<string, any>;
};
let C: Ctx;
export function setContext(c: Ctx) { C = c; }

// ---------- atoms ----------
const esc = (s: unknown) => C.esc(s);
const raw = (s: string) => C.raw(s);
const L = () => C.labels;
const rel = (d?: string | null) => { if (!d) return "—"; const diff = (new Date(d).getTime() - Date.now()) / 86_400_000; const a = Math.round(Math.abs(diff)); if (a === 0) return "today"; const unit = a >= 30 ? `${Math.round(a / 30)} mo` : a >= 7 ? `${Math.round(a / 7)} wk` : `${a} d`; return diff < 0 ? `${unit} ago` : `in ${unit}`; };
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const initials = (p: { firstName: string; lastName: string }) => `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
const hueOf = (p: { firstName: string; lastName: string }) => { let x = 0; for (const c of C.full(p)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 4; };
const money = (v?: number | null, cur = "GBP") => (v === null || v === undefined ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v));
const moneyCompact = (v: number, cur = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, notation: "compact", maximumFractionDigits: 1 }).format(v);
const opt = (entries: Record<string, string>, current?: string | null, blank?: string) => (blank !== undefined ? `<option value="">${esc(blank)}</option>` : "") + Object.entries(entries).map(([k, v]) => `<option value="${k}" ${k === current ? "selected" : ""}>${esc(v)}</option>`).join("");
const avatar = (p: { firstName: string; lastName: string; photoUrl?: string | null; privacy?: any }, size = "md", ring = false) => {
  const photo = C.privacy.canShowPhoto(p as any, "internal");
  return `<span class="avatar hue-${hueOf(p)} ${size} ${ring ? "ring" : ""} ${photo ? "has-photo" : ""}">${photo ? `<img src="${esc(p.photoUrl)}" alt="" loading="lazy">` : `<span>${esc(initials(p))}</span>`}</span>`;
};
const badge = (label: string, tone = "neutral", filled = false) => `<span class="badge ${filled ? "filled" : ""} tone-${tone}"><i></i>${esc(label)}</span>`;
const chip = (t: string) => `<span class="chip">${esc(t)}</span>`;
function availBadge(p: Person) { const f = C.fresh(p); const tone = f === "stale" || f === "unknown" ? "amber" : L().AVAILABILITY_TONE[p.availabilityStatus]; return `${badge(L().AVAILABILITY_LABELS[p.availabilityStatus], tone)}${f === "stale" && p.availabilityStatus !== "NEEDS_REFRESH" ? '<span class="stale">stale</span>' : f === "aging" ? '<span class="aging">aging</span>' : ""}`; }
function thread(p: Person, compact = true, linked = true) {
  const r = C.relsOf(p.id)[0]; if (!r) return badge("provenance missing", "amber");
  const intro = r.introducedById ? C.person(r.introducedById) : null; const short = (n: string) => (compact ? n.split(" ")[0] : n);
  // `linked` is off wherever the chain sits inside a link of its own: an anchor inside an anchor is
  // invalid, and the browser silently lifts it out of its parent, which tears the card apart.
  const mid = intro ? (linked ? `<a href="#/people/${intro.id}">${esc(short(C.full(intro)))}</a>` : esc(short(C.full(intro)))) : "";
  return `<span class="thread" title="${esc(C.userName(r.networkOwnerId))}${intro ? ` via ${esc(C.full(intro))}` : ""}${r.workedTogether ? " · worked together" : ""}"><span class="node self"><i></i>${esc(short(C.userName(r.networkOwnerId)))}</span>${intro ? `<span class="link"></span><span class="node"><i></i>${mid}</span>` : ""}<span class="link ${r.workedTogether ? "worked" : ""}"></span><span class="node ${r.workedTogether ? "trusted" : ""}"><i></i>${esc(short(C.full(p)))}</span></span>`;
}
const personLink = (p: Person, sub?: string | null) => `<a class="plink" href="#/people/${p.id}">${avatar(p, "sm")}<span><b>${esc(C.full(p))}</b>${sub === null ? "" : `<small>${esc(sub ?? p.headline ?? "")}</small>`}</span></a>`;
const score = (v: number) => `<div class="score"><div class="bar"><div class="fill ${v >= 70 ? "hi" : v >= 45 ? "mid" : "lo"}" style="width:${Math.max(2, Math.min(100, v))}%"></div></div><span>${v}</span></div>`;
const gauge = (v: number, label: string) => `<div class="gauge"><svg viewBox="0 0 44 44"><circle class="track" cx="22" cy="22" r="18"/><circle class="val ${v >= 70 ? "hi" : v >= 40 ? "mid" : "lo"}" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="${v} 100"/></svg><div><b>${v}</b>${label ? `<small>${esc(label)}</small>` : ""}</div></div>`;
const stat = (label: string, value: string | number, hint?: string, href?: string, tone?: string) => `<${href ? `a href="${href}"` : "div"} class="stat ${tone ?? ""}"><small>${esc(label)}</small><b ${typeof value === "number" ? `data-count="${value}"` : ""}>${esc(value)}</b>${hint ? `<span>${esc(hint)}</span>` : ""}</${href ? "a" : "div"}>`;
const empty = (title: string, desc?: string, action?: string) => `<div class="empty"><b>${esc(title)}</b>${desc ? `<p>${esc(desc)}</p>` : ""}${action ?? ""}</div>`;
const card = (title: string | null, body: string, opts: { desc?: string; action?: string; cls?: string; flush?: boolean } = {}) => `<section class="card ${opts.cls ?? ""}">${title ? `<header><div><h3>${esc(title)}</h3>${opts.desc ? `<p>${esc(opts.desc)}</p>` : ""}</div>${opts.action ?? ""}</header>` : ""}<div class="body ${opts.flush ? "flush" : ""}">${body}</div></section>`;
const field = (label: string, control: string, hint?: string, req = false) => `<label class="field"><span>${esc(label)}${req ? "<em>*</em>" : ""}</span>${control}${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
const input = (name: string, attrs = "", value = "") => `<input name="${name}" value="${esc(value)}" ${attrs}>`;
const textarea = (name: string, attrs = "", value = "") => `<textarea name="${name}" ${attrs}>${esc(value)}</textarea>`;
const select = (name: string, options: string, attrs = "") => `<select name="${name}" ${attrs}>${options}</select>`;
const check = (name: string, label: string, checked = false, value = "on") => `<label class="check"><input type="checkbox" name="${name}" value="${esc(value)}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
const btn = (label: string, attrs = "", variant = "primary") => `<button type="button" class="btn ${variant}" ${attrs}>${label}</button>`;
const rows = (items: string[], emptyMsg: string) => (items.length ? `<ul class="rows">${items.map((x) => `<li>${x}</li>`).join("")}</ul>` : empty(emptyMsg));
const intent = (query: string) => {
  const q = query.toLowerCase();
  const CAPS = ["programme management", "programme director", "project management", "pmo", "transformation", "change management", "cyber security", "cyber", "security architecture", "ciso", "identity and access", "data engineering", "data platform", "data strategy", "analytics", "machine learning", "genai", "cloud", "azure", "aws", "erp", "sap", "salesforce", "servicenow", "enterprise architecture", "solution architecture", "product management", "agile delivery", "devops", "platform engineering", "finance transformation", "cfo", "procurement", "supply chain", "operations", "target operating model", "m&a integration", "regulatory", "compliance", "risk", "governance", "stakeholder management", "vendor management", "systems integrator", "turnaround", "recovery", "commercial", "bid management", "proposal", "delivery lead", "cto", "cio", "coo", " ai"];
  const SECT = ["banking", "financial services", "insurance", "public sector", "government", "healthcare", "nhs", "energy", "utilities", "telecoms", "retail", "consumer", "manufacturing", "defence", "logistics", "technology", "media"];
  const LOCS = ["london", "uk", "manchester", "birmingham", "edinburgh", "dubai", "abu dhabi", "uae", "riyadh", "saudi", "ksa", "doha", "qatar", "remote", "europe", "singapore"];
  const ROUTES: Record<string, string> = { permanent: "PERMANENT", contract: "CONTRACT", "day rate": "CONTRACT", interim: "INTERIM", fractional: "FRACTIONAL", advisory: "ADVISORY", sow: "SOW", "statement of work": "SOW" };
  return { capabilities: CAPS.filter((c) => q.includes(c)).map((c) => c.trim()), sectors: SECT.filter((c) => q.includes(c)), locations: LOCS.filter((c) => q.includes(c)), routes: [...new Set(Object.entries(ROUTES).filter(([k]) => q.includes(k)).map(([, v]) => v))], availableSoon: /available|free|soon|now|next month|finishing/.test(q), workedWithOnly: /worked with|we know|trusted|seen deliver|proven/.test(q) };
};

// ---------- views ----------
function overview(): View {
  const S = C.S(); const me = S.me; const now = Date.now();
  const total = S.people.length;
  const worked = S.people.filter((p) => C.relsOf(p.id).some((r) => r.workedTogether)).length;
  const convs = S.conversations.filter((c) => c.approvalStatus === "APPROVED").length;
  const freshN = S.people.filter((p) => C.fresh(p) === "fresh").length;
  const freshPct = total ? Math.round((freshN / total) * 100) : 0;
  const active = S.opportunities.filter((o) => !["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(o.status));
  const intros = S.introductions.filter((i) => !["DECLINED", "WITHDRAWN"].includes(i.status));
  const screened = S.people.filter((p) => p.screeningStatus === "APPROVED" || p.screenedAt).length;
  const joining = S.people.filter((p) => ["REGISTERED", "INVITED", "BOOKED", "SUBMITTED"].includes(p.screeningStatus ?? "")).length;
  const trustScores = S.people.map((p) => C.trustOf(p).score);
  const trusted = trustScores.filter((x: number) => x >= 60).length;
  const avgTrust = trustScores.length ? Math.round(trustScores.reduce((a: number, b: number) => a + b, 0) / trustScores.length) : 0;
  const vouchedPeople = new Set(S.vouches.map((v) => v.personId)).size;
  const feeCur = S.rateCard.currency; const feeSum = (st: string[]) => S.fees.filter((f) => st.includes(f.status) && f.currency === feeCur).reduce((a, f) => a + f.ourTake, 0); const otherCur = [...new Set(S.fees.filter((f) => f.currency !== feeCur).map((f) => f.currency))];
  const pipeline = feeSum(["FORECAST", "AGREED", "INVOICED"]);
  const upcoming = S.scheduled.filter((s) => s.status === "SCHEDULED" && new Date(s.startAt).getTime() > now - 3600e3).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 5);
  const review = S.conversations.filter((c) => c.approvalStatus === "NEEDS_REVIEW" || c.approvalStatus === "DRAFT").slice(0, 5);
  const reconnect = S.people.filter((p) => C.fresh(p) !== "fresh" && (C.relsOf(p.id).some((r) => r.workedTogether) || C.ACTIVE_STATUSES.includes(p.availabilityStatus) || p.amanaBench)).sort((a, b) => (a.availabilityConfirmedAt ?? "").localeCompare(b.availabilityConfirmedAt ?? "")).slice(0, 5);
  const gaps = S.people.filter((p) => C.evOf(p.id).length === 0 && (C.ACTIVE_STATUSES.includes(p.availabilityStatus) || p.amanaBench)).slice(0, 5);
  const sugg: { text: string; href: string }[] = [];
  for (const o of active.filter((o) => !S.matches.some((m) => m.opportunityId === o.id)).slice(0, 2)) sugg.push({ text: `Find possible matches for "${o.title}" — no suggestions yet.`, href: `#/opportunities/${o.id}` });
  for (const o of active.filter((o) => S.matches.some((m) => m.opportunityId === o.id && m.humanDecision === "UNDECIDED")).slice(0, 2)) sugg.push({ text: `Decide on ${S.matches.filter((m) => m.opportunityId === o.id && m.humanDecision === "UNDECIDED").length} suggestions for "${o.title}".`, href: `#/opportunities/${o.id}` });
  for (const c of review.slice(0, 2)) sugg.push({ text: `Approve the structured summary for ${C.full(C.person(c.personId)!)}.`, href: `#/conversations?tab=review&open=${c.id}` });
  for (const p of reconnect.slice(0, 2)) sugg.push({ text: `Reconnect with ${C.full(p)} — status last confirmed ${p.availabilityConfirmedAt ? fmtDate(p.availabilityConfirmedAt) : "never"}.`, href: `#/people/${p.id}` });
  for (const r of S.requirements.filter((r) => r.status === "INTRO_REQUESTED").slice(0, 1)) sugg.push({ text: `${S.partners.find((p) => p.id === r.partnerId)?.name} has requested an introduction on "${r.title}".`, href: "#/partners" });
  for (const a of C.alerts().slice(0, 4)) sugg.unshift({ text: a.text, href: a.href });
  const hour = new Date().getHours();
  const vouched = S.vouches.filter((v) => v.statement && v.wouldRecommend).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const feature = vouched.length ? vouched[Math.floor(Date.now() / 86400000) % vouched.length] : null;
  const featureOf = feature ? C.person(feature.personId) : null;
  const voucherName = (v: any) => (v.voucherKind === "EXTERNAL" ? v.voucherName ?? "External reference" : C.userName(v.voucherId));
  const chainData = (id: string) => { const vs = S.vouches.filter((v) => v.personId === id && v.wouldRecommend); return { names: vs.map(voucherName).join("|"), count: vs.length }; };
  const fc = featureOf ? chainData(featureOf.id) : { names: "", count: 0 };
  // Every sparkline is twelve real months of this network, not decoration.
  const pts = (p: { value: number }[]) => p.map((x) => x.value).join(",");
  const peoplePts = C.series.cumulative(S.people.map((p) => p.createdAt));
  const screenedPts = C.series.cumulative(S.people.map((p) => p.screenedAt ?? undefined));
  const vouchPts = C.series.cumulative(S.vouches.map((v) => v.createdAt));
  const convPts = C.series.cumulative(S.conversations.filter((c) => c.approvalStatus === "APPROVED").map((c) => c.date));
  const feePts = C.series.monthlySum(S.fees.filter((f) => f.currency === feeCur).map((f) => ({ date: f.updatedAt, value: f.ourTake })));
  const spark = {
    people: pts(peoplePts), screened: pts(screenedPts), vouches: pts(vouchPts), convs: pts(convPts), fees: pts(feePts),
    briefs: pts(C.series.cumulative(S.briefs.map((b) => b.createdAt))),
    proposed: pts(C.series.cumulative(S.shortlist.filter((x) => C.demand.PORTAL_VISIBLE.includes(x.decision)).map((x) => x.updatedAt))),
    referrals: pts(C.series.cumulative(S.referrals.map((r) => r.createdAt))),
    pitches: pts(C.series.cumulative(S.pitches.map((x) => x.createdAt))),
    stale: pts(C.series.monthly(S.people.filter((p) => C.fresh(p) !== "fresh").map((p) => p.updatedAt))),
    bench: pts(C.series.cumulative(S.people.filter((p) => p.amanaBench).map((p) => p.createdAt))),
  };
  const chg = { people: C.series.lastChange(peoplePts), screened: C.series.lastChange(screenedPts), vouches: C.series.lastChange(vouchPts), convs: C.series.lastChange(convPts) };

  // Setup, as a thread rather than a scavenger hunt. Each step is one click from here, and the
  // card disappears the moment the network can actually earn.
  const steps: { done: boolean; label: string; hint: string; act?: string; href?: string }[] = [
    { done: total > 0, label: "Add people you know", hint: `${total} in the network`, act: "addPerson" },
    { done: S.accounts.some((a) => a.kind === "CLIENT" || a.kind === "AGENCY"), label: "Add a client or an agency", hint: "Who pays, and on what terms", act: "setupClient" },
    { done: S.briefs.length > 0, label: "Take a requirement", hint: "A role to fill, in plain words", href: "#/requirements" },
    { done: screened > 0, label: "Run a screening conversation", hint: "The 30-minute call that builds a profile", href: "#/referrals?tab=joining" },
    { done: S.shortlist.some((x) => C.demand.PORTAL_VISIBLE.includes(x.decision)), label: "Propose someone", hint: "They see an anonymised card, never a name", href: "#/requirements" },
    { done: S.fees.length > 0, label: "See the fee that rides on it", hint: "Forecast, agreed, invoiced, paid", href: "#/settings?tab=commercials" },
  ];
  const doneN = steps.filter((x) => x.done).length;
  const setupCard = doneN === steps.length ? "" : card("Getting set up", `<div class="setup-bar"><div style="width:${Math.round((doneN / steps.length) * 100)}%"></div></div>
    <ul class="checklist">${steps.map((x) => `<li class="${x.done ? "done" : ""}"><span class="tick"><ni-icon name="check" size="13"></ni-icon></span><span><b>${esc(x.label)}</b><small>${esc(x.hint)}</small></span>${x.done ? "" : x.act ? btn("Do it", `data-act="${x.act}"`, "glass sm") : `<a class="btn glass sm" href="${x.href}">Do it</a>`}</li>`).join("")}</ul>`, { desc: `${doneN} of ${steps.length} done. Nothing here is compulsory — it is just the shortest path to a fee.` });

  const fees = { forecast: feeSum(["FORECAST"]), agreed: feeSum(["AGREED"]), invoiced: feeSum(["INVOICED"]), paid: feeSum(["PAID"]) };
  const subs = S.accounts.filter((a) => a.portalEnabled && a.status === "ACTIVE").reduce((sum, a) => sum + (a.monthlyFee ?? C.demand.subscriptionFor(a.kind, S.rateCard).amount), 0);
  const catchUps = C.automation.catchUpSuggestions(
    S.people.filter((p) => C.relsOf(p.id).length).map((p) => ({ id: p.id, name: C.full(p), city: p.primaryCity, workedTogether: C.relsOf(p.id).some((r) => r.workedTogether), lastContactAt: C.relsOf(p.id).map((r) => r.lastContactDate).filter(Boolean).sort().reverse()[0] ?? null, openTo: (p.social?.openTo ?? []) as any[], interests: p.persona?.interests ?? [] })),
    S.people.find((p) => C.full(p) === me.name)?.primaryCity ?? "Dubai", new Date(), 3);
  const deciding = S.shortlist.filter((x) => x.decision === "CANDIDATE").length;

  const html = `
    <section class="masthead">
      <div class="mh-eyebrow"><ni-icon name="vouch" size="13" tone="trust"></ni-icon> ${hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening"}, ${esc(me.name.split(" ")[0])} — what the network says today</div>
      ${feature && featureOf ? `<a class="mh-quote" href="#/people/${featureOf.id}"><ni-quote size="lg" by="${esc(voucherName(feature))}" context="on ${esc(C.full(featureOf))} · ${esc(feature.context)}" when="${esc(rel(feature.createdAt))}">${esc(feature.statement!)}</ni-quote></a>` : `<div class="mh-quote"><ni-quote size="lg">Who do we genuinely know who could solve this problem?</ni-quote></div>`}
      <div class="mh-side">
        ${feature && featureOf ? `<div class="mh-chain"><ni-chain people="${esc(fc.names)}" count="${fc.count}" score="${C.trustOf(featureOf).score}"></ni-chain><span>${fc.count} ${fc.count === 1 ? "person stands" : "people stand"} behind ${esc(featureOf.firstName)}</span></div>` : ""}
        <div class="pulse">
          <div class="pulse-head"><span class="eyebrow"><ni-icon name="spark" size="13"></ni-icon> Network pulse</span><small>${esc(new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }))}</small></div>
          <div class="pulse-ring"><span class="pulse-dial"><ni-trust score="${avgTrust}" size="64"></ni-trust><small>avg trust</small></span>
            <ul><li><b>${trusted}</b><small>trusted</small></li><li><b>${worked}</b><small>worked with</small></li><li><b>${freshPct}%</b><small>current</small></li></ul></div>
          <ni-bar segments="Trusted:${trusted || 0.001}:trust|Screened:${Math.max(0, screened - trusted) || 0.001}:accent|Not yet screened:${Math.max(0, total - screened) || 0.001}:mute" height="7"></ni-bar>
        </div>
      </div>
      <div class="mh-actions">${btn("＋ Add a person", 'data-act="addPerson"')}<a class="btn glass" href="#/requirements">Take a requirement</a><a class="btn ghost" href="#/import">Import contacts</a></div>
    </section>
    <section class="board-row">
      <div class="board-tile money"><div class="bt-top"><span><ni-icon name="money" size="15"></ni-icon> Money in play</span><a href="#/requirements">Fees →</a></div>
        <b>${esc(moneyCompact(pipeline, feeCur))}</b><span class="bt-sub">${esc(moneyCompact(subs, S.rateCard.subscriptionCurrency))} a month in subscriptions${otherCur.length ? ` · plus ${esc(otherCur.join(", "))}` : ""}</span>
        <ni-bar hidevalues segments="${esc(`Forecast ${moneyCompact(fees.forecast, feeCur)}`)}:${Math.round(fees.forecast) || 1}:mute|${esc(`Agreed ${moneyCompact(fees.agreed, feeCur)}`)}:${Math.round(fees.agreed) || 1}:accent|${esc(`Invoiced ${moneyCompact(fees.invoiced, feeCur)}`)}:${Math.round(fees.invoiced) || 1}:alert|${esc(`Paid ${moneyCompact(fees.paid, feeCur)}`)}:${Math.round(fees.paid) || 1}:trust" height="8"></ni-bar></div>
      <div class="board-tile bt-todo"><div class="bt-top"><span><ni-icon name="brief" size="15"></ni-icon> To decide</span><a href="#/requirements">The deck →</a></div>
        <b>${deciding}</b><span class="bt-sub">${deciding === 1 ? "expert to decide on" : "experts to decide on"} · ${S.briefs.filter((b) => !["FILLED", "CLOSED"].includes(b.status)).length} open requirements</span>
        <div class="bt-people">${S.shortlist.filter((x) => x.decision === "CANDIDATE").slice(0, 6).map((x) => { const pp = C.person(x.personId); return pp ? avatar(pp, "sm") : ""; }).join("")}</div></div>
      <div class="board-tile see"><div class="bt-top"><span><ni-icon name="person" size="15"></ni-icon> Go and see</span><a href="#/intelligence">Radar →</a></div>
        ${catchUps.length ? `<ul class="bt-list">${catchUps.map((c) => { const pp = C.person(c.personId)!; return `<li>${avatar(pp, "sm")}<span><b>${esc(c.name)}</b><small>${esc(c.reason)}</small></span><button type="button" class="cu-btn sm" data-act="bookCatchUp" data-id="${c.personId}" data-kind="${c.kind}"><span>${C.automation.CATCH_UPS.find((k) => k.key === c.kind)?.emoji ?? "☕"}</span></button></li>`; }).join("")}</ul>` : '<span class="bt-sub">Everyone has been seen recently.</span>'}</div>
    </section>
    <section class="widgets">
      ${([
        ["Experts in the network", String(total), `${worked} you have worked with`, "", spark.people, chg.people, ""],
        ["Screened experts", String(screened), `${joining} in the queue`, "trust", spark.screened, chg.screened, ""],
        ["Trusted", String(trusted), `average score ${avgTrust}`, "trust", spark.vouches, null, ""],
        ["Vouches given", String(S.vouches.length), `across ${vouchedPeople} people`, "", spark.vouches, chg.vouches, ""],
        ["Conversations", String(convs), `${freshPct}% of statuses fresh`, freshPct < 50 ? "alert" : "", spark.convs, chg.convs, ""],
        ["Fees in play", moneyCompact(pipeline, feeCur), `${moneyCompact(feeSum(["AGREED", "INVOICED"]), feeCur)} agreed`, "", spark.fees, null, "#/requirements?tab=fees"],
      ] as [string, string, string, string, string, { delta: number; label: string } | null, string][]).map(([l, v, n, t, sp, d, href]) => `<ni-stat label="${esc(l)}" value="${esc(v)}" note="${esc(n)}" ${t ? `tone="${t}"` : ""} spark="${sp}" ${d ? `delta="${d.delta}" delta-label="${esc(d.label)}"` : ""} ${href ? `href="${href}"` : ""}></ni-stat>`).join("")}
    </section>
    <section class="widgets sub">
      ${([
        ["Open requirements", String(S.briefs.filter((b) => !["FILLED", "CLOSED"].includes(b.status)).length), `${S.briefs.filter((b) => b.submittedVia === "PORTAL").length} came from clients`, "#/requirements", spark.briefs, "up"],
        ["Experts proposed", String(S.shortlist.filter((x) => C.demand.PORTAL_VISIBLE.includes(x.decision)).length), "anonymised, never named", "#/requirements", spark.proposed, "up"],
        ["Referrals", String(S.referrals.length), `${S.referrals.filter((r) => r.status === "ACCEPTED").length} joined the network`, "#/referrals", spark.referrals, "up"],
        ["Pitches waiting", String(S.pitches.filter((x) => x.status === "SUBMITTED").length), "experts who put themselves forward", "#/referrals?tab=pitches", spark.pitches, "up"],
        ["Needs a check", String(total - freshN), "status has gone stale", "#/network?freshness=stale", spark.stale, "down"],
        ["Amana bench", String(S.people.filter((p) => p.amanaBench).length), "trusted for SOW work", "#/amana", spark.bench, "up"],
      ] as [string, string, string, string, string, string][]).map(([l, v, n, href, sp, good]) => `<ni-stat label="${esc(l)}" value="${esc(v)}" note="${esc(n)}" href="${href}" spark="${sp}" good="${good}"></ni-stat>`).join("")}
    </section>
    <div class="grid-3"><div class="col-2 stack">
      ${setupCard}
      ${card("Most trusted right now", `<div class="scroll"><table class="data"><thead><tr><th>Expert</th><th>Known for</th><th>Who stands behind them</th><th>Availability</th></tr></thead><tbody>${[...S.people].map((p) => ({ p, t: C.trustOf(p) })).sort((a, b) => b.t.score - a.t.score).slice(0, 6).map(({ p, t }) => `<tr><td>${personLink(p, null)}</td><td class="dim wrap">${esc(p.headline ?? "—")}</td><td>${mv.chainOf(p)}</td><td class="nowrap">${availBadge(p)}</td></tr>`).join("")}</tbody></table></div>`, { desc: "Who the network stands behind, and how current we are on them.", flush: true, action: `<a class="btn ghost sm" href="#/network">All experts</a>` })}
      ${card("Suggested next actions", rows(sugg.map((s) => `<a class="action" href="${s.href}"><i></i>${esc(s.text)}</a>`), "Nothing pressing. The network is in good shape."), { desc: "Generated from the state of the network. You decide." })}
      <div class="grid-2">
        ${card("My week", rows(upcoming.map((u) => `${personLink(C.person(u.personId)!, u.meetingType.replace(/_/g, " ").toLowerCase())}<span class="when">${esc(rel(u.startAt))}</span>`), "No conversations booked"), { desc: "Conversations in the next seven days" })}
        ${card("Reconnect queue", rows(reconnect.map((p) => `${personLink(p)}${availBadge(p)}`), "Everyone is current"), { desc: "Trusted people whose status is stale" })}
        ${card("Needs review", rows(review.map((c) => `${personLink(C.person(c.personId)!, null)}<a class="mini" href="#/conversations?tab=review&open=${c.id}">${c.approvalStatus === "DRAFT" ? "Draft" : "Review"}</a>`), "Inbox zero"), { desc: "AI summaries waiting for a human" })}
        ${card("Evidence gaps", rows(gaps.map((p) => `${personLink(p)}${badge("No evidence", "amber")}`), "No gaps"), { desc: "Active or bench people with nothing observed" })}
      </div></div>
      <div class="stack">
        ${card("Amana Expert Network", `<div class="trio"><div><b data-count="${S.people.filter((p) => p.amanaBench).length}">${S.people.filter((p) => p.amanaBench).length}</b><small>bench</small></div><div><b data-count="${S.people.filter((p) => p.usedByAmana).length}">${S.people.filter((p) => p.usedByAmana).length}</b><small>used before</small></div><div><b data-count="${active.filter((o) => o.isAmana).length}">${active.filter((o) => o.isAmana).length}</b><small>open</small></div></div>`, { action: '<a class="mini" href="#/amana">Open</a>' })}
        ${card("Opportunities", rows(active.slice(0, 5).map((o) => `<a class="olink" href="#/opportunities/${o.id}"><b>${esc(o.title)}</b><small>${esc(o.clientName ?? "")} · ${esc(L().ROUTE_LABELS[o.engagementRoute])}</small></a>${badge(L().OPPORTUNITY_STATUS_LABELS[o.status], "navy")}`), "No open opportunities"), { action: '<a class="mini" href="#/opportunities?view=board">Board</a>' })}
        ${card("Introductions", rows(intros.slice(0, 4).map((i) => `<span><b class="t">${esc(C.full(C.person(i.personId)!))}</b><small class="t">${esc(S.opportunities.find((o) => o.id === i.opportunityId)?.title ?? "")}</small></span>${badge(L().INTRO_STATUS_LABELS[i.status], ["INTRODUCED", "ENGAGED", "APPROVED"].includes(i.status) ? "teal" : i.status === "REQUESTED" ? "amber" : "navy")}`), "None yet"))}
        ${card("Relocation signals", rows(S.relocation.filter((r) => !["COMPLETED", "NOT_PROCEEDING"].includes(r.advisoryStatus)).slice(0, 4).map((r) => `${personLink(C.person(r.personId)!, `${r.currentLocation ?? "?"} → ${r.targetLocation ?? "?"}`)}${badge(r.employerSponsored ? "Employer funded" : "Individual", r.employerSponsored ? "teal" : "neutral")}`), "No live relocation interest"), { action: '<a class="mini" href="#/relocation">Pipeline</a>' })}
        ${card("Recent activity", `<ul class="log">${S.audit.slice(0, 6).map((a) => `<li><span>${esc(C.userName(a.actorId).split(" ")[0])} · <code>${esc(a.action)}</code></span><small>${esc(rel(a.createdAt))}</small></li>`).join("")}</ul>`, { action: '<a class="mini" href="#/settings">Audit log</a>' })}
      </div></div>`;
  return { title: "Overview", crumbs: [["Overview"]], html: raw(html) };
}

/**
 * Intelligence: what the machine does, and who you should go and see.
 *
 * Everything on this page is either something the platform worked out by itself, a rule that runs
 * without being asked, or a nudge to sit down with a person — which is the only reason any of the
 * rest of it works.
 */
function intelligence(): View {
  const S = C.S(); const now = Date.now();
  const A = C.automation;
  const on = (k: string) => (S.automations ?? A.DEFAULT_AUTOMATIONS)[k as keyof typeof A.DEFAULT_AUTOMATIONS] ?? false;

  // What the AI has actually done here, counted from the record rather than claimed.
  const screenings = S.conversations.filter((c) => c.type === "SCREENING" || !!c.screening);
  const structured = S.conversations.filter((c) => c.aiSummary || c.approvedSummary).length;
  const parsed = S.briefs.length;
  const matched = S.shortlist.length;
  const attributed = S.people.filter((p) => p.attributes && Object.keys(p.attributes).length).length;
  const did: [string, string, string, string][] = [
    ["Conversations structured", String(structured), `${screenings.length} run by the AI interviewer`, "screening"],
    ["Requirements read", String(parsed), "plain words turned into a structured brief", "brief"],
    ["Experts retrieved", String(matched), "matched to a brief, hard checks done", "person"],
    ["Working styles read", String(attributed), "attributes taken from what people actually said", "trust"],
  ];

  // Who to go and see. City first, because that is the week it is actually possible.
  const me = S.me;
  const myCity = S.people.find((p) => C.full(p) === me.name)?.primaryCity ?? "London";
  const suggestions = A.catchUpSuggestions(
    S.people.filter((p) => p.memberSince || C.relsOf(p.id).length).map((p) => ({
      id: p.id, name: C.full(p), city: p.primaryCity, workedTogether: C.relsOf(p.id).some((r) => r.workedTogether),
      lastContactAt: C.relsOf(p.id).map((r) => r.lastContactDate).filter(Boolean).sort().reverse()[0] ?? null,
      openTo: (p.social?.openTo ?? []) as any[], interests: p.persona?.interests ?? [],
    })), myCity, new Date(), 5);

  const upcoming = S.scheduled.filter((s) => s.status === "SCHEDULED" && new Date(s.startAt).getTime() > now - 3600e3).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 4);
  const openToAnything = S.people.filter((p) => (p.social?.openTo ?? []).length);

  const html = `<div class="page-head"><div><div class="eyebrow">Intelligence</div><h1>What the platform does, and who to go and see</h1><p>The machine reads, matches and remembers. It does not decide, and it never meets anyone for you — that part is still yours.</p></div><div class="actions">${btn("Ask the co-pilot", 'data-act="newRequirement"', "primary")}</div></div>
    <section class="widgets">${did.map(([l, v, n, icon]) => `<ni-stat label="${esc(l)}" value="${esc(v)}" note="${esc(n)}" tone="trust"></ni-stat>`).join("")}</section>
    <div class="grid-3"><div class="col-2 stack">
      ${card("Who to see", suggestions.length ? `<ul class="catchups">${suggestions.map((s) => { const p = C.person(s.personId)!; const kind = A.CATCH_UPS.find((c) => c.key === s.kind)!; return `<li><span class="cu-face">${avatar(p, "md")}</span><div class="cu-main"><b>${esc(s.name)}</b><small>${esc(s.reason)}</small><small class="opener">“${esc(A.catchUpOpener(s, p.persona?.interests ?? []))}”</small></div><div class="cu-actions">${A.CATCH_UPS.slice(0, 3).map((c) => `<button type="button" class="cu-btn ${c.key === s.kind ? "on" : ""}" data-act="bookCatchUp" data-id="${s.personId}" data-kind="${c.key}" title="${esc(c.label)}"><span>${c.emoji}</span>${esc(c.label)}</button>`).join("")}<button type="button" class="cu-btn" data-act="captureAny" data-id="${s.personId}" title="Already seen them? Write it down."><span>✎</span>Capture</button></div></li>`; }).join("")}</ul>` : empty("Nobody is overdue", "Everyone you know has been seen recently. Rare, and worth enjoying."),
        { desc: `In ${esc(myCity)} first, then by how long it has been. A coffee beats a status update.` })}
      ${card("What runs on its own", `<ul class="autos">${A.AUTOMATIONS.map((a) => `<li class="${on(a.key) ? "on" : ""}"><label class="sw"><input type="checkbox" data-act="toggleAuto" data-key="${a.key}" ${on(a.key) ? "checked" : ""}><i></i></label><div><b>${esc(a.label)}</b><small>${esc(a.does)}</small><small class="why">${esc(a.why)}</small></div><span class="cadence">${esc(a.cadence)}</span></li>`).join("")}</ul>`,
        { desc: "Each one is a sentence, and each one can be switched off." })}
    </div><div class="stack">
      ${card("In the diary", upcoming.length ? `<ul class="rows">${upcoming.map((u) => { const p = C.person(u.personId); const kind = A.CATCH_UPS.find((c) => c.key === u.meetingType.toLowerCase()); const past = new Date(u.startAt).getTime() < Date.now(); return `<li><span class="row gap-sm">${kind ? `<span class="cu-emoji">${kind.emoji}</span>` : ""}${p ? personLink(p, u.meetingType.replace(/_/g, " ").toLowerCase()) : esc(u.meetingType)}</span>${past && p ? btn("Capture", `data-act="captureAny" data-id="${p.id}"`, "ghost sm") : `<small class="when">${esc(rel(u.startAt))}</small>`}</li>`; }).join("")}</ul>` : '<span class="dim">Nothing booked. The radar above is the cure.</span>', { desc: "Coffees, brunches and calls, in one list." })}
      ${card("Up for a coffee", openToAnything.length ? `<ul class="rows">${openToAnything.slice(0, 6).map((p) => `<li>${personLink(p, (p.social?.openTo ?? []).map((k) => A.CATCH_UPS.find((c) => c.key === k)?.label ?? k).join(" · "))}<span class="chips">${(p.social?.openTo ?? []).slice(0, 3).map((k) => `<span class="cu-emoji">${A.CATCH_UPS.find((c) => c.key === k)?.emoji ?? "☕"}</span>`).join("")}</span></li>`).join("")}</ul>` : '<span class="dim">Members say what they are up for on their own profile. Nobody has yet.</span>', { desc: "People who said they would like to meet someone from the network." })}
      ${card("What the AI will not do", `<ul class="wont"><li><b>Decide.</b> It ranks and explains; you choose.</li><li><b>Contact anyone as you.</b> Every message is written by a person.</li><li><b>Share a name.</b> Not without that person agreeing to that specific introduction.</li><li><b>Invent evidence.</b> If nobody saw it, it says so.</li></ul>`, { desc: "The boundaries are the product." })}
    </div></div>`;
  return { title: "Intelligence", crumbs: [["Intelligence"]], html: raw(html) };
}

/**
 * One expert, as a card.
 *
 * A table row can tell you a name and a city. It cannot tell you the thing this network actually
 * sells — that somebody here has worked with this person and would do it again — so that line is
 * the card's headline, above the role, and the trust dial sits beside it at a size you can read
 * across a room. Everything else (capabilities, where they are, what they are open to, who the
 * chain of provenance runs through) is arranged underneath in the order a person asks for it.
 */
function expertCard(p: Person): string {
  const t = C.trustOf(p); const scoreV = Math.round(t?.score ?? C.depth(p));
  const band = scoreV >= 70 ? "hi" : scoreV >= 40 ? "mid" : "lo";
  const cred = C.credibility.credibility(credInput(p));
  const lead = cred.find((b: any) => b.key === "worked") ?? cred.find((b: any) => b.key === "used") ?? cred[0];
  const strong = lead?.strength === "strong";
  const where = [p.primaryCity, p.primaryCountry].filter(Boolean).join(", ");
  const live = C.ACTIVE_STATUSES.includes(p.availabilityStatus) && C.fresh(p) === "fresh";
  const caps = p.capabilities.slice(0, 3);
  return `<a class="xc" href="#/people/${p.id}">
    <div class="xc-top">${avatar(p, "md")}
      <div class="xc-id"><b>${esc(C.full(p))}</b><small>${esc(p.headline ?? [p.currentRole, p.currentCompany].filter(Boolean).join(" · ") ?? "")}</small></div>
      <div class="xc-dial"><svg viewBox="0 0 46 46"><circle class="track" cx="23" cy="23" r="19"/><circle class="val ${band}" cx="23" cy="23" r="19" pathLength="100" stroke-dasharray="${Math.max(2, Math.min(100, scoreV))} 100"/></svg><i>${scoreV}</i><em>trust</em></div>
    </div>
    ${lead ? `<div class="xc-cred ${strong ? "" : "cool"}"><ni-icon name="${lead.icon}" size="13"></ni-icon><span>${esc(lead.label)}</span></div>` : ""}
    <div class="chips">${caps.map((c) => `<span class="chip cap">${esc(c)}</span>`).join("")}${p.capabilities.length > caps.length ? `<small>+${p.capabilities.length - caps.length}</small>` : ""}</div>
    <div class="xc-meta">
      <span class="where"><ni-icon name="pin" size="13"></ni-icon><span>${esc(where || "Location not confirmed")}</span></span>
      <span class="nowrap">${live ? '<i class="xc-live"></i> ' : ""}${esc(L().AVAILABILITY_LABELS[p.availabilityStatus])}</span>
    </div>
    <div class="xc-foot">${thread(p, true, false)}<span class="nowrap dim">${esc(p.engagementPreferences.slice(0, 2).map((r: string) => (r === "SOW" ? "SOW" : L().ROUTE_LABELS[r])).join(" · ") || "Routes TBC")}</span></div>
  </a>`;
}

function network(q: URLSearchParams): View {
  const S = C.S(); const text = q.get("q") ?? "";
  const f = { status: q.get("status") ?? "", route: q.get("route") ?? "", location: q.get("location") ?? "", workedWith: q.get("workedWith"), freshness: q.get("freshness"), amanaBench: q.get("amanaBench"), source: q.get("source") };
  let people = [...S.people].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const norm = (s: string) => s.toLowerCase();
  const it = text ? intent(text) : null;
  if (text && it) { const t = norm(text); people = people.filter((p) => { const hay = norm(`${C.full(p)} ${p.headline ?? ""} ${p.currentCompany ?? ""} ${p.capabilities.join(" ")} ${p.sectors.join(" ")} ${p.primaryCity ?? ""} ${p.primaryCountry ?? ""} ${p.targetLocations.join(" ")}`); const hit = hay.includes(t) || it.capabilities.some((c) => hay.includes(c)) || it.sectors.some((c) => hay.includes(c)) || it.locations.some((c) => hay.includes(c)); if (!hit) return false; if (it.routes.length && !p.engagementPreferences.some((r) => it.routes.includes(r))) return false; if (it.availableSoon && !C.ACTIVE_STATUSES.includes(p.availabilityStatus)) return false; if (it.workedWithOnly && !C.relsOf(p.id).some((r) => r.workedTogether)) return false; return true; }); }
  if (f.status) people = people.filter((p) => p.availabilityStatus === f.status);
  if (f.route) people = people.filter((p) => p.engagementPreferences.includes(f.route as any));
  if (f.location) people = people.filter((p) => norm(`${p.primaryCity} ${p.primaryCountry} ${p.targetLocations.join(" ")}`).includes(norm(f.location)));
  if (f.workedWith) people = people.filter((p) => C.relsOf(p.id).some((r) => r.workedTogether));
  if (f.amanaBench) people = people.filter((p) => p.amanaBench);
  if (f.source) people = people.filter((p) => C.relsOf(p.id).some((r) => r.sourceType === f.source));
  if (f.freshness === "stale") people = people.filter((p) => C.fresh(p) === "stale" || C.fresh(p) === "unknown");
  if (f.freshness === "fresh") people = people.filter((p) => C.fresh(p) === "fresh");
  const pill = (label: string, key: string, value: string) => { const active = q.get(key) === value; const np = new URLSearchParams(q); if (active) np.delete(key); else np.set(key, value); return `<a class="pill ${active ? "active" : ""}" href="#/network?${np}">${esc(label)}</a>`; };
  const layout = q.get("layout") === "list" ? "list" : "grid";
  const lay = (v: string) => { const np = new URLSearchParams(q); if (v === "grid") np.delete("layout"); else np.set("layout", v); return `#/network${np.toString() ? `?${np}` : ""}`; };
  const html = `<div class="page-head"><div><h1>Experts</h1><p>Search by relationship, expertise, location and status. Ask in plain language.</p></div><div class="actions"><a class="btn glass" href="#/import">Import</a>${btn("＋ Add person", 'data-act="addPerson"')}</div></div>
    <form class="searchbar" data-search><div class="search"><span>⌕</span><input name="q" value="${esc(text)}" placeholder='e.g. "programme director available soon who we have worked with, open to Dubai"'></div><select name="status">${opt(L().AVAILABILITY_LABELS, f.status, "Any status")}</select><select name="route">${opt(L().ROUTE_LABELS, f.route, "Any route")}</select><input name="location" value="${esc(f.location)}" placeholder="Location" class="w-loc"><button class="btn glass" type="submit">Search</button></form>
    <div class="pills">${pill("Worked with", "workedWith", "1")}${pill("Needs refresh", "freshness", "stale")}${pill("Fresh", "freshness", "fresh")}${pill("Amana bench", "amanaBench", "1")}${pill("Introduced", "source", "INTRODUCTION")}${[...q.keys()].length ? '<a class="clear" href="#/network">Clear</a>' : ""}</div>
    ${it && (it.capabilities.length || it.locations.length || it.routes.length || it.availableSoon || it.workedWithOnly) ? `<div class="understood">Understood as ${[...it.capabilities, ...it.sectors, ...it.locations.map((l) => "📍 " + l), ...it.routes.map((r) => L().ROUTE_LABELS[r]), ...(it.availableSoon ? ["available soon"] : []), ...(it.workedWithOnly ? ["worked with only"] : [])].map(chip).join("")}</div>` : ""}
    <div class="list-bar"><span class="count">${people.length} expert${people.length === 1 ? "" : "s"}</span><span class="view-toggle"><a class="${layout === "grid" ? "on" : ""}" href="${lay("grid")}"><ni-icon name="grid" size="13"></ni-icon> Cards</a><a class="${layout === "list" ? "on" : ""}" href="${lay("list")}"><ni-icon name="rows" size="13"></ni-icon> Table</a></span></div>
    ${!people.length ? empty("Nobody matches that", "Widen the search, or add the person you already have in mind.", btn("＋ Add person", 'data-act="addPerson"', "glass sm"))
      : layout === "grid" ? `<div class="expert-grid">${people.map(expertCard).join("")}</div>`
      : `<div class="card table-card"><div class="scroll"><table class="data"><thead><tr><th>Person</th><th>Provenance</th><th>Expertise</th><th>Location</th><th>Availability · routes</th><th>Stands behind them</th><th class="num">Trust</th><th>Next action</th></tr></thead><tbody>${people.map((p) => `<tr><td>${personLink(p, p.currentRole ? `${p.currentRole}${p.currentCompany ? ` · ${p.currentCompany}` : ""}` : p.headline)}</td><td>${thread(p)}<small class="sub">${esc(C.relsOf(p.id)[0] ? L().SOURCE_LABELS[C.relsOf(p.id)[0].sourceType] : "")}</small></td><td><div class="chips">${p.capabilities.slice(0, 2).map((c) => `<span class="chip cap">${esc(c)}</span>`).join("")}${p.capabilities.length > 2 ? `<small>+${p.capabilities.length - 2}</small>` : ""}</div></td><td class="nowrap"><span>${esc([p.primaryCity, p.primaryCountry].filter(Boolean).join(", ") || "—")}</span>${p.targetLocations.length ? `<small class="sub">→ ${esc(p.targetLocations.join(", "))}</small>` : ""}</td><td class="nowrap">${availBadge(p)}<small class="sub">${esc(p.engagementPreferences.map((r) => (r === "SOW" ? "SOW" : L().ROUTE_LABELS[r])).join(", ") || "Routes not confirmed")}</small></td><td>${mv.chainOf(p)}</td><td class="num">${gauge(C.depth(p), "")}</td><td class="next">${esc(p.nextAction ?? "—")}${p.nextActionDate ? `<small class="sub">${esc(rel(p.nextActionDate))}</small>` : ""}</td></tr>`).join("")}</tbody></table></div></div>`}`;
  return { title: "Experts", crumbs: [["Experts"]], html: raw(html) };
}

/** What we can actually say about this person, strongest first. Names are fine in here. */
function credInput(p: Person) {
  const S = C.S();
  const rels = C.relsOf(p.id).map((r) => ({
    ownerName: C.userName(r.networkOwnerId),
    ownerKind: (r.networkOwnerId === S.me.id ? "me" : S.users.some((u) => u.id === r.networkOwnerId) ? "colleague" : "external") as "me" | "colleague" | "external",
    sourceLabel: L().SOURCE_LABELS[r.sourceType] ?? null,
    introducedByName: r.introducedById && C.person(r.introducedById) ? C.full(C.person(r.introducedById)!) : null,
    workedTogether: r.workedTogether, workedTogetherContext: r.workedTogetherContext, yearsKnown: r.yearsKnown, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain,
  }));
  const vs = C.vouchesOf(p.id);
  const metRel = C.relsOf(p.id).find((r) => r.metInPerson);
  const metVouch = vs.find((v) => v.metInPerson);
  const met = metRel || metVouch ? { by: C.userName(metRel?.networkOwnerId ?? metVouch!.voucherId), when: fmtDate(metRel?.metAt ?? metVouch?.createdAt) } : null;
  return {
    relationships: rels,
    metInPerson: met,
    personallyReferredBy: vs.filter((v) => v.voucherKind === "USER" && v.wouldRecommend).map((v) => C.userName(v.voucherId)), usedByUs: p.usedByAmana, engagements: S.team.filter((t) => t.personId === p.id).length || undefined, onBench: p.amanaBench,
    vouchCount: vs.length, wouldRecommendCount: vs.filter((v) => v.wouldRecommend).length,
    screened: p.screeningStatus === "APPROVED" || !!p.screenedAt, evidenceCount: C.evOf(p.id).length,
    conversationCount: C.convOf(p.id).filter((c) => c.approvalStatus === "APPROVED").length,
  };
}

/** The credibility strip: the badges people actually trust, with an icon each. */
function credStrip(p: Person, opts: { compact?: boolean } = {}): string {
  const badges = C.credibility.credibility(credInput(p));
  return `<div class="cred ${opts.compact ? "compact" : ""}">${badges.map((b) => `<span class="cred-b s-${b.strength}" title="${esc(b.note)}"><ni-icon name="${b.icon}" size="13" tone="${b.strength === "strong" ? "trust" : "mute"}"></ni-icon><b>${esc(b.label)}</b>${opts.compact ? "" : `<small>${esc(b.note)}</small>`}</span>`).join("")}</div>`;
}

/** Who they are away from the work. Internal only, and only if they agreed to us keeping it. */
function personaCard(p: Person, self = false): string {
  const priv = C.privacy.privacyOf(p);
  const persona = p.persona ?? null;
  const tags = p.personTags ?? [];
  if (!C.screening.personaSaid?.(persona) && !tags.length) {
    return card(self ? "You, not the CV" : "The person, not the CV", `<p class="dim">${self ? "The conversation asks a few human questions at the end — what you are into, what gets you out of bed. Nothing here ever reaches a client." : "Nothing captured yet. The screening asks, or add what you learned when you met them."}</p>`, { desc: "Internal only. A client never sees this.", action: self ? undefined : btn("I have met them", `data-act="metThem" data-id="${p.id}"`, "glass sm") });
  }
  if (!priv.consents.personalNotes && !self) return card("The person, not the CV", '<p class="dim">They asked us not to keep personal notes. Respected — nothing is stored.</p>', { desc: "Consent withdrawn" });
  const rows: string[] = [];
  if (persona?.outsideWork) rows.push(`<div class="pr"><small class="lbl">Away from work</small><p>${esc(persona.outsideWork)}</p></div>`);
  if (persona?.motivation) rows.push(`<div class="pr"><small class="lbl">What gets them going</small><ni-quote size="sm">${esc(persona.motivation)}</ni-quote></div>`);
  if (persona?.howToWorkWith) rows.push(`<div class="pr"><small class="lbl">How to work with them</small><p>${esc(persona.howToWorkWith)}</p></div>`);
  if (persona?.surprising) rows.push(`<div class="pr"><small class="lbl">Surprising</small><p>${esc(persona.surprising)}</p></div>`);
  const chips = [...(persona?.interests ?? []), ...tags].map(chip).join("");
  const langs = (persona?.languages ?? []).map((x) => chip(x)).join("");
  return card(self ? "You, not the CV" : "The person, not the CV", `${rows.join("")}${chips ? `<div class="pr"><small class="lbl">Into</small><div class="chips">${chips}</div></div>` : ""}${langs ? `<div class="pr"><small class="lbl">Works in</small><div class="chips">${langs}</div></div>` : ""}`,
    { desc: self ? "Only the network sees this. Switch it off in your privacy settings whenever you like." : "Internal only. A client never sees this.", action: self ? undefined : btn("I have met them", `data-act="metThem" data-id="${p.id}"`, "glass sm") });
}

function personView(id: string, q: URLSearchParams): View {
  const S = C.S(); const p = C.person(id);
  if (!p) return { title: "Not found", crumbs: [["Experts", "#/network"], ["Not found"]], html: raw(empty("Person not found")) };
  const tab = q.get("tab") ?? "overview";
  const rels = C.relsOf(id), evs = C.evOf(id), convs = C.convOf(id);
  const approved = convs.filter((c) => c.approvalStatus === "APPROVED"); const latest = approved[0]?.approvedSummary ?? null;
  const matches = S.matches.filter((m) => m.personId === id); const reloc = S.relocation.find((r) => r.personId === id);
  const tabs: [string, string, number?][] = [["overview", "Overview"], ["relationships", "Relationships", rels.length], ["evidence", "Evidence", evs.length], ["conversations", "Conversations", convs.length], ["opportunities", "Opportunities", matches.length], ["relocation", "Relocation"], ["activity", "Activity"]];
  const listOr = (arr: string[]) => (arr.length ? `<ul>${arr.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : '<span class="dim">—</span>');
  let body = "";
  if (tab === "overview") body = `<div class="grid-3"><div class="col-2 stack">
      ${card("What we know", latest ? `<div class="kv-grid"><div><small>Summary</small><p>${esc(latest.summary)}</p></div><div><small>Current status</small><p>${esc(latest.currentStatus || "—")}</p><small>Rates / salary</small><p>${esc(latest.ratesOrSalary || "—")}</p></div><div><small>Strengths</small>${listOr(latest.strengths)}</div><div><small>Does not want</small>${listOr(latest.avoid)}</div><div><small>Working characteristics</small>${listOr(latest.workingCharacteristics)}</div><div><small>Constraints</small>${listOr(latest.constraints)}</div>${latest.unresolvedQuestions.length ? `<div class="span2 note-amber"><small>Still to find out</small>${listOr(latest.unresolvedQuestions)}</div>` : ""}</div>` : empty("Not yet in conversation", "Book a conversation, capture notes, and approve the structured summary.", btn("Capture conversation", `data-act="capture" data-id="${id}"`, "glass")), { desc: latest ? `From the approved conversation on ${fmtDate(approved[0].date)}` : "No approved conversation yet" })}
      <div class="grid-2">${card("Expertise", `<div class="chips">${p.capabilities.map(chip).join("") || '<span class="dim">None recorded</span>'}</div><small class="lbl">Sectors</small><div class="chips">${p.sectors.map(chip).join("") || '<span class="dim">—</span>'}</div><dl class="kv"><dt>Seniority</dt><dd>${esc(p.seniority ? L().SENIORITY_LABELS[p.seniority] : "—")}</dd><dt>Rate</dt><dd>${esc(p.rateExpectation ?? "—")}</dd><dt>Salary</dt><dd>${esc(p.salaryExpectation ?? "—")}</dd><dt>Target locations</dt><dd>${esc(p.targetLocations.join(", ") || "—")}</dd><dt>Work rights</dt><dd>${esc((p.workRights ?? []).join(", ") || "not recorded")}</dd></dl>`)}
      ${card("Availability", `<dl class="kv"><dt>Status</dt><dd>${availBadge(p)}</dd><dt>Screening</dt><dd>${mv.screenLabel(p)} ${p.screeningStatus === "SUBMITTED" ? '<a href="#/conversations?tab=review">review</a>' : p.screeningStatus !== "APPROVED" && !p.screenedAt ? `<a href="#/screening/${id}?restart=1">run</a>` : ""}</dd><dt>Last confirmed</dt><dd>${esc(rel(p.availabilityConfirmedAt))}</dd><dt>Source</dt><dd>${esc(p.availabilitySource ?? "—")}</dd><dt>Confidence</dt><dd>${p.availabilityConfidence}%</dd><dt>Next check</dt><dd>${esc(rel(p.nextCheckDate))}</dd></dl>${p.nextAction ? `<div class="next-box"><small>Next action</small>${esc(p.nextAction)} <span class="dim">${esc(rel(p.nextActionDate))}</span></div>` : ""}`, { action: btn("Update", `data-act="availability" data-id="${id}"`, "glass sm") })}</div>${mv.fitCard(p)}</div>
      <div class="stack">${mv.trustCard(p, { canVouch: true })}${card("Credibility", credStrip(p), { desc: "Why anyone should believe us about them." })}${personaCard(p)}${dv.referredCard(p)}${mv.vouchList(p)}${card("Knowledge depth", `<div class="depth">${gauge(C.depth(p), "of 100")}<div><p>How well the network knows ${esc(p.firstName)}: provenance, observed evidence, approved conversations and a fresh status. Never a judgement of the person.</p><ul class="ticks"><li class="${rels.some((r) => r.workedTogether) ? "on" : ""}">Worked with directly</li><li class="${evs.length ? "on" : ""}">${evs.length} piece${evs.length === 1 ? "" : "s"} of evidence</li><li class="${approved.length ? "on" : ""}">${approved.length} approved conversation${approved.length === 1 ? "" : "s"}</li><li class="${C.fresh(p) === "fresh" ? "on" : ""}">Status is fresh</li></ul></div></div>`)}
      ${card("Provenance", rels.length ? `<ul class="prov">${rels.map((r) => `<li><b>${esc(C.userName(r.networkOwnerId))} · ${esc(L().RELATIONSHIP_LABELS[r.relationshipType])}</b><small>${esc(L().SOURCE_LABELS[r.sourceType])}${r.introducedById && C.person(r.introducedById) ? ` · via <a href="#/people/${r.introducedById}">${esc(C.full(C.person(r.introducedById)!))}</a>` : ""}${r.yearsKnown ? ` · ${r.yearsKnown}y` : ""}</small>${r.wouldWorkTogetherAgain === true ? '<em class="ok">Would work together again</em>' : r.wouldWorkTogetherAgain === false ? '<em class="bad">Would not work together again</em>' : ""}</li>`).join("")}</ul>` : '<span class="dim">Missing.</span>', { desc: "Who knows them and how" })}
      ${card("Upcoming", S.scheduled.filter((s) => s.personId === id && s.status === "SCHEDULED").map((s) => `<div class="row"><span>${esc(s.meetingType.replace(/_/g, " ").toLowerCase())} · ${s.provider === "MANUAL" ? "manual" : s.provider === "CALENDLY" ? "Calendly" : "Outlook"}</span><small>${esc(rel(s.startAt))}</small></div>`).join("") || '<span class="dim">Nothing booked.</span>')}
      ${card("Contact", `<dl class="kv"><dt>Email</dt><dd>${esc(p.email ?? "—")}</dd><dt>Phone</dt><dd>${esc(p.phone ?? "—")}</dd><dt>LinkedIn</dt><dd>${p.linkedinUrl ? `<a href="${esc(p.linkedinUrl)}" target="_blank" rel="noreferrer">profile</a>` : "—"}</dd></dl>`)}</div></div>`;
  else if (tab === "relationships") body = card("Relationships", `<div class="scroll"><table class="data"><thead><tr><th>Known by</th><th>Type</th><th>Source</th><th>Worked together</th><th class="num">Years</th><th>Again?</th><th>Last contact</th><th>Private notes</th></tr></thead><tbody>${rels.map((r) => `<tr><td><b>${esc(C.userName(r.networkOwnerId))}</b></td><td>${esc(L().RELATIONSHIP_LABELS[r.relationshipType])}</td><td>${esc(L().SOURCE_LABELS[r.sourceType])}${r.introducedById && C.person(r.introducedById) ? `<small class="sub">via ${esc(C.full(C.person(r.introducedById)!))}</small>` : ""}</td><td>${r.workedTogether ? badge("yes", "teal") + (r.workedTogetherContext ? `<small class="sub">${esc(r.workedTogetherContext)}</small>` : "") : '<span class="dim">no</span>'}</td><td class="num">${r.yearsKnown ?? "—"}</td><td>${r.wouldWorkTogetherAgain === true ? '<em class="ok">Yes</em>' : r.wouldWorkTogetherAgain === false ? '<em class="bad">No</em>' : "—"}</td><td>${esc(rel(r.lastContactDate))}</td><td class="dim wrap">${esc(r.relationshipNotes ?? "—")}</td></tr>`).join("")}</tbody></table></div>`, { desc: "Provenance and private notes. Notes never leave this tenant.", action: btn("＋ Add relationship", `data-act="addRelationship" data-id="${id}"`, "glass sm"), flush: true });
  else if (tab === "evidence") body = `<div class="sect-head"><div><h2>Observed evidence</h2><p>What trusted people have directly seen them deliver.</p></div>${btn("＋ Add evidence", `data-act="addEvidence" data-id="${id}"`, "glass sm")}</div>${evs.length ? `<div class="stack">${evs.map((e) => `<section class="card ${e.evidenceType === "CAUTION" ? "caution" : ""}"><div class="body"><div class="row"><span>${badge(L().EVIDENCE_LABELS[e.evidenceType], e.evidenceType === "CAUTION" ? "amber" : "teal")} <span class="dim">${esc(e.context)}</span></span><small class="dim">${esc(C.userName(e.observerId))} · ${esc(fmtDate(e.dateObserved))} · ${e.confidence}%</small></div><p>${esc(e.description)}</p></div></section>`).join("")}</div>` : empty("No evidence yet", "This is an evidence gap. Record what you or someone you trust has seen.")}`;
  else if (tab === "conversations") body = `<div class="sect-head"><div><h2>Conversations</h2><p>The profile is the ongoing record of the relationship.</p></div>${btn("Capture conversation", `data-act="capture" data-id="${id}"`, "glass sm")}</div>${convs.length ? `<div class="stack">${convs.map((c) => { const s = c.approvedSummary ?? c.aiSummary; return `<section class="card"><div class="body"><div class="row"><b>${esc(fmtDate(c.date))} · ${esc(c.type.replace(/_/g, " ").toLowerCase())} · ${esc(C.userName(c.conductedById))}</b><span>${badge(c.approvalStatus.replace(/_/g, " ").toLowerCase(), c.approvalStatus === "APPROVED" ? "teal" : c.approvalStatus === "NEEDS_REVIEW" ? "amber" : "neutral")}${c.approvalStatus !== "APPROVED" && c.approvalStatus !== "REJECTED" ? ` <a class="mini" href="#/conversations?tab=review&open=${c.id}">Review</a>` : ""}</span></div>${s?.summary ? `<p>${esc(s.summary)}</p>` : ""}${c.rawNotes ? `<details><summary>Raw notes</summary><p class="dim pre">${esc(c.rawNotes)}</p></details>` : ""}${c.followUpDate ? `<small class="dim">Follow up ${esc(rel(c.followUpDate))}</small>` : ""}</div></section>`; }).join("")}</div>` : empty("No conversations recorded")}`;
  else if (tab === "opportunities") body = card("Opportunities", matches.length ? `<div class="scroll"><table class="data"><thead><tr><th>Opportunity</th><th>Route</th><th>Stage</th><th class="num">Fit</th><th>Human decision</th><th>Notes</th></tr></thead><tbody>${matches.map((m) => { const o = S.opportunities.find((x) => x.id === m.opportunityId)!; return `<tr><td><a href="#/opportunities/${o.id}"><b>${esc(o.title)}</b></a><small class="sub">${esc(o.clientName ?? "")}</small></td><td>${badge(L().ROUTE_LABELS[o.engagementRoute], "navy")}</td><td>${badge(L().OPPORTUNITY_STATUS_LABELS[o.status], "navy")}</td><td class="num">${m.fitScore}</td><td>${badge(L().DECISION_LABELS[m.humanDecision], L().DECISION_TONE[m.humanDecision])}</td><td class="dim wrap">${esc(m.humanNotes ?? "—")}</td></tr>`; }).join("")}</tbody></table></div>` : empty("Not yet considered for an opportunity"), { desc: "Scores are per-opportunity, never a global rank.", flush: true });
  else if (tab === "relocation") body = card("Relocation", reloc ? `<dl class="kv four"><div><dt>From</dt><dd>${esc(reloc.currentLocation ?? "—")}</dd></div><div><dt>To</dt><dd>${esc(reloc.targetLocation ?? "—")}</dd></div><div><dt>Window</dt><dd>${esc(reloc.targetMoveWindow ?? "—")}</dd></div><div><dt>Advisory</dt><dd>${badge(L().ADVISORY_LABELS[reloc.advisoryStatus], reloc.advisoryStatus === "ACTIVE" ? "teal" : "navy")}</dd></div></dl><div class="chips">${[reloc.familyMove && "family move", reloc.schoolGuidanceInterest && "schools", reloc.housingGuidanceInterest && "housing", reloc.relocationAdvisoryInterest && "wants advisory", reloc.employerSponsored ? "employer funded" : "individually funded"].filter(Boolean).map((c) => chip(c as string)).join("")}</div>${reloc.notes ? `<p>${esc(reloc.notes)}</p>` : ""}` : empty("No relocation profile", "Capture interest if it comes up in conversation."), { desc: "Advisory is a separate, optional paid service.", action: btn(reloc ? "Edit" : "Capture interest", `data-act="relocation" data-id="${id}"`, "glass sm") });
  else body = card("Activity", `<ul class="log">${S.audit.filter((a) => a.entityId === id || (a.detail ?? "").includes(C.full(p))).map((a) => `<li><span>${esc(C.userName(a.actorId))} · <code>${esc(a.action)}</code> ${a.detail ? `<span class="dim">${esc(a.detail)}</span>` : ""}</span><small>${esc(rel(a.createdAt))}</small></li>`).join("") || '<li class="dim">No activity recorded.</li>'}</ul>`, { desc: "Audit trail of sensitive actions on this record." });
  const html = `<div class="person-hero"><div class="who">${avatar(p, "xl", true)}<div><h1>${esc(C.full(p))}</h1><p>${esc(p.headline ?? "—")}</p><small>${esc([p.currentRole, p.currentCompany].filter(Boolean).join(" · "))}${p.primaryCity ? ` · ${esc([p.primaryCity, p.primaryCountry].filter(Boolean).join(", "))}` : ""}</small><div class="meta">${thread(p, false)}</div>${credStrip(p, { compact: true })}<div class="meta">${availBadge(p)}${p.engagementPreferences.map((r) => badge(L().ROUTE_LABELS[r], "navy")).join("")}${p.amanaBench ? badge("Amana bench", "teal", true) : ""}${p.relocationInterest ? badge("Relocation", "neutral", true) : ""}${p.memberSince ? badge("network member", "teal", true) : ""}</div></div></div><div class="actions">${btn("Refer to a client or agency", `data-act="referToAccount" data-id="${id}"`, "primary")}${btn("I have met them", `data-act="metThem" data-id="${id}"`, "glass")}${btn("Screening call", `data-act="startScreening" data-id="${id}"`, "glass")}${btn("Book conversation", `data-act="book" data-id="${id}"`, "glass")}${btn("Capture conversation", `data-act="capture" data-id="${id}"`, "glass")}${btn("Edit profile", `data-act="editPerson" data-id="${id}"`, "glass")}</div></div>
    <nav class="tabs">${tabs.map(([k, l, n]) => `<a href="#/people/${id}${k === "overview" ? "" : `?tab=${k}`}" class="${tab === k ? "active" : ""}">${esc(l)}${typeof n === "number" ? `<i>${n}</i>` : ""}</a>`).join("")}</nav>${body}`;
  return { title: C.full(p), crumbs: [["Experts", "#/network"], [C.full(p)]], html: raw(html) };
}

function conversations(q: URLSearchParams): View {
  const S = C.S(); const tab = q.get("tab") ?? "upcoming"; const now = Date.now();
  const upcoming = S.scheduled.filter((s) => s.status === "SCHEDULED" && new Date(s.startAt).getTime() > now - 3600e3).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const followups = S.conversations.filter((c) => c.followUpDate && new Date(c.followUpDate).getTime() < now + 14 * 86400e3).sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));
  const review = S.conversations.filter((c) => c.approvalStatus === "NEEDS_REVIEW" || c.approvalStatus === "DRAFT").sort((a, b) => b.date.localeCompare(a.date));
  const completed = S.conversations.filter((c) => c.approvalStatus === "APPROVED").sort((a, b) => b.date.localeCompare(a.date));
  const opened = review.find((c) => c.id === q.get("open")) ?? review[0] ?? null; const d = opened?.aiSummary ?? null;
  const tabs: [string, string, number][] = [["upcoming", "Upcoming", upcoming.length], ["followups", "Follow-ups", followups.length], ["review", "Needs review", review.length], ["completed", "Completed", completed.length]];
  let body = "";
  if (tab === "upcoming") body = upcoming.length ? `<div class="card table-card"><div class="scroll"><table class="data"><thead><tr><th>When</th><th>Person</th><th>Type</th><th>Provider</th><th></th></tr></thead><tbody>${upcoming.map((u) => `<tr><td><b>${esc(rel(u.startAt))}</b><small class="sub">${esc(new Date(u.startAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</small></td><td>${personLink(C.person(u.personId)!)}</td><td>${esc(u.meetingType.replace(/_/g, " ").toLowerCase())}</td><td>${u.provider === "MANUAL" ? "Manual" : u.provider === "CALENDLY" ? "Calendly" : "Outlook / Teams"}</td><td class="right nowrap">${btn("Capture", `data-act="capture" data-id="${u.personId}" data-sched="${u.id}"`, "glass sm")} ${btn("Cancel", `data-act="cancelSched" data-id="${u.id}"`, "ghost sm")}</td></tr>`).join("")}</tbody></table></div></div>` : empty("Nothing booked", "Book a conversation from a person's profile.");
  else if (tab === "followups") body = followups.length ? `<div class="card table-card"><div class="scroll"><table class="data"><thead><tr><th>Due</th><th>Person</th><th>From conversation</th><th></th></tr></thead><tbody>${followups.map((c) => `<tr><td class="${new Date(c.followUpDate!).getTime() < now ? "amber" : ""}"><b>${esc(rel(c.followUpDate))}</b></td><td>${personLink(C.person(c.personId)!)}</td><td class="dim">${esc(fmtDate(c.date))} · ${esc(c.type.replace(/_/g, " ").toLowerCase())}</td><td class="right">${btn("Log follow-up", `data-act="capture" data-id="${c.personId}"`, "glass sm")}</td></tr>`).join("")}</tbody></table></div></div>` : empty("No follow-ups due");
  else if (tab === "review") body = review.length ? `<div class="review"><div class="card list"><ul>${review.map((c) => `<li><a href="#/conversations?tab=review&open=${c.id}" class="${opened?.id === c.id ? "active" : ""}"><b>${esc(C.full(C.person(c.personId)!))}</b><small>${esc(fmtDate(c.date))} · ${esc(C.userName(c.conductedById).split(" ")[0])} ${badge(c.approvalStatus === "DRAFT" ? "draft" : "AI draft", c.approvalStatus === "DRAFT" ? "neutral" : "amber")}</small></a></li>`).join("")}</ul></div>${opened ? `<section class="card"><header><div><h3>Review: ${esc(C.full(C.person(opened.personId)!))}</h3><p>${esc(opened.type.replace(/_/g, " ").toLowerCase())} on ${esc(fmtDate(opened.date))}. Edit anything that is wrong. Approving makes it authoritative.</p></div><a class="mini" href="#/people/${opened.personId}">Open profile</a></header><div class="body"><div class="review-grid"><div><small class="lbl">Source material</small><div class="source">${esc(opened.rawNotes || "(no notes)")}${opened.transcript ? `\n\n--- transcript ---\n${esc(opened.transcript)}` : ""}</div>${!d ? btn("✦ Structure with AI", `data-act="structure" data-id="${opened.id}"`, "glass") : ""}</div>
    <form data-action="approve" data-id="${opened.id}" class="stack">${field("Headline", input("headline", "", d?.headline ?? ""))}${field("Summary", textarea("summary", 'rows="3"', d?.summary ?? ""))}<div class="grid-2">${field("Capabilities", textarea("capabilities", 'rows="2"', d?.capabilities.join(", ") ?? ""), "comma separated")}${field("Sectors", textarea("sectors", 'rows="2"', d?.sectors.join(", ") ?? ""), "comma separated")}</div><div class="field"><span>Engagement preferences</span><div class="checks">${Object.entries(L().ROUTE_LABELS).map(([k, v]) => check("engagementPreferences", v as string, d?.engagementPreferences.includes(k as any), k)).join("")}</div></div><div class="grid-2">${field("Location preferences", input("locationPreferences", "", d?.locationPreferences.join(", ") ?? ""))}${field("Rates / salary", input("ratesOrSalary", "", d?.ratesOrSalary ?? ""))}${field("Current status", input("currentStatus", "", d?.currentStatus ?? ""))}${field("Availability status", select("suggestedAvailabilityStatus", opt(L().AVAILABILITY_LABELS, d?.suggestedAvailabilityStatus ?? "", "Leave unchanged")))}</div><div class="grid-2">${field("Strengths", textarea("strengths", 'rows="3"', d?.strengths.join("\n") ?? ""), "one per line")}${field("Does not want", textarea("avoid", 'rows="3"', d?.avoid.join("\n") ?? ""), "one per line")}${field("Working characteristics", textarea("workingCharacteristics", 'rows="3"', d?.workingCharacteristics.join("\n") ?? ""), "one per line")}${field("Constraints", textarea("constraints", 'rows="3"', d?.constraints.join("\n") ?? ""), "one per line")}</div>${field("Unresolved questions", textarea("unresolvedQuestions", 'rows="2"', d?.unresolvedQuestions.join("\n") ?? ""), "one per line")}<div class="grid-2">${field("Follow-up (as said)", input("followUpDate", "", d?.followUpDate ?? ""))}${field("Follow-up date", input("followUpISO", 'type="date"'))}</div>${check("applyToProfile", "Apply approved fields to the profile (capabilities, preferences, availability)", true)}<div class="row"><button class="btn teal" type="submit">Approve summary</button>${btn("Discard draft", `data-act="reject" data-id="${opened.id}"`, "ghost")}</div></form></div></div></section>` : ""}</div>` : empty("Nothing to review", "Captured conversations appear here with a structured draft for approval.");
  else body = completed.length ? `<div class="card table-card"><div class="scroll"><table class="data"><thead><tr><th>Date</th><th>Person</th><th>Type</th><th>Summary</th><th>By</th><th>Follow-up</th></tr></thead><tbody>${completed.map((c) => `<tr><td class="nowrap">${esc(fmtDate(c.date))}</td><td>${personLink(C.person(c.personId)!, null)}</td><td>${esc(c.type.replace(/_/g, " ").toLowerCase())}</td><td class="dim wrap">${esc(c.approvedSummary?.summary ?? "—")}</td><td>${esc(C.userName(c.conductedById).split(" ")[0])}</td><td>${esc(rel(c.followUpDate))}</td></tr>`).join("")}</tbody></table></div></div>` : empty("No approved conversations yet");
  return { title: "Conversations", crumbs: [["Conversations"]], html: raw(`<div class="page-head"><div><h1>Conversations</h1><p>Natural conversations, structured by AI, approved by you. Nothing becomes authoritative until reviewed.</p></div><div class="actions">${btn("Capture conversation", 'data-act="captureAny"', "glass")}</div></div><nav class="tabs">${tabs.map(([k, l, n]) => `<a href="#/conversations?tab=${k}" class="${tab === k ? "active" : ""}">${esc(l)}<i>${n}</i></a>`).join("")}</nav>${body}`) };
}

function opportunities(q: URLSearchParams): View {
  const S = C.S(); const view = q.get("view") === "board" ? "board" : "list"; const routeF = q.get("route") ?? "";
  const opps = S.opportunities.filter((o) => !routeF || o.engagementRoute === routeF).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const mc = (o: Opportunity) => S.matches.filter((m) => m.opportunityId === o.id);
  const html = `<div class="page-head"><div><h1>Opportunities</h1><p>Start from the client's problem, not a vacancy. The route is decided after we know who we have.</p></div><div class="actions"><div class="seg"><a href="#/opportunities?view=list${routeF ? `&route=${routeF}` : ""}" class="${view === "list" ? "active" : ""}">List</a><a href="#/opportunities?view=board${routeF ? `&route=${routeF}` : ""}" class="${view === "board" ? "active" : ""}">Board</a></div>${btn("＋ New opportunity", 'data-act="newOpp"')}</div></div>
    <div class="pills">${Object.entries(L().ROUTE_LABELS).map(([k, v]) => `<a class="pill ${routeF === k ? "active" : ""}" href="#/opportunities?view=${view}${routeF === k ? "" : `&route=${k}`}">${esc(v as string)}</a>`).join("")}</div>
    ${opps.length === 0 ? empty("No opportunities", "Create one from a business problem.") : view === "list" ? `<div class="card table-card"><div class="scroll"><table class="data"><thead><tr><th>Opportunity</th><th>Route</th><th>Source</th><th>Client</th><th class="num">Value</th><th>Location</th><th>Stage</th><th class="num">Matches</th><th>Updated</th></tr></thead><tbody>${opps.map((o) => `<tr><td><a href="#/opportunities/${o.id}"><b>${esc(o.title)}</b></a>${o.isAmana ? " " + badge("Amana", "teal", true) : ""}</td><td>${badge(L().ROUTE_LABELS[o.engagementRoute], "navy")}</td><td>${esc(o.sourceType.replace(/_/g, " ").toLowerCase())}</td><td class="dim">${esc(o.clientName ?? "—")}</td><td class="num nowrap">${o.budget ? `${money(o.budget, o.currency)}${o.engagementRoute === "PERMANENT" ? "" : "/day"}` : "—"}</td><td class="dim">${esc(o.location ?? "—")}</td><td>${badge(L().OPPORTUNITY_STATUS_LABELS[o.status], ["CLOSED_WON", "ENGAGED"].includes(o.status) ? "teal" : o.status === "ON_HOLD" ? "amber" : "navy")}</td><td class="num nowrap">${mc(o).length} <span class="dim">· ${mc(o).filter((m) => m.humanDecision === "RECOMMEND").length} rec</span></td><td class="dim nowrap">${esc(rel(o.updatedAt))}</td></tr>`).join("")}</tbody></table></div></div>` : `<div class="board">${L().KANBAN_STAGES.map((stage: string) => { const cards = opps.filter((o) => o.status === stage); return `<div class="lane"><div class="lane-head"><span>${esc(L().OPPORTUNITY_STATUS_LABELS[stage])}</span><small>${cards.length}</small></div>${cards.map((o) => `<a class="kcard" href="#/opportunities/${o.id}"><b>${esc(o.title)}</b><small>${esc(o.clientName ?? "—")}</small><div class="row">${badge(L().ROUTE_LABELS[o.engagementRoute], "navy")}<small>${mc(o).length} matches</small></div></a>`).join("")}</div>`; }).join("")}</div>`}`;
  return { title: "Opportunities", crumbs: [["Opportunities"]], html: raw(html) };
}

function opportunity(id: string): View {
  const S = C.S(); const o = S.opportunities.find((x) => x.id === id);
  if (!o) return { title: "Not found", crumbs: [["Opportunities", "#/opportunities"], ["Not found"]], html: raw(empty("Opportunity not found")) };
  const matches = S.matches.filter((m) => m.opportunityId === id).sort((a, b) => b.fitScore - a.fitScore);
  const intros = S.introductions.filter((i) => i.opportunityId === id); const team = S.team.filter((t) => t.opportunityId === id);
  const html = `<div class="page-head"><div><h1>${esc(o.title)}</h1><p class="meta">${badge(L().ROUTE_LABELS[o.engagementRoute], "navy")}${badge(L().OPPORTUNITY_STATUS_LABELS[o.status], "navy")}${o.isAmana ? badge("Amana Expert Network", "teal", true) : ""}<span class="dim">· ${esc(o.clientName ?? o.sourceType.toLowerCase())}</span></p></div><form class="actions" data-action="stage" data-id="${id}"><select name="status">${opt(L().OPPORTUNITY_STATUS_LABELS, o.status)}</select><button class="btn glass" type="submit">Set stage</button></form></div>
    <div class="grid-3"><div class="col-2 stack">${card("The problem", `<p class="lead">${esc(o.problemStatement)}</p>${o.desiredOutcomes ? `<small class="lbl">Desired outcomes</small><p>${esc(o.desiredOutcomes)}</p>` : ""}<dl class="kv four"><div><dt>Route</dt><dd>${esc(L().ROUTE_LABELS[o.engagementRoute])}</dd></div><div><dt>Location</dt><dd>${esc(o.location ?? "—")}</dd></div><div><dt>Start · duration</dt><dd>${esc(fmtDate(o.startDate))}${o.duration ? ` · ${esc(o.duration)}` : ""}</dd></div><div><dt>Budget</dt><dd>${o.budget ? `${money(o.budget, o.currency)}${o.engagementRoute === "PERMANENT" ? "" : "/day"}` : "—"}</dd></div></dl><small class="lbl">Required</small><div class="chips">${o.requiredCapabilities.map(chip).join("")}</div>${o.preferredCapabilities.length ? `<small class="lbl">Preferred</small><div class="chips">${o.preferredCapabilities.map(chip).join("")}</div>` : ""}`)}
      <div class="sect-head"><div><h2>Matching panel</h2><p>AI retrieves and explains possible fits for this requirement only. It does not rank people globally or reject anyone. You decide.</p></div>${btn(matches.length ? "↻ Refresh suggestions" : "✦ Find possible matches", `data-act="generate" data-id="${id}"`, matches.length ? "glass" : "primary")}</div>
      ${matches.length ? matches.map((m) => { const p = C.person(m.personId)!; const intro = intros.find((i) => i.personId === m.personId); const cautions = C.evOf(p.id).filter((e) => e.evidenceType === "CAUTION").length; return `<section class="card match ${m.humanDecision === "RECOMMEND" ? "rec" : m.humanDecision === "NOT_FOR_THIS_REQUIREMENT" ? "dimmed" : ""}"><div class="body"><div class="row">${personLink(p)}<span class="meta">${availBadge(p)}${badge(L().DECISION_LABELS[m.humanDecision], L().DECISION_TONE[m.humanDecision])}</span></div><div class="dims"><div><small>Fit for this</small>${score(m.fitScore)}</div><div><small>Evidence</small>${score(m.evidenceStrength)}</div><div><small>Relationship</small>${score(m.relationshipStrength)}</div><div><small>Availability</small>${score(m.availabilityFit)}</div><div><small>Commercial</small>${score(m.commercialFit)}</div></div><p>${esc(m.fitExplanation)}</p><div class="chips">${C.relsOf(p.id).some((r) => r.workedTogether) ? badge("worked with", "teal", true) : badge("not worked with directly", "neutral", true)}${badge(`${C.evOf(p.id).length} evidence`, C.evOf(p.id).length ? "teal" : "amber", true)}${cautions ? badge(`${cautions} caution`, "amber", true) : ""}</div>${m.uncertainty.length ? `<div class="note-amber"><small>Uncertainty</small><ul>${m.uncertainty.map((u) => `<li>${esc(u)}</li>`).join("")}</ul></div>` : ""}<form class="decide" data-action="decide" data-id="${m.id}">${field("Human decision", select("decision", opt(L().DECISION_LABELS, m.humanDecision)))}${field("Why", input("humanNotes", 'placeholder="Your judgement, in a sentence."', m.humanNotes ?? ""))}<button class="btn glass" type="submit">Save</button></form><div class="row">${intro ? `<span class="meta">${badge(L().INTRO_STATUS_LABELS[intro.status], ["INTRODUCED", "ENGAGED", "APPROVED"].includes(intro.status) ? "teal" : "amber")}<small class="dim">${esc(intro.consentStatus.toLowerCase())} consent</small></span>` : m.humanDecision === "RECOMMEND" ? btn("Approve introduction", `data-act="introduce" data-id="${id}" data-person="${p.id}"`, "teal sm") : "<span></span>"}${o.isAmana && !team.some((t) => t.personId === p.id) ? btn("Add to team", `data-act="addTeam" data-id="${id}" data-person="${p.id}"`, "ghost sm") : ""}</div></div></section>`; }).join("") : empty("No suggestions yet", "Generate suggestions from the network. Each comes with evidence, provenance and what is still uncertain.")}
    </div><div class="stack">${card("Where this stands", `<dl class="kv"><dt>Suggestions</dt><dd>${matches.length}</dd><dt>Awaiting decision</dt><dd>${matches.filter((m) => m.humanDecision === "UNDECIDED").length}</dd><dt>Recommended</dt><dd class="ok">${matches.filter((m) => m.humanDecision === "RECOMMEND").length}</dd><dt>Introductions</dt><dd>${intros.length}</dd></dl>`)}
      ${card("Introductions", intros.length ? intros.map((i) => `<div class="intro"><div class="row"><b>${esc(C.full(C.person(i.personId)!))}</b>${badge(L().INTRO_STATUS_LABELS[i.status], ["INTRODUCED", "ENGAGED", "APPROVED"].includes(i.status) ? "teal" : "amber")}</div><small class="dim">${esc(L().ROUTE_LABELS[i.route])} · ${esc(i.commercialModel.replace(/_/g, " ").toLowerCase())}${i.commercialSharePct ? ` ${i.commercialSharePct}%` : ""}${i.commercialValue ? ` · ${money(i.commercialValue, i.currency)}` : ""}</small><small class="dim">Consent: ${esc(i.consentStatus.toLowerCase())}</small>${i.notes ? `<p class="dim">${esc(i.notes)}</p>` : ""}<form class="row wrap" data-action="introStatus" data-id="${i.id}"><select name="consentStatus" class="sm">${opt({ NOT_REQUESTED: "Consent not requested", REQUESTED: "Consent requested", GRANTED: "Consent granted", DECLINED: "Consent declined" }, i.consentStatus)}</select><select name="status" class="sm">${opt(L().INTRO_STATUS_LABELS, i.status)}</select><button class="btn glass sm" type="submit">Update</button></form></div>`).join("") : '<span class="dim">None yet. Mark someone Recommend to enable an introduction.</span>', { desc: "Human-approved only. Consent before identity." })}
      ${o.isAmana ? card("Team shortlist", `${team.map((t) => `<div class="row"><span><a href="#/people/${t.personId}"><b>${esc(C.full(C.person(t.personId)!))}</b></a><small class="sub">${esc(t.roleOnTeam)}${t.notes ? ` · ${esc(t.notes)}` : ""}</small></span>${btn("Remove", `data-act="removeTeam" data-id="${t.id}"`, "ghost sm")}</div>`).join("") || '<span class="dim">No one yet.</span>'}<form class="row wrap" data-action="addTeamForm" data-id="${id}"><select name="personId" class="sm">${opt(Object.fromEntries(S.people.filter((p) => p.amanaBench).map((p) => [p.id, C.full(p)])), "", "Add from bench…")}</select><select name="roleOnTeam" class="sm">${opt({ Lead: "Lead", Specialist: "Specialist", Advisor: "Advisor", PMO: "PMO", "Bid director": "Bid director" }, "Lead")}</select><button class="btn glass sm" type="submit">Add</button></form>`, { desc: "Build the SOW / proposal team" }) : ""}</div></div>`;
  return { title: o.title, crumbs: [["Opportunities", "#/opportunities"], [o.title]], html: raw(html) };
}

/** Who is in the Amana team, whose contacts they are, and how well each of us knows people. */
function teamCard(): string {
  const S = C.S();
  const row = (u: { id: string; name: string; role: string }) => {
    const owned = S.relationships.filter((r) => r.networkOwnerId === u.id);
    const people = [...new Set(owned.map((r) => r.personId))];
    const worked = owned.filter((r) => r.workedTogether).length;
    const met = owned.filter((r) => r.metInPerson).length;
    const vouched = S.vouches.filter((v) => v.voucherId === u.id && v.wouldRecommend).length;
    const depth = people.length ? Math.round(people.map((id) => C.depth(C.person(id)!)).reduce((a, b) => a + b, 0) / people.length) : 0;
    return `<li><span class="row gap-sm"><span class="avatar hue-${u.id.length % 4} sm"><span>${esc(u.name.split(" ").map((x) => x[0]).join("").slice(0, 2))}</span></span><span><b class="t">${esc(u.name)}${u.id === S.me.id ? " · you" : ""}</b><small class="sub">${esc(u.role.toLowerCase())} · ${people.length} contact${people.length === 1 ? "" : "s"}</small></span></span>
      <span class="team-nums"><span title="Worked with directly"><ni-icon name="worked" size="13" tone="${worked ? "trust" : "mute"}"></ni-icon>${worked}</span><span title="Met in person"><ni-icon name="person" size="13" tone="${met ? "trust" : "mute"}"></ni-icon>${met}</span><span title="Vouched for"><ni-icon name="vouch" size="13" tone="${vouched ? "trust" : "mute"}"></ni-icon>${vouched}</span><b title="Average knowledge depth">${depth}</b></span></li>`;
  };
  return card("The Amana team", `<ul class="rows team-list">${S.users.map(row).join("")}</ul>
    <p class="dim">Every person in the network belongs to one of us. That is what "whose contact is this" means on a profile — and it is why a client can trust the answer.</p>`,
    { desc: "Who knows whom, and how well.", action: btn("Add a colleague", 'data-act="addColleague"', "glass sm") });
}

function amana(): View {
  const S = C.S();
  const bench = S.people.filter((p) => p.amanaBench || p.usedByAmana).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const opps = S.opportunities.filter((o) => o.isAmana && !["CLOSED_WON", "CLOSED_LOST"].includes(o.status));
  const sowReady = bench.filter((p) => (p.engagementPreferences.includes("SOW") || p.availabilityStatus === "SOW_ONLY") && C.ACTIVE_STATUSES.includes(p.availabilityStatus));
  const caps = [...new Set(bench.flatMap((p) => p.capabilities))];
  const gaps = opps.flatMap((o) => C.capabilityCoverage(o.requiredCapabilities, caps).missing.map((c: string) => ({ c, o })));
  const html = `<div class="page-head"><div><div class="eyebrow">Exclusive workspace</div><h1>Amana Expert Network</h1><p>Who do we genuinely know who could solve this problem, and what evidence do we have?</p></div></div>
    <div class="stats-row">${stat("Trusted bench", bench.filter((p) => p.amanaBench).length)}${stat("Open to SOW now", sowReady.length, undefined, undefined, "teal")}${stat("Used before", bench.filter((p) => p.usedByAmana).length)}${stat("Live requirements", opps.length, undefined, "#/opportunities")}${stat("Capability gaps", gaps.length, undefined, undefined, gaps.length ? "amber" : "teal")}</div>
    <div class="grid-3"><div class="col-2 stack">${card("Trusted experts", `<div class="scroll"><table class="data"><thead><tr><th>Expert</th><th>Capabilities</th><th>Availability</th><th>Routes</th><th class="num">Evidence</th><th>History</th></tr></thead><tbody>${bench.map((p) => `<tr><td>${personLink(p, [p.primaryCity, p.primaryCountry].filter(Boolean).join(", "))}</td><td><div class="chips">${p.capabilities.slice(0, 3).map(chip).join("")}</div></td><td class="nowrap">${availBadge(p)}</td><td class="dim">${esc(p.engagementPreferences.map((r) => (r === "SOW" ? "SOW" : r.toLowerCase())).join(", ") || "—")}</td><td class="num ${C.evOf(p.id).length ? "ok" : "amber"}">${C.evOf(p.id).length}</td><td>${p.usedByAmana ? badge("used by Amana", "teal") : badge("bench", "neutral")}</td></tr>`).join("")}</tbody></table></div>`, { desc: "Bench status, availability and evidence at a glance", flush: true })}
      ${card("Build team", opps.length ? `<ul class="rows">${opps.map((o) => { const team = S.team.filter((t) => t.opportunityId === o.id); return `<li class="col"><div class="row"><a href="#/opportunities/${o.id}"><b>${esc(o.title)}</b><small class="sub">${esc(o.clientName ?? "")} · ${S.matches.filter((m) => m.opportunityId === o.id).length} suggestions</small></a><span class="meta">${badge(L().ROUTE_LABELS[o.engagementRoute], "navy")}${badge(L().OPPORTUNITY_STATUS_LABELS[o.status], "navy")}</span></div><div class="chips">${team.map((t) => `<span class="chip teal"><a href="#/people/${t.personId}">${esc(C.full(C.person(t.personId)!))}</a> · ${esc(t.roleOnTeam)}</span>`).join("") || `<small class="dim">No team yet — <a href="#/opportunities/${o.id}">build the team</a></small>`}</div></li>`; }).join("")}</ul>` : empty("No live Amana requirements"), { desc: "Live Amana requirements and their proposal / SOW shortlists" })}</div>
    <div class="stack">${teamCard()}
      ${card("Amana requirements", (() => { const ab = S.briefs.filter((b) => S.accounts.find((a) => a.id === b.accountId)?.kind === "EXPERT_NETWORK" && !["CLOSED"].includes(b.status)); return ab.length ? `<ul class="rows">${ab.map((b) => { const est = C.demand.estimateFee(b, b.terms, S.rateCard, b.expertHours ?? null); return `<li class="col"><div class="row"><a href="#/requirements/${b.id}"><b>${esc(b.title)}</b></a>${badge(C.demand.BRIEF_STATUS_LABELS[b.status], b.status === "FILLED" ? "teal" : "navy")}</div><small class="dim">${esc(C.demand.FEE_MODEL_LABELS[b.terms.model])}${est.confident ? ` · ${C.demand.fmt(est.ourTake, est.currency)} to us` : ""}</small></li>`; }).join("")}</ul>` : '<span class="dim">None open. Ask the co-pilot from Requirements.</span>'; })(), { desc: "Expert calls and SOW team briefs, with the fee on each", action: `<a class="btn ghost sm" href="#/requirements?kind=EXPERT_NETWORK">All</a>` })}
      ${card("Current capability gaps", gaps.length ? `<ul class="rows">${gaps.map((g: any) => `<li class="col">${badge(g.c, "amber")}<small class="dim">for <a href="#/opportunities/${g.o.id}">${esc(g.o.title)}</a></small></li>`).join("")}</ul>` : '<span class="dim">The bench covers every live requirement.</span>', { desc: "Required by live opportunities, not on the bench" })}
      ${card("Needs a status check", `<ul class="rows">${bench.filter((p) => C.fresh(p) !== "fresh").map((p) => `<li>${personLink(p, null)}${availBadge(p)}</li>`).join("") || '<li class="dim">All current.</li>'}</ul>`)}
      ${card("Engagement history", S.introductions.filter((i) => i.commercialModel === "AMANA_SOW").map((i) => `<div class="row"><b>${esc(C.full(C.person(i.personId)!))}</b><small class="dim">${esc(i.status.toLowerCase().replace(/_/g, " "))}</small></div>`).join("") || '<span class="dim">None recorded.</span>', { desc: "Amana SOW introductions" })}</div></div>`;
  return { title: "Amana Expert Network", crumbs: [["Amana Expert Network"]], html: raw(html) };
}

function partners(q: URLSearchParams): View {
  const S = C.S(); const sel = S.partners.find((p) => p.id === q.get("partner")) ?? S.partners[0];
  const reqs = S.requirements.filter((r) => r.partnerId === sel.id); const intros = S.introductions.filter((i) => i.recruitmentPartnerId === sel.id);
  const previews = reqs.filter((r) => r.linkedOpportunityId).map((r) => ({ r, rows: S.matches.filter((m) => m.opportunityId === r.linkedOpportunityId && ["RECOMMEND", "POSSIBLE"].includes(m.humanDecision)).map((m) => { const p = C.person(m.personId)!; return C.redactForPartner({ ...p, tenantId: "t", evidence: C.evOf(p.id), relationships: C.relsOf(p.id) }); }) }));
  const html = `<div class="page-head"><div><h1>Partners</h1><p>Licensed recruitment partners get controlled, anonymised access. They never see the black book.</p></div><div class="actions">${btn("＋ Log requirement", 'data-act="newRequirement"')}</div></div>
    <div class="grid-side"><div class="card list"><ul>${S.partners.map((p) => `<li><a href="#/partners?partner=${p.id}" class="${sel.id === p.id ? "active" : ""}"><span class="row"><b>${esc(p.name)}</b>${badge(p.subscriptionStatus.toLowerCase(), p.subscriptionStatus === "ACTIVE" ? "teal" : p.subscriptionStatus === "TRIAL" ? "navy" : "amber")}</span><small>${S.requirements.filter((r) => r.partnerId === p.id).length} requirements · ${S.introductions.filter((i) => i.recruitmentPartnerId === p.id).length} introductions</small></a></li>`).join("")}</ul></div>
    <div class="stack"><div class="grid-2">${card("Subscription & commercial model", `<form data-action="partnerTerms" data-id="${sel.id}" class="stack"><div class="grid-2">${field("Status", select("subscriptionStatus", opt({ TRIAL: "Trial", ACTIVE: "Active", PAUSED: "Paused", CANCELLED: "Cancelled" }, sel.subscriptionStatus)))}${field("Tier", input("subscriptionTier", "", sel.subscriptionTier ?? ""))}${field("Commercial model", select("commercialModel", opt({ SUCCESS_SHARE: "Success share", INTRODUCTION_FEE: "Introduction fee", SUBSCRIPTION_INCLUDED: "Included in subscription", NONE: "None" }, sel.commercialModel)))}${field("Share %", input("commercialSharePct", 'type="number" step="0.5" min="0" max="100"', sel.commercialSharePct?.toString() ?? ""), "Target 10–20% where lawful and agreed")}${field("Monthly fee", input("monthlyFee", "", sel.monthlyFee?.toString() ?? ""))}${field("Currency", select("currency", opt({ GBP: "GBP", AED: "AED", SAR: "SAR", USD: "USD" }, sel.currency)))}</div>${check("licensedForPermanent", "Licensed for permanent placements", sel.licensedForPermanent)}${field("Notes", textarea("notes", 'rows="2"', sel.notes ?? ""))}<div class="row end"><button class="btn primary" type="submit">Save terms</button></div></form>`, { desc: "Configurable. Nothing is hard-coded." })}
      <div class="stack">${card("Data boundary", `<div class="grid-2 boundary"><div><b class="ok">Can</b><ul><li>Submit requirements</li><li>See anonymised capability summaries</li><li>Request an introduction</li><li>Track their own activity</li></ul></div><div><b class="bad">Cannot</b><ul><li>Browse relationship notes</li><li>Export the network</li><li>See who else is in the database</li><li>See other partners or Amana activity</li><li>Contact hidden profiles</li></ul></div></div>`, { desc: "What this partner can and cannot see" })}
      ${card("What the partner sees", previews.length ? previews.map(({ r, rows: rs }) => `<b class="t">${esc(r.title)}</b>${rs.length ? `<ul class="rows">${rs.map((x: any) => `<li class="col"><span class="row"><code>${esc(x.ref)}</code>${badge(x.availabilityBand, x.availabilityBand === "near-term" ? "teal" : "neutral")}</span><small class="dim">${esc(x.headlineSummary)} · ${esc(x.region ?? "region undisclosed")}</small><small class="dim">${esc(x.evidenceSummary)}</small></li>`).join("")}</ul>` : '<small class="dim">No shareable results yet (only Recommend / Possible decisions are shared).</small>'}`).join("") : '<span class="dim">Link a requirement to an opportunity with recommended or possible matches.</span>', { desc: "Restricted, anonymised results for linked requirements" })}</div></div>
      ${card("Partner requirements", reqs.length ? `<div class="scroll"><table class="data"><thead><tr><th>Requirement</th><th>Route</th><th>Capabilities</th><th>Budget</th><th>Status</th><th>Linked opportunity</th></tr></thead><tbody>${reqs.map((r) => `<tr><td><b>${esc(r.title)}</b><small class="sub">${esc(r.location ?? "—")} · ${esc(r.seniority ? L().SENIORITY_LABELS[r.seniority] : "—")} · ${esc(rel(r.createdAt))}</small></td><td>${badge(L().ROUTE_LABELS[r.engagementRoute], "navy")}</td><td><div class="chips">${r.requiredCapabilities.map(chip).join("")}</div></td><td class="nowrap">${esc(r.budget ?? "—")}</td><td>${badge(L().REQUIREMENT_STATUS_LABELS[r.status], r.status === "INTRO_REQUESTED" ? "amber" : r.status === "CLOSED" ? "neutral" : "navy")}</td><td><form class="row" data-action="requirement" data-id="${r.id}"><select name="linkedOpportunityId" class="sm">${opt(Object.fromEntries(S.opportunities.map((o) => [o.id, o.title])), r.linkedOpportunityId ?? "", "— not linked —")}</select><select name="status" class="sm">${opt(L().REQUIREMENT_STATUS_LABELS, r.status)}</select><button class="btn glass sm" type="submit">Save</button></form></td></tr>`).join("")}</tbody></table></div>` : empty("No requirements submitted"), { desc: "Link a requirement to an opportunity to share anonymised results.", flush: true })}
      ${card("Introduction requests & commercial tracking", intros.length ? intros.map((i) => `<div class="intro"><div class="row"><b>${esc(C.full(C.person(i.personId)!))}</b>${badge(L().INTRO_STATUS_LABELS[i.status], ["INTRODUCED", "ENGAGED", "APPROVED"].includes(i.status) ? "teal" : "amber")}</div><small class="dim">${esc(S.opportunities.find((o) => o.id === i.opportunityId)?.title ?? "")}</small><small class="dim">${esc(L().ROUTE_LABELS[i.route])} · ${esc(i.commercialModel.replace(/_/g, " ").toLowerCase())}${i.commercialSharePct ? ` ${i.commercialSharePct}%` : ""}${i.commercialValue ? ` of ${money(i.commercialValue, i.currency)} ≈ ${money(i.commercialValue * ((i.commercialSharePct ?? 0) / 100), i.currency)}` : ""}</small><small class="dim">Identity ${["IDENTITY_REVEALED", "INTRODUCED", "ENGAGED"].includes(i.status) ? "revealed" : "hidden"}</small></div>`).join("") : '<span class="dim">No introductions yet.</span>')}</div></div>`;
  return { title: "Partners", crumbs: [["Partners"]], html: raw(html) };
}

function relocation(): View {
  const S = C.S(); const rs = [...S.relocation].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const html = `<div class="page-head"><div><h1>Relocation advisory</h1><p>Location context already lives in each profile. Advisory is a separate paid service, funded by the individual or their employer, never bundled into a recruitment fee.</p></div><div class="actions">${btn("＋ Capture interest", 'data-act="relocationAny"')}</div></div>
    <div class="stats-row">${stat("Active pipeline", rs.filter((r) => !["COMPLETED", "NOT_PROCEEDING"].includes(r.advisoryStatus)).length)}${stat("Wants advisory", rs.filter((r) => r.relocationAdvisoryInterest).length, undefined, undefined, "teal")}${stat("Employer funded", rs.filter((r) => r.employerSponsored).length)}${stat("Family moves", rs.filter((r) => r.familyMove).length)}</div>
    ${rs.length ? `<div class="card table-card"><div class="scroll"><table class="data"><thead><tr><th>Person</th><th>Current</th><th>Target</th><th>Window</th><th>Interest</th><th>Funding</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>${rs.map((r) => `<tr><td>${personLink(C.person(r.personId)!)}</td><td class="nowrap">${esc(r.currentLocation ?? "—")}</td><td class="nowrap"><b>${esc(r.targetLocation ?? "—")}</b></td><td class="dim">${esc(r.targetMoveWindow ?? "—")}</td><td><div class="chips">${[r.relocationAdvisoryInterest && "advisory", r.familyMove && "family", r.schoolGuidanceInterest && "schools", r.housingGuidanceInterest && "housing"].filter(Boolean).map((c) => chip(c as string)).join("")}</div></td><td>${badge(r.employerSponsored ? "Employer" : "Individual", r.employerSponsored ? "teal" : "neutral")}</td><td>${badge(L().ADVISORY_LABELS[r.advisoryStatus], r.advisoryStatus === "ACTIVE" ? "teal" : "navy")}</td><td class="dim wrap">${esc(r.notes ?? "—")}</td><td class="right">${btn("Edit", `data-act="relocation" data-id="${r.personId}"`, "glass sm")}</td></tr>`).join("")}</tbody></table></div></div>` : empty("No relocation interest captured")}`;
  return { title: "Relocation", crumbs: [["Relocation"]], html: raw(html) };
}

let importPreview: any = null;
const COLUMN_GUIDE: [string, string, string][] = [
  ["first_name, last_name", "Required.", "Sarah · Okonkwo"],
  ["email", "Spots duplicates and is used for meeting invites.", "sarah@example.com"],
  ["headline", "One line on what they are known for.", "Programme director who stabilises troubled transformations"],
  ["company, role", "Current employer and job title.", "Independent · Programme Director"],
  ["city, country", "Where they are based.", "London · UK"],
  ["capabilities", "What they are good at. Separate with semicolons.", "Programme director; Turnaround"],
  ["sectors", "Industries they know. Separate with semicolons.", "Banking; Insurance"],
  ["work_rights", "Visas and rights to work, so client briefs like \"already has a UAE visa\" can be checked.", "UK citizen; UAE residence visa"],
  ["source", "Where they came into your network.", "Worked together · Introduction · Event · LinkedIn"],
  ["relationship", "How you know them.", "Worked with · Introduced · Peer · Knows of"],
  ["introduced_by", "Who introduced them, by full name. Can be someone else in the same file.", "Sarah Okonkwo"],
  ["worked_together", "Yes if you have personally worked with them.", "Yes"],
  ["notes", "Private. Only your team ever sees this.", "Prefers a call over email."],
];
function importView(): View {
  const S = C.S();
  const html = `<div class="page-head"><div><h1>Import contacts</h1><p>Upload your list from Excel or a CSV, or paste the rows. Nothing is written until you have checked the preview and confirmed.</p></div></div>
    <ol class="steps"><li class="${importPreview ? "done" : "now"}"><b>1</b><span>Choose file or paste</span></li><li class="${importPreview ? "now" : ""}"><b>2</b><span>Check the preview</span></li><li><b>3</b><span>Import</span></li></ol>
    <div class="grid-import"><div class="stack">
      ${card("Upload or paste", `<form data-action="previewImport" class="stack"><label class="drop" id="drop"><input type="file" name="file" accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain" data-file><b id="drop-label">Choose an Excel or CSV file</b><small>.xlsx or .csv · drag it here · up to 2,000 rows</small></label><div class="or">or</div>${field("Paste rows", textarea("text", 'rows="5" class="mono" placeholder="first_name\tlast_name\temail\tcompany\ncopied straight out of Excel"'), "Select the cells in Excel, copy, and paste here. Include the header row.")}<div class="grid-2">${field("If a row has no source", select("defaultSource", opt(L().SOURCE_LABELS, "PERSONAL_NETWORK")))}${field("If a row has no relationship", select("defaultRelationship", opt(L().RELATIONSHIP_LABELS, "DIRECT")))}</div><button class="btn primary" type="submit">Check the preview</button></form>`, { desc: "Only first and last name are required. Everything else improves matching and can be added later from conversations." })}
      ${card("What each column means", `<table class="guide">${COLUMN_GUIDE.map(([k, d, ex]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(d)}<small>${esc(ex)}</small></td></tr>`).join("")}</table><p class="dim" style="margin-top:10px">Column names are matched loosely, so "Surname", "Job Title" or "Skills" from an existing spreadsheet work without renaming. Unrecognised columns are ignored and listed in the preview.</p>${btn("Copy blank template to clipboard", 'data-act="copyTemplate"', "glass sm")}`)}
    </div>
    <div id="import-preview">${importPreview ? renderImportPreview() : `<div class="empty tall"><b>The preview appears here</b><p>You will see every row with a status: ready, already in your network, or needs a fix. Rows with problems are shown, never silently dropped.</p><p class="dim" style="margin-top:12px">After import, each person appears in your reconnect queue with you as the relationship owner.</p></div>`}</div></div>`;
  return { title: "Import contacts", crumbs: [["Experts", "#/network"], ["Import contacts"]], html: raw(html), after: () => { const drop = document.getElementById("drop"); if (!drop) return; ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })); ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })); drop.addEventListener("drop", (e: DragEvent) => { const f = e.dataTransfer?.files?.[0]; if (!f) return; const inp = drop.querySelector("input") as HTMLInputElement; const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; document.getElementById("drop-label")!.textContent = f.name; inp.form?.requestSubmit(); }); } };
}
function renderImportPreview(): string {
  const pv = importPreview; if (!pv.ok) return `<div class="note-amber"><b>Could not read that.</b> ${esc(pv.error)}</div>`;
  const ready = pv.rows.filter((r: any) => !r.issues.length && !r.duplicateOf).length;
  const dup = pv.rows.filter((r: any) => r.duplicateOf === "existing").length, fix = pv.rows.filter((r: any) => r.issues.length).length;
  return `<section class="card"><header><div><h3>Check the preview</h3><p>${pv.rows.length} rows${pv.sheet ? ` from sheet "${esc(pv.sheet)}"` : ""} · <b class="ok">${ready} ready</b>${dup ? ` · ${dup} already in your network` : ""}${fix ? ` · <b class="amber">${fix} need a fix</b>` : ""}</p></div>${btn(`Import ${ready} ${ready === 1 ? "person" : "people"}`, `data-act="commitImport" ${ready ? "" : "disabled"}`, "teal")}</header><div class="body flush">${pv.mapped?.length ? `<div class="mapped"><span>Matched columns</span>${pv.mapped.map((m: string) => chip(m)).join("")}${pv.unknown?.length ? `<span class="dim">Ignored</span>${pv.unknown.map((m: string) => chip(m)).join("")}` : ""}</div>` : ""}<div class="scroll tall"><table class="data"><thead><tr><th>#</th><th>Person</th><th>Company · role</th><th>Location</th><th>Capabilities</th><th>Provenance</th><th>Status</th></tr></thead><tbody>${pv.rows.map((r: any) => { const st = r.issues.length ? "blocked" : r.duplicateOf ? "dup" : "ready"; return `<tr class="${st}"><td class="dim">${r.line}</td><td><b>${esc(r.firstName)} ${esc(r.lastName)}</b><small class="sub mono">${esc(r.email ?? "")}</small></td><td class="dim">${esc([r.role, r.company].filter(Boolean).join(" · ") || "—")}</td><td class="dim">${esc([r.city, r.country].filter(Boolean).join(", ") || "—")}</td><td><div class="chips">${r.capabilities.slice(0, 3).map(chip).join("")}</div></td><td class="dim">${esc(L().SOURCE_LABELS[r.source])} · ${esc(L().RELATIONSHIP_LABELS[r.relationship])}${r.introducedBy ? `<small class="sub">via ${esc(r.introducedBy)}</small>` : ""}</td><td>${st === "ready" ? badge("Ready", "teal") : st === "dup" ? badge("Already added", "neutral") : badge("Needs a fix", "amber")}${r.issues.map((i: string) => `<small class="sub amber">${esc(i)}</small>`).join("")}${r.warnings.map((w: string) => `<small class="sub">${esc(w)}</small>`).join("")}</td></tr>`; }).join("")}</tbody></table></div></div></section>`;
}
function buildImportPreview(text: string, defaultSource: string, defaultRel: string, gridIn?: string[][]) {
  const S = C.S(); const grid: string[][] = (gridIn ?? C.parseCsv(text)).filter((r: string[]) => r.some((v) => v.trim() !== ""));
  if (grid.length < 2) return { ok: false, error: "Need a header row and at least one contact row." };
  const { map, unknown } = C.mapHeaders(grid[0]);
  if (map.first_name === undefined && map.last_name === undefined) return { ok: false, error: `No name columns found. The first row needs headers such as first_name and last_name. Headers seen: ${grid[0].filter(Boolean).join(", ") || "none"}.` };
  const get = (r: string[], k: string) => (map[k] === undefined ? null : (r[map[k] as number] ?? "").trim() || null);
  const VS = new Set(Object.keys(L().SOURCE_LABELS)), VR = new Set(Object.keys(L().RELATIONSHIP_LABELS));
  const normEnum = (rawV: string | null, aliases: Record<string, string>, valid: Set<string>, fb: string) => { if (!rawV) return { value: fb }; const up = rawV.trim().toUpperCase().replace(/[\s-]+/g, "_"); if (valid.has(up)) return { value: up }; const a = aliases[rawV.trim().toLowerCase()]; return a ? { value: a } : { value: fb, warning: `"${rawV}" not recognised; using ${fb.toLowerCase().replace(/_/g, " ")}` }; };
  const byEmail = new Map(S.people.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p.id])), byName = new Map(S.people.map((p) => [C.full(p).toLowerCase(), p.id]));
  const seen = new Set<string>();
  const rows = grid.slice(1, 2001).map((r: string[], i: number) => {
    const issues: string[] = [], warnings: string[] = [];
    let firstName = get(r, "first_name") ?? "", lastName = get(r, "last_name") ?? "";
    if (!lastName && firstName.includes(" ")) { const parts = firstName.split(/\s+/); firstName = parts.shift() ?? ""; lastName = parts.join(" "); warnings.push("Split full name"); }
    if (!firstName) issues.push("First name is missing"); if (!lastName) issues.push("Last name is missing");
    const email = get(r, "email")?.toLowerCase() ?? null; if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("Email is not valid");
    const src = normEnum(get(r, "source"), C.SOURCE_ALIASES, VS, defaultSource), rl = normEnum(get(r, "relationship"), C.RELATIONSHIP_ALIASES, VR, defaultRel);
    if (src.warning) warnings.push(src.warning); if (rl.warning) warnings.push(rl.warning);
    const key = email ?? `${firstName} ${lastName}`.toLowerCase();
    let duplicateOf: string | null = (email && byEmail.get(email)) || byName.get(`${firstName} ${lastName}`.toLowerCase()) ? "existing" : null;
    if (seen.has(key)) { issues.push("Duplicate row in this file"); duplicateOf = duplicateOf ?? "file"; } seen.add(key);
    if (duplicateOf === "existing") warnings.push("Already in the network; will be skipped");
    const yes = (s: string | null) => !!s && /^(y|yes|true|1)$/i.test(s.trim());
    return { line: i + 2, firstName, lastName, email, phone: get(r, "phone"), headline: get(r, "headline"), company: get(r, "company"), role: get(r, "role"), city: get(r, "city"), country: get(r, "country"), capabilities: C.list(get(r, "capabilities")), sectors: C.list(get(r, "sectors")), workRights: C.list(get(r, "work_rights")), linkedin: get(r, "linkedin"), source: src.value, relationship: rl.value, introducedBy: get(r, "introduced_by"), workedTogether: yes(get(r, "worked_together")) || rl.value === "WORKED_WITH" || src.value === "WORKED_TOGETHER", notes: get(r, "notes"), issues, warnings, duplicateOf };
  });
  return { ok: true, rows, unknown, mapped: Object.keys(map) };
}

function settings(q: URLSearchParams): View {
  const S = C.S(); const tab = ["commercials", "screening", "privacy"].includes(q.get("tab") ?? "") ? (q.get("tab") as string) : "general";
  const html = `<div class="page-head"><div><h1>Settings</h1><p>Integrations, identity, commercial terms, and the audit trail of every sensitive action.</p></div><div class="actions"><div class="seg"><a href="#/settings" class="${tab === "general" ? "active" : ""}">General</a><a href="#/settings?tab=screening" class="${tab === "screening" ? "active" : ""}">Screening call</a><a href="#/settings?tab=commercials" class="${tab === "commercials" ? "active" : ""}">Commercials</a><a href="#/settings?tab=privacy" class="${tab === "privacy" ? "active" : ""}">Privacy</a></div></div></div>
    ${tab === "privacy" ? (() => {
      const P = C.privacy;
      const flagged = S.people.map((p) => ({ p, due: P.retentionDue({ privacy: p.privacy, lastContactAt: C.relsOf(p.id).map((r) => r.lastContactDate).filter(Boolean).sort().reverse()[0] ?? p.updatedAt, screenedAt: p.screenedAt }) })).filter((x) => x.due.length);
      const stale = S.people.filter((p) => p.memberSince && P.consentStale(p));
      const erasures = S.people.filter((p) => P.privacyOf(p).erasureRequestedAt);
      const hidden = S.people.filter((p) => !P.canShareAnonymised(p));
      return `<div class="grid-3"><div class="col-2 stack">
        ${card("What we hold, and for how long", `<div class="scroll"><table class="data"><thead><tr><th>Data</th><th>Why we may hold it</th><th>Kept</th><th>Then</th></tr></thead><tbody>${P.RETENTION.map((r) => `<tr><td><b>${esc(r.label)}</b><small class="sub wrap">${esc(r.what)}</small></td><td class="dim">UK: ${esc(r.ukBasis)}<small class="sub">PDPL: ${esc(r.pdplBasis)}</small></td><td class="nowrap">${r.months ? `${r.months} months` : "while consented"}<small class="sub">from ${esc(r.trigger)}</small></td><td>${badge(r.onExpiry, r.onExpiry === "delete" ? "amber" : "neutral", true)}</td></tr>`).join("")}</tbody></table></div>`, { desc: "UK GDPR and the Data Protection Act 2018, and the UAE PDPL. The stricter of the two wins.", flush: true })}
        ${card("Due for action", flagged.length ? `<ul class="rows">${flagged.slice(0, 8).map(({ p, due }) => `<li>${personLink(p, due.map((d) => `${d.label} · ${d.action}`).join(" · "))}<span class="row gap-sm">${badge(due[0].action, due[0].action === "delete" ? "amber" : "neutral", true)}<small class="when">${esc(fmtDate(due[0].due.toISOString()))}</small></span></li>`).join("")}</ul>` : '<span class="dim">Nothing is past its date. The sweep runs monthly.</span>', { desc: "Past its retention date, or asked to be deleted." })}
      </div><div class="stack">
        ${card("Consent, at a glance", `<ul class="rows"><li><span>Hidden from clients</span><b>${hidden.length}</b></li><li><span>Deletion requested</span><b>${erasures.length}</b></li><li><span>Consent not checked in 12 months</span><b>${stale.length}</b></li><li><span>People in the network</span><b>${S.people.length}</b></li></ul>`, { desc: "Consent is granular, and withdrawal is immediate." })}
        ${card("Their rights", `<ul class="rows">${P.RIGHTS.map((r) => `<li class="col"><b>${esc(r.label)}</b><small class="dim">${esc(r.detail)}</small></li>`).join("")}</ul>`, { desc: "Every one of these is a button on their own profile, not a support ticket." })}
        ${card("Where the data lives", `<ul class="rows"><li class="col"><b>In your tenant</b><small class="dim">Profiles, conversations, vouches, shortlists and fees. Never pooled across tenants.</small></li><li class="col"><b>On their device</b><small class="dim">Screening audio. Speech becomes text in their own browser; no audio is uploaded.</small></li><li class="col"><b>With the voice provider</b><small class="dim">Only our questions, and only when the natural voice is switched on — with names and figures stripped.</small></li></ul>`, { desc: "Security is mostly about where things are not." })}
      </div></div>`;
    })() : tab === "screening" ? `<div class="grid-3"><div class="col-2 stack">${mv.scriptEditor()}</div><div class="stack">${card("How the conversation works", `<ol class="steps-list"><li><b>They get a link.</b> From their invitation, or from you.</li><li><b>They choose voice or typing.</b> On voice, each question is read aloud and their answer is transcribed live.</li><li><b>They can correct anything</b> before moving on. Nothing is hidden from them.</li><li><b>It lands with you to review.</b> The profile only updates when you approve it.</li><li><b>Referrals fall out of it.</b> Anyone they name becomes a referral in your inbox.</li></ol>`, { desc: "Voice first, with typing always available." })}${card("What it fills in", `<div class="chips">${["Headline", "Capabilities", "Sectors", "Seniority", "Availability", "Routes", "Notice", "Location", "Work rights", "Rate or salary", "Constraints", "Working style", "8 attributes", "People they vouch for"].map(chip).join("")}</div>`, { desc: "Every answer maps to a field you can search on." })}</div></div>` : tab === "commercials" ? `<div class="grid-3"><div class="col-2 stack">${dv.commercialsCard()}</div><div class="stack">${card("Who pays", `<p class="dim">Network members are never charged, for anything. Money only ever moves when a client, an agency or Amana gets someone through us.</p>`, { desc: "One line, so it is never in doubt." })}
      ${card("How the models work", `<ul class="rows"><li class="col"><b>Direct client, permanent</b><small class="dim">Success fee as a % of first-year base salary. Invoiced on start date.</small></li><li class="col"><b>Agency, permanent</b><small class="dim">The agency charges its client; we take a referral share of that fee. Only licensed partners handle the placement.</small></li><li class="col"><b>Contract, interim, fractional</b><small class="dim">A margin on the billed day rate for the length of the engagement, or a share of the agency's margin.</small></li><li class="col"><b>Amana expert calls</b><small class="dim">A platform take on the expert's hourly rate. The expert receives the rest.</small></li><li class="col"><b>Amana SOW teams</b><small class="dim">A share of the SOW value for people we bring to the team.</small></li><li class="col"><b>Agency access</b><small class="dim">Optional monthly fee for portal access, set per account.</small></li></ul>`, { desc: "Plain-English version of the rate card." })}</div></div>` : `<div class="grid-3"><div class="col-2 stack">${card("Audit log", `<div class="scroll"><table class="data"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead><tbody>${S.audit.slice(0, 80).map((a) => `<tr><td class="dim nowrap">${esc(rel(a.createdAt))}</td><td class="nowrap">${esc(C.userName(a.actorId))}</td><td><code class="${a.action === "identity.reveal" ? "amber" : ""}">${esc(a.action)}</code></td><td class="dim">${esc(a.entityType)}</td><td class="dim wrap">${esc(a.detail ?? "")}</td></tr>`).join("")}</tbody></table></div>`, { desc: "Login, record changes, exports, identity reveals, approvals, permission changes and integrations.", flush: true })}</div>
    <div class="stack">${card("Integrations", [["MANUAL", "Manual (call / in person)", "Always available."], ["MICROSOFT_GRAPH", "Microsoft Outlook / Teams", "Calendars.ReadWrite · OnlineMeetings.ReadWrite"], ["CALENDLY", "Calendly", "default scope · booked / cancelled webhooks"]].map(([k, l, d]) => `<div class="row"><span><b class="t">${esc(l)}</b><small class="sub">${esc(d)}</small></span>${S.connections.includes(k) ? badge("connected", "teal") : btn("Connect", `data-act="connect" data-id="${k}"`, "glass sm")}</div>`).join(""), { desc: "Least-privilege scopes are shown before connecting." })}
      ${card("Users & roles", S.users.map((u) => `<div class="row"><span><b class="t">${esc(u.name)}</b><small class="sub">${esc(u.role.toLowerCase())}</small></span>${badge(u.role === "OWNER" ? "owner" : "contributor", u.role === "OWNER" ? "navy" : "neutral")}</div>`).join(""))}
      ${card("Data", `<p class="dim">Storage: <b>${C.persistMode() === "db" ? "shared artifact store" : "this browser only"}</b>. Every change you make here is kept. Seeded demo people can be hidden once you have your own.</p>${btn("Hide demo people", 'data-act="hideDemo"', "ghost sm")}`)}</div></div>`}`;
  return { title: "Settings", crumbs: [["Settings"]], html: raw(html) };
}

// ---------- actions (buttons) ----------
const personOptions = (except?: string) => opt(Object.fromEntries(C.S().people.filter((p) => p.id !== except).sort((a, b) => a.lastName.localeCompare(b.lastName)).map((p) => [p.id, C.full(p)])), "", "— nobody / direct —");
const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  /** A colleague brings their own contact book with them; that is the whole point of adding one. */
  addColleague() {
    C.openDrawer("Add a colleague", "Someone in Amana who brings their own contacts. Their relationships stay theirs — the profile says whose contact each person is.", raw(
      `${field("Name", input("name", "required"), undefined, true)}${field("Email", input("email", 'type="email"'))}
       ${field("Role", select("role", opt({ CONTRIBUTOR: "Contributor — adds and manages their own contacts", OWNER: "Owner — full access, including commercials" }, "CONTRIBUTOR")))}
       <div class="wash-tile"><b>What they can see</b><span class="dim">Everything in the network, because that is how a shared network works. What they cannot do is change your commercial terms unless you make them an owner.</span></div>`
    ), async (fd: FormData) => {
      const name = String(fd.get("name") || "").trim(); if (!name) { C.toast("Give them a name", "amber"); return; }
      const u = { id: C.uid(), name, role: String(fd.get("role")) as "OWNER" | "CONTRIBUTOR" };
      const S = C.S(); S.users = [...S.users, u];
      await C.commit("users", u, { action: "user.role_change", entityType: "Settings", entityId: u.id, detail: `${name} added as ${u.role.toLowerCase()}` });
      C.closeDrawer(); C.toast(`${name.split(" ")[0]} is in the team`); C.render();
    }, { submitLabel: "Add them" });
  },
  /** Book a coffee, a brunch, a walk. It goes in the diary like any other meeting, because it is one. */
  bookCatchUp(el) {
    const p = C.person(el.dataset.id!)!; const kindKey = el.dataset.kind ?? "coffee";
    const kind = C.automation.CATCH_UPS.find((c) => c.key === kindKey)!;
    const when = new Date(Date.now() + 3 * 86_400_000); when.setHours(10, 0, 0, 0);
    C.openDrawer(`${kind.emoji} ${kind.label} with ${C.full(p)}`, `Not a task — a catch-up. ${p.firstName} is a person before they are a profile.`, raw(
      `<div class="grid-2">${field("When", input("startAt", 'type="datetime-local"', when.toISOString().slice(0, 16)))}${field("What", select("kind", opt(Object.fromEntries(C.automation.CATCH_UPS.map((c) => [c.key, `${c.emoji} ${c.label}`])), kindKey)))}</div>
       ${field("Where", input("where", 'placeholder="e.g. that place near the DIFC"'))}
       ${field("Your opening line", textarea("note", 'rows="2"', C.automation.catchUpOpener({ personId: p.id, name: C.full(p), reason: "", kind: kindKey as any, score: 0, months: null }, p.persona?.interests ?? [])), "Copy it, send it, change it — whatever gets it in the diary.")}`
    ), async (fd: FormData) => {
      const k = String(fd.get("kind")); const start = new Date(String(fd.get("startAt")));
      const c = C.automation.CATCH_UPS.find((x) => x.key === k)!;
      await C.commit("scheduled", { id: C.uid(), personId: p.id, ownerId: C.S().me.id, provider: "MANUAL", startAt: start.toISOString(), endAt: new Date(start.getTime() + c.minutes * 60e3).toISOString(), meetingType: k.toUpperCase(), status: "SCHEDULED" } as any, { action: "conversation.schedule", entityType: "Person", entityId: p.id, detail: `${c.label} with ${C.full(p)}` });
      const rel = C.relsOf(p.id).find((r) => r.networkOwnerId === C.S().me.id);
      if (rel) await C.commit("relationships", { ...rel, lastContactDate: new Date().toISOString() });
      C.closeDrawer(); C.toast(`${c.emoji} ${c.label} with ${p.firstName} is in the diary`); C.render();
    }, { submitLabel: "Put it in the diary" });
  },
  async toggleAuto(el) {
    const key = el.dataset.key!; const S = C.S();
    const next = { ...(S.automations ?? C.automation.DEFAULT_AUTOMATIONS) };
    next[key as keyof typeof next] = !next[key as keyof typeof next];
    S.automations = next; C.savePref("automations", next);
    C.logAudit("integration.connect", "Settings", null, `${key} ${next[key as keyof typeof next] ? "on" : "off"}`);
    C.toast(next[key as keyof typeof next] ? "On" : "Off", "neutral"); C.render();
  },
  /**
   * "I have met them." A first-hand impression, captured by tapping rather than typing: how you
   * met, what they were like, and whether you would put your own name behind them. It writes a
   * vouch from you, sets the observed attributes, and marks the relationship as met in person —
   * which is the strongest thing the credibility strip can say.
   */
  metThem(el) {
    const id = el.dataset.id!; const p = C.person(id)!; const S = C.S();
    const groups = C.traits.chipsByAttribute();
    const existing = C.vouchesOf(id).find((v) => v.voucherId === S.me.id && v.voucherKind === "USER");
    const chosen = new Set(existing?.attributes ? C.traits.scoresToTraits(existing.attributes).map((c) => c.key) : []);
    const tagsOn = new Set(existing?.tags ?? []);
    const body = `
      <div class="grid-2">${field("How did you meet?", select("kind", opt(Object.fromEntries(C.traits.MEETING_KINDS), "IN_PERSON")))}${field("When", input("when", 'type="date"', new Date().toISOString().slice(0, 10)))}</div>
      ${field("Where, or in what context", input("where", 'placeholder="e.g. Dubai, at the client site"'))}
      <div class="field"><span>What were they like?</span><small class="hint">Tap what fits. Nothing is a pass or a fail — the quiet end is a real answer.</small>
        <div class="trait-groups">${groups.map((g) => `<div class="trait-group"><small class="lbl">${esc(g.label)}</small><div class="chips pick">${g.chips.map((c) => `<label class="pick-chip ${chosen.has(c.key) ? "on" : ""}"><input type="checkbox" name="traits" value="${c.key}" ${chosen.has(c.key) ? "checked" : ""}><span>${esc(c.label)}</span></label>`).join("")}</div></div>`).join("")}</div></div>
      <div class="field"><span>As a person</span><div class="chips pick">${C.traits.PERSON_TAGS.map((t) => `<label class="pick-chip ${tagsOn.has(t) ? "on" : ""}"><input type="checkbox" name="tags" value="${esc(t)}" ${tagsOn.has(t) ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div></div>
      ${field("In your words", textarea("note", 'rows="2" placeholder="One line you would actually say about them."', existing?.statement ?? ""))}
      ${check("wouldRefer", "I would personally refer them", existing?.wouldRecommend ?? true)}
      ${check("updateProfile", "Add what I picked to their working-style profile", true)}`;
    C.openDrawer(`You met ${C.full(p)}`, "Your own first-hand impression. It carries more weight than anything the system works out on its own.", raw(body), async (fd: FormData) => {
      const traits = fd.getAll("traits").map(String); const tags = fd.getAll("tags").map(String);
      const kind = String(fd.get("kind")); const when = String(fd.get("when") || "") || null; const where = String(fd.get("where") || "") || null;
      const note = String(fd.get("note") || "").trim(); const wouldRefer = fd.get("wouldRefer") === "on";
      const scores = C.traits.traitsToScores(traits);
      const now = C.nowISO();
      const summary = C.traits.meetingSummary({ by: S.me.name, kind, when, where, traits, tags, note, wouldRefer });
      const v: Vouch = { id: existing?.id ?? C.uid(), personId: id, voucherId: S.me.id, voucherKind: "USER", context: `${C.traits.MEETING_KINDS.find(([k]) => k === kind)?.[1] ?? "Met"}${where ? ` · ${where}` : ""}`, statement: note || summary, wouldRecommend: wouldRefer, attributes: Object.keys(scores).length ? scores : null, tags, meetingKind: kind, metInPerson: kind === "IN_PERSON" || kind === "WORKED_TOGETHER", createdAt: existing?.createdAt ?? now };
      await C.commit("vouches", v, { action: "vouch.create", entityType: "Person", entityId: id, detail: `${S.me.name} met ${C.full(p)}${wouldRefer ? " and would refer them" : ""}` });
      // A first-hand meeting is also provenance: it says how well we know them, not just that we do.
      const rel = C.relsOf(id).find((r) => r.networkOwnerId === S.me.id);
      if (rel) await C.commit("relationships", { ...rel, metInPerson: v.metInPerson || rel.metInPerson, metAt: when ?? rel.metAt ?? now, lastContactDate: when ?? now, wouldWorkTogetherAgain: wouldRefer ? true : rel.wouldWorkTogetherAgain });
      else await C.commit("relationships", { id: C.uid(), personId: id, networkOwnerId: S.me.id, sourceType: "PERSONAL_NETWORK", relationshipType: "DIRECT", workedTogether: kind === "WORKED_TOGETHER", metInPerson: v.metInPerson, metAt: when ?? now, lastContactDate: when ?? now, wouldWorkTogetherAgain: wouldRefer ? true : null, relationshipNotes: summary } as Relationship);
      if (fd.get("updateProfile") === "on" && tags.length) await C.commit("people", { ...p, personTags: [...new Set([...(p.personTags ?? []), ...tags])], updatedAt: now });
      C.closeDrawer(); C.toast(wouldRefer ? `Noted — you would personally refer ${p.firstName}` : `Noted. ${p.firstName}'s profile has your impression on it`); C.render();
    }, { wide: true, submitLabel: "Save what I saw" });
  },
  addPerson() {
    C.openDrawer("Add a person", "Takes under a minute. Where they came from and who knows them are required, because that is the intelligence.", raw(`<div class="grid-2">${field("First name", input("firstName", "required"), undefined, true)}${field("Last name", input("lastName", "required"), undefined, true)}</div>${field("Headline", input("headline", 'placeholder="e.g. Programme director who stabilises troubled transformations"'), "One line on what they are known for")}<div class="grid-2">${field("Current company", input("currentCompany"))}${field("Current role", input("currentRole"))}${field("City", input("primaryCity", 'placeholder="London"'))}${field("Country", input("primaryCountry", 'placeholder="UK"'))}</div>${field("Expertise", input("capabilities", 'placeholder="Transformation, PMO, cyber security"'), "Comma separated. Refined later from conversations.")}${field("Email", input("email", 'type="email"'))}<div class="divider">Relationship provenance</div><div class="grid-2">${field("Source", select("sourceType", opt(L().SOURCE_LABELS, "PERSONAL_NETWORK")), undefined, true)}${field("How you know them", select("relationshipType", opt(L().RELATIONSHIP_LABELS, "DIRECT")), undefined, true)}</div>${field("Introduced by", select("introducedById", personOptions()), "Pick a person already in the network")}${check("workedTogether", "I have worked with them directly")}${field("Private relationship notes", textarea("relationshipNotes", 'rows="3" placeholder="Who knows them, what you have seen, anything to remember."'), "Never shown to partners or clients.")}`), async (fd: FormData) => {
      const id = C.uid(); const now = C.nowISO();
      const p: Person = { id, firstName: String(fd.get("firstName")).trim(), lastName: String(fd.get("lastName")).trim(), email: String(fd.get("email") || "") || null, headline: String(fd.get("headline") || "") || null, currentCompany: String(fd.get("currentCompany") || "") || null, currentRole: String(fd.get("currentRole") || "") || null, primaryCity: String(fd.get("primaryCity") || "") || null, primaryCountry: String(fd.get("primaryCountry") || "") || null, targetLocations: [], capabilities: C.list(String(fd.get("capabilities") || "")), sectors: [], engagementPreferences: [], availabilityStatus: "NEEDS_REFRESH", availabilityConfidence: 30, relocationInterest: false, amanaBench: false, usedByAmana: false, nextAction: "Book first conversation", nextActionDate: null, createdAt: now, updatedAt: now };
      if (!p.firstName || !p.lastName) { C.toast("First and last name are required", "amber"); return; }
      await C.commit("people", p, { action: "person.create", entityType: "Person", entityId: id, detail: C.full(p) });
      await C.commit("relationships", { id: C.uid(), personId: id, networkOwnerId: C.S().me.id, sourceType: fd.get("sourceType"), relationshipType: fd.get("relationshipType"), introducedById: String(fd.get("introducedById") || "") || null, workedTogether: fd.get("workedTogether") === "on" || fd.get("relationshipType") === "WORKED_WITH", relationshipNotes: String(fd.get("relationshipNotes") || "") || null, lastContactDate: now });
      C.closeDrawer(); C.toast(`${C.full(p)} added`); location.hash = `#/people/${id}`;
    }, { submitLabel: "Add person" });
  },
  editPerson(el) {
    const p = C.person(el.dataset.id!)!;
    C.openDrawer(`Edit ${C.full(p)}`, "Structured fields. Conversations refine these over time.", raw(`${field("Headline", input("headline", "", p.headline ?? ""))}<div class="grid-2">${field("Current company", input("currentCompany", "", p.currentCompany ?? ""))}${field("Current role", input("currentRole", "", p.currentRole ?? ""))}${field("City", input("primaryCity", "", p.primaryCity ?? ""))}${field("Country", input("primaryCountry", "", p.primaryCountry ?? ""))}</div><div class="grid-2">${field("Target locations", input("targetLocations", "", p.targetLocations.join(", ")), "Comma separated")}${field("Work rights", input("workRights", 'placeholder="UK citizen, UAE residence visa"', (p.workRights ?? []).join(", ")), "Visas and rights to work. Checked against client briefs.")}</div>${field("Capabilities", textarea("capabilities", 'rows="2"', p.capabilities.join(", ")), "Comma separated")}${field("Sectors", input("sectors", "", p.sectors.join(", ")))}<div class="grid-2">${field("Seniority", select("seniority", opt(L().SENIORITY_LABELS, p.seniority ?? "", "—")))}${field("Notice period", input("noticePeriod", "", p.noticePeriod ?? ""))}${field("Rate expectation", input("rateExpectation", 'placeholder="£1,200/day"', p.rateExpectation ?? ""))}${field("Salary expectation", input("salaryExpectation", 'placeholder="£150k"', p.salaryExpectation ?? ""))}${field("Email", input("email", "", p.email ?? ""))}${field("LinkedIn URL", input("linkedinUrl", "", p.linkedinUrl ?? ""))}</div><div class="field"><span>Engagement preferences</span><div class="checks">${Object.entries(L().ROUTE_LABELS).map(([k, v]) => check("engagementPreferences", v as string, p.engagementPreferences.includes(k as any), k)).join("")}</div></div><div class="grid-2">${field("Next action", input("nextAction", "", p.nextAction ?? ""))}${field("By", input("nextActionDate", 'type="date"', p.nextActionDate ? p.nextActionDate.slice(0, 10) : ""))}</div><div class="checks">${check("amanaBench", "Amana trusted bench", p.amanaBench)}${check("relocationInterest", "Relocation interest", p.relocationInterest)}</div>`), async (fd: FormData) => {
      const np: Person = { ...p, headline: String(fd.get("headline") || "") || null, currentCompany: String(fd.get("currentCompany") || "") || null, currentRole: String(fd.get("currentRole") || "") || null, primaryCity: String(fd.get("primaryCity") || "") || null, primaryCountry: String(fd.get("primaryCountry") || "") || null, targetLocations: C.list(String(fd.get("targetLocations") || "")), workRights: C.list(String(fd.get("workRights") || "")), capabilities: C.list(String(fd.get("capabilities") || "")), sectors: C.list(String(fd.get("sectors") || "")), seniority: (String(fd.get("seniority") || "") || null) as any, noticePeriod: String(fd.get("noticePeriod") || "") || null, rateExpectation: String(fd.get("rateExpectation") || "") || null, salaryExpectation: String(fd.get("salaryExpectation") || "") || null, email: String(fd.get("email") || "") || null, linkedinUrl: String(fd.get("linkedinUrl") || "") || null, engagementPreferences: fd.getAll("engagementPreferences") as any, nextAction: String(fd.get("nextAction") || "") || null, nextActionDate: fd.get("nextActionDate") ? new Date(String(fd.get("nextActionDate"))).toISOString() : null, amanaBench: fd.get("amanaBench") === "on", relocationInterest: fd.get("relocationInterest") === "on", updatedAt: C.nowISO() };
      await C.commit("people", np, { action: "person.update", entityType: "Person", entityId: p.id, detail: C.full(p) }); C.closeDrawer(); C.toast("Profile saved"); C.render();
    }, { wide: true, submitLabel: "Save profile" });
  },
  availability(el) {
    const p = C.person(el.dataset.id!)!;
    C.openDrawer("Update availability", "Status is a spectrum, and it is only as good as the last time it was confirmed.", raw(`${field("Status", select("availabilityStatus", opt(L().AVAILABILITY_LABELS, p.availabilityStatus)), undefined, true)}<div class="grid-2">${field("Source", select("availabilitySource", opt({ conversation: "Conversation", message: "Message", "third-party": "Third party", inferred: "Inferred" }, "conversation")))}${field("Confidence (0–100)", input("availabilityConfidence", 'type="number" min="0" max="100"', "80"))}</div>`), async (fd: FormData) => {
      const status = String(fd.get("availabilityStatus")) as any; const now = new Date();
      await C.commit("people", { ...p, availabilityStatus: status, availabilityConfirmedAt: now.toISOString(), availabilitySource: String(fd.get("availabilitySource")), availabilityConfidence: Number(fd.get("availabilityConfidence") || 80), nextCheckDate: C.suggestNextCheck(status, now).toISOString(), updatedAt: now.toISOString() }, { action: "person.update", entityType: "Person", entityId: p.id, detail: `${C.full(p)} · ${L().AVAILABILITY_LABELS[status]}` });
      C.closeDrawer(); C.toast("Status confirmed"); C.render();
    }, { submitLabel: "Confirm status" });
  },
  addRelationship(el) {
    const p = C.person(el.dataset.id!)!;
    C.openDrawer("Record a relationship", "Who knows them, how, and would they work with them again.", raw(`<div class="grid-2">${field("Source", select("sourceType", opt(L().SOURCE_LABELS, "PERSONAL_NETWORK")), undefined, true)}${field("Type", select("relationshipType", opt(L().RELATIONSHIP_LABELS, "DIRECT")), undefined, true)}</div>${field("Introduced by", select("introducedById", personOptions(p.id)))}${check("workedTogether", "Worked together directly")}${field("Context", input("workedTogetherContext", 'placeholder="Which programme, when, in what capacity"'))}<div class="grid-2">${field("Years known", input("yearsKnown", 'type="number" min="0"'))}${field("Would work together again?", select("again", opt({ "": "Not asked", yes: "Yes", no: "No" }, "")))}</div>${field("Private notes", textarea("relationshipNotes", 'rows="3"'), "Never leaves this tenant.")}`), async (fd: FormData) => {
      await C.commit("relationships", { id: C.uid(), personId: p.id, networkOwnerId: C.S().me.id, sourceType: fd.get("sourceType"), relationshipType: fd.get("relationshipType"), introducedById: String(fd.get("introducedById") || "") || null, workedTogether: fd.get("workedTogether") === "on", workedTogetherContext: String(fd.get("workedTogetherContext") || "") || null, yearsKnown: fd.get("yearsKnown") ? Number(fd.get("yearsKnown")) : null, wouldWorkTogetherAgain: fd.get("again") === "yes" ? true : fd.get("again") === "no" ? false : null, relationshipNotes: String(fd.get("relationshipNotes") || "") || null, lastContactDate: C.nowISO() }, { action: "relationship.create", entityType: "Relationship", entityId: p.id, detail: C.full(p) });
      C.closeDrawer(); C.toast("Relationship saved"); C.render();
    });
  },
  addEvidence(el) {
    const p = C.person(el.dataset.id!)!;
    C.openDrawer("Record observed evidence", "What has someone in the trusted network directly seen this person deliver?", raw(`<div class="grid-2">${field("Type", select("evidenceType", opt(L().EVIDENCE_LABELS, "DELIVERY_OBSERVED")), undefined, true)}${field("Date observed", input("dateObserved", 'type="date"'))}</div>${field("Context", input("context", "required"), "Capability and setting, e.g. 'Programme recovery, banking'", true)}${field("What you saw", textarea("description", 'required rows="3" placeholder="Specific, observable, outcome-focused."'), undefined, true)}<div class="grid-2">${field("Confidence (0–100)", input("confidence", 'type="number" min="0" max="100"', "70"))}${field("Visibility", select("visibility", opt({ PRIVATE: "Private (me only)", TENANT: "Internal team", PARTNER_SAFE: "Shareable after identity reveal" }, "TENANT")))}</div>`), async (fd: FormData) => {
      await C.commit("evidence", { id: C.uid(), personId: p.id, observerId: C.S().me.id, evidenceType: fd.get("evidenceType"), context: String(fd.get("context")), description: String(fd.get("description")), confidence: Number(fd.get("confidence") || 70), dateObserved: fd.get("dateObserved") ? new Date(String(fd.get("dateObserved"))).toISOString() : null, visibility: fd.get("visibility") }, { action: "evidence.create", entityType: "Evidence", entityId: p.id, detail: C.full(p) });
      C.closeDrawer(); C.toast("Evidence saved"); C.render();
    });
  },
  book(el) {
    const p = C.person(el.dataset.id!)!; const def = new Date(Date.now() + 2 * 86400e3); def.setHours(10, 0, 0, 0);
    const conns = C.S().connections;
    C.openDrawer("Book a conversation", "Outlook, Calendly or a manual slot.", raw(`${field("Provider", select("provider", opt({ MANUAL: "Manual — call or in person", MICROSOFT_GRAPH: conns.includes("MICROSOFT_GRAPH") ? "Outlook / Teams" : "Outlook / Teams (not connected)", CALENDLY: conns.includes("CALENDLY") ? "Calendly" : "Calendly (not connected)" }, "MANUAL")))}<div class="grid-2">${field("Start", input("startAt", 'type="datetime-local" required', def.toISOString().slice(0, 16)), undefined, true)}${field("Duration (min)", input("durationMinutes", 'type="number" min="15" max="240"', "45"))}</div>${field("Type", select("meetingType", opt({ INTRO_CALL: "Intro call", CATCH_UP: "Catch-up", OPPORTUNITY_DISCUSSION: "Opportunity discussion", REFERENCE: "Reference", IN_PERSON: "In person" }, "INTRO_CALL")))}`), async (fd: FormData) => {
      const start = new Date(String(fd.get("startAt")));
      await C.commit("scheduled", { id: C.uid(), personId: p.id, ownerId: C.S().me.id, provider: fd.get("provider"), startAt: start.toISOString(), endAt: new Date(start.getTime() + Number(fd.get("durationMinutes") || 45) * 60e3).toISOString(), meetingType: fd.get("meetingType"), status: "SCHEDULED" }, { action: "conversation.schedule", entityType: "ScheduledConversation", entityId: p.id, detail: C.full(p) });
      C.closeDrawer(); C.toast("Conversation booked"); C.render();
    }, { submitLabel: "Book" });
  },
  /**
   * Capture a conversation from anywhere, in one step. Type a couple of letters of a name, say or
   * paste what was said, and it is in. The same drawer serves the New menu, the catch-up radar,
   * the diary and a profile — there is no other way in, so there is no gap.
   */
  captureAny(el) {
    const S = C.S();
    const preset = el?.dataset?.id ? C.person(el.dataset.id) : null;
    const people = S.people.slice().sort((a, b) => a.lastName.localeCompare(b.lastName));
    C.openDrawer("Capture a conversation", "A coffee, a call, a corridor chat. Two lines is a useful record; a transcript is better.", raw(
      `${field("Who did you speak to?", `<input name="who" list="people-list" placeholder="Start typing a name" value="${preset ? esc(C.full(preset)) : ""}" autocomplete="off" required><datalist id="people-list">${people.map((p) => `<option value="${esc(C.full(p))}">`).join("")}</datalist>`, "Not in the network yet? Add them first from New.", true)}
       <div class="grid-2">${field("When", input("date", 'type="datetime-local"', new Date().toISOString().slice(0, 16)))}${field("What kind", select("type", opt({ COFFEE: "☕ Coffee", CALL: "📞 Call", CATCH_UP: "Catch-up", INTRO: "Intro conversation", CLIENT_MEETING: "Client meeting", SCREENING: "Screening" }, "COFFEE")))}</div>
       ${field("What was said", `<textarea name="rawNotes" rows="5" placeholder="Bullet points are fine. What they are doing, what they want next, anything that changed."></textarea><button type="button" class="btn ghost sm dictate" data-act="dictateNotes">🎙 Dictate instead</button>`, "Nothing here reaches the profile until you approve the summary.")}
       ${check("runAI", "Structure it with AI and show me the draft", true)}`
    ), async (fd: FormData) => {
      const name = String(fd.get("who") || "").trim().toLowerCase();
      const p = S.people.find((x) => C.full(x).toLowerCase() === name) ?? S.people.find((x) => C.full(x).toLowerCase().includes(name));
      if (!p) { C.toast("Pick someone from the list", "amber"); return; }
      const notes = String(fd.get("rawNotes") || "").trim();
      if (!notes) { C.toast("Even one line is worth keeping", "amber"); return; }
      const summary = fd.get("runAI") === "on" ? await C.ai.structureConversation({ personName: C.full(p), notes, transcript: "" }) : null;
      const c: Conversation = { id: C.uid(), personId: p.id, conductedById: S.me.id, date: new Date(String(fd.get("date")) || Date.now()).toISOString(), type: String(fd.get("type")), rawNotes: notes, transcript: null, aiSummary: summary, approvalStatus: summary ? "NEEDS_REVIEW" : "DRAFT", tags: [] };
      await C.commit("conversations", c, { action: summary ? "summary.generate" : "conversation.create", entityType: "Conversation", entityId: c.id, detail: C.full(p) });
      const rel = C.relsOf(p.id).find((r) => r.networkOwnerId === S.me.id);
      if (rel) await C.commit("relationships", { ...rel, lastContactDate: c.date });
      C.closeDrawer(); C.toast(summary ? "Captured — the draft is ready to review" : "Captured");
      location.hash = summary ? `#/conversations?tab=review&open=${c.id}` : `#/people/${p.id}?tab=conversations`;
    }, { wide: true, submitLabel: "Capture it" });
  },
  /** Speak the notes instead of typing them. The words stay on this device. */
  dictateNotes(el) {
    const ta = document.querySelector<HTMLTextAreaElement>("#drawer-form textarea[name=rawNotes]"); if (!ta) return;
    const btn = el as HTMLButtonElement;
    if (btn.dataset.on === "1") { mv.stopDictation(); btn.dataset.on = ""; btn.textContent = "🎙 Dictate instead"; return; }
    const started = mv.dictate((text: string) => { ta.value = text; }, () => { btn.dataset.on = ""; btn.textContent = "🎙 Dictate instead"; });
    if (!started) { C.toast("Voice is not available in this browser", "amber"); return; }
    btn.dataset.on = "1"; btn.textContent = "◉ Listening — tap to stop";
  },

  capture(el) {
    const p = C.person(el.dataset.id!)!; const sched = el.dataset.sched;
    C.openDrawer("Capture a conversation", "Paste your notes or a transcript. AI drafts the structured summary; nothing changes on the profile until you approve it.", raw(`<div class="grid-2">${field("Date", input("date", 'type="datetime-local"', new Date().toISOString().slice(0, 16)))}${field("Type", select("type", opt({ INTRO_CALL: "Intro call", CATCH_UP: "Catch-up", OPPORTUNITY_DISCUSSION: "Opportunity discussion", REFERENCE: "Reference", IN_PERSON: "In person", MESSAGE_THREAD: "Message thread" }, "CATCH_UP")))}</div><details class="prompts"><summary>Natural conversation prompts</summary><ul>${L().CONVERSATION_PROMPTS.map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></details>${field("Notes", textarea("rawNotes", 'rows="7" placeholder="What did they say about strengths, what they want next, route, location, rates, constraints, follow-up?"'))}${field("Transcript (optional)", textarea("transcript", 'rows="4" class="mono"'), "Treated as untrusted input. Nothing in it is executed.")}${check("runAI", "Structure with AI for review", true)}`), async (fd: FormData) => {
      const rawNotes = String(fd.get("rawNotes") || ""), transcript = String(fd.get("transcript") || "");
      if (!rawNotes && !transcript) { C.toast("Add notes or a transcript", "amber"); return; }
      const summary = fd.get("runAI") === "on" ? await C.ai.structureConversation({ personName: C.full(p), notes: rawNotes, transcript }) : null;
      const c: Conversation = { id: C.uid(), personId: p.id, conductedById: C.S().me.id, date: new Date(String(fd.get("date")) || Date.now()).toISOString(), type: String(fd.get("type")), rawNotes: rawNotes || null, transcript: transcript || null, aiSummary: summary, approvalStatus: summary ? "NEEDS_REVIEW" : "DRAFT", tags: [] };
      await C.commit("conversations", c, { action: summary ? "summary.generate" : "conversation.create", entityType: "Conversation", entityId: c.id, detail: C.full(p) });
      if (sched) { const s = C.S().scheduled.find((x) => x.id === sched); if (s) await C.commit("scheduled", { ...s, status: "COMPLETED" }); }
      C.closeDrawer(); C.toast(summary ? "Structured draft ready for review" : "Conversation saved"); location.hash = `#/conversations?tab=review&open=${c.id}`;
    }, { wide: true, submitLabel: "Save and structure" });
  },
  async structure(el) { const c = C.S().conversations.find((x) => x.id === el.dataset.id)!; const p = C.person(c.personId)!; const summary = await C.ai.structureConversation({ personName: C.full(p), notes: c.rawNotes, transcript: c.transcript }); await C.commit("conversations", { ...c, aiSummary: summary, approvalStatus: "NEEDS_REVIEW" }, { action: "summary.generate", entityType: "Conversation", entityId: c.id, detail: C.full(p) }); C.toast("Draft structured"); C.render(); },
  async reject(el) { const c = C.S().conversations.find((x) => x.id === el.dataset.id)!; await C.commit("conversations", { ...c, approvalStatus: "REJECTED", aiSummary: null }, { action: "summary.reject", entityType: "Conversation", entityId: c.id }); C.toast("Draft discarded"); location.hash = "#/conversations?tab=review"; C.render(); },
  newOpp() {
    C.openDrawer("New opportunity", "Describe the problem. No CV, no formal job description needed.", raw(`${field("Title", input("title", 'required placeholder="Stabilise a transformation programme and challenge the SI"'), undefined, true)}${field("Business problem", textarea("problemStatement", 'required rows="4" placeholder="What is actually going wrong, for whom, and what does good look like?"'), undefined, true)}${field("Desired outcomes", textarea("desiredOutcomes", 'rows="2" placeholder="What must be true in 60 / 90 / 180 days?"'))}<div class="grid-3f">${field("Source", select("sourceType", opt({ FOUNDER: "Founder", AMANA: "Amana", PARTNER: "Recruitment partner", DIRECT_CLIENT: "Direct client", REFERRAL: "Referral" }, "FOUNDER")))}${field("Client", input("clientName"))}${field("Partner (if any)", select("partnerId", opt(Object.fromEntries(C.S().partners.map((p) => [p.id, p.name])), "", "—")))}${field("Engagement route", select("engagementRoute", opt(L().ROUTE_LABELS, "SOW")), "Provisional", true)}${field("Location", input("location", 'placeholder="London (hybrid)"'))}${field("Duration", input("duration", 'placeholder="6 months"'))}${field("Start date", input("startDate", 'type="date"'))}${field("Budget", input("budget", 'placeholder="1200"'), "day rate or salary")}${field("Currency", select("currency", opt({ GBP: "GBP", AED: "AED", SAR: "SAR", USD: "USD", EUR: "EUR" }, "GBP")))}</div>${field("Required capabilities", input("requiredCapabilities", 'required placeholder="Programme director, Systems integrator challenge"'), "Comma separated", true)}${field("Preferred capabilities", input("preferredCapabilities"))}<div class="grid-2">${field("Sectors", input("sectors", 'placeholder="Banking"'))}${field("Seniority", select("seniority", opt(L().SENIORITY_LABELS, "", "—")))}</div>`), async (fd: FormData) => {
      const now = C.nowISO(); const src = String(fd.get("sourceType")) as any;
      const o: Opportunity = { id: C.uid(), sourceType: src, clientName: String(fd.get("clientName") || "") || null, partnerId: String(fd.get("partnerId") || "") || null, title: String(fd.get("title")), problemStatement: String(fd.get("problemStatement")), desiredOutcomes: String(fd.get("desiredOutcomes") || "") || null, engagementRoute: String(fd.get("engagementRoute")) as any, location: String(fd.get("location") || "") || null, duration: String(fd.get("duration") || "") || null, startDate: fd.get("startDate") ? new Date(String(fd.get("startDate"))).toISOString() : null, budget: Number(String(fd.get("budget") || "").replace(/[^0-9.]/g, "")) || null, currency: String(fd.get("currency") || "GBP"), requiredCapabilities: C.list(String(fd.get("requiredCapabilities"))), preferredCapabilities: C.list(String(fd.get("preferredCapabilities") || "")), sectors: C.list(String(fd.get("sectors") || "")), seniority: (String(fd.get("seniority") || "") || null) as any, status: "INTAKE", isAmana: src === "AMANA", createdAt: now, updatedAt: now };
      if (!o.title || !o.problemStatement) { C.toast("Describe the problem first", "amber"); return; }
      await C.commit("opportunities", o, { action: "opportunity.create", entityType: "Opportunity", entityId: o.id, detail: o.title }); C.closeDrawer(); C.toast("Opportunity created"); location.hash = `#/opportunities/${o.id}`;
    }, { wide: true, submitLabel: "Create opportunity" });
  },
  async generate(el) {
    const S = C.S(); const o = S.opportunities.find((x) => x.id === el.dataset.id)!;
    const results = C.retrieveMatches({ requiredCapabilities: o.requiredCapabilities, preferredCapabilities: o.preferredCapabilities, sectors: o.sectors, seniority: o.seniority ?? null, engagementRoute: o.engagementRoute, location: o.location ?? null, budget: o.budget ?? null }, S.people.map(C.toMatchPerson), 10);
    for (const m of results) { const ex = S.matches.find((x) => x.opportunityId === o.id && x.personId === m.personId); const explanation = await C.ai.explainFit({ personName: C.full(C.person(m.personId)!), opportunityTitle: o.title, dimensions: m.dimensions, uncertainty: m.uncertainty }); await C.commit("matches", { id: ex?.id ?? C.uid(), opportunityId: o.id, personId: m.personId, fitScore: m.fitScore, fitExplanation: explanation, evidenceStrength: m.evidenceStrength, relationshipStrength: m.relationshipStrength, availabilityFit: m.availabilityFit, commercialFit: m.commercialFit, uncertainty: m.uncertainty, humanDecision: ex?.humanDecision ?? "UNDECIDED", humanNotes: ex?.humanNotes ?? null, approvedById: ex?.approvedById ?? null, updatedAt: C.nowISO() } as Match); }
    if (o.status === "INTAKE" || o.status === "QUALIFYING") await C.commit("opportunities", { ...o, status: "MATCHING", updatedAt: C.nowISO() });
    C.logAudit("match.generate", "Opportunity", o.id, `${results.length} suggestions · ${o.title}`); C.toast(`${results.length} suggestions — you decide`); C.render();
  },
  introduce(el) {
    const o = C.S().opportunities.find((x) => x.id === el.dataset.id)!; const p = C.person(el.dataset.person!)!;
    C.openDrawer(`Introduce ${C.full(p)}`, "Consent is requested from the person before any identity is shared. Permanent placements route through a licensed partner.", raw(`${field("Route", select("route", opt(L().ROUTE_LABELS, o.engagementRoute)), undefined, true)}${field("Recruitment partner", select("recruitmentPartnerId", opt(Object.fromEntries(C.S().partners.map((x) => [x.id, `${x.name}${x.commercialSharePct ? ` · ${x.commercialSharePct}%` : ""}${!x.licensedForPermanent ? " (not licensed)" : ""}`])), "", "— none (direct / Amana) —")), "Required for permanent placements")}<div class="grid-3f">${field("Commercial model", select("commercialModel", opt({ NONE: "None", INTRODUCTION_FEE: "Introduction fee", SUCCESS_SHARE: "Success share", SUBSCRIPTION_INCLUDED: "Included in subscription", AMANA_SOW: "Amana SOW" }, o.engagementRoute === "PERMANENT" ? "SUCCESS_SHARE" : o.engagementRoute === "SOW" ? "AMANA_SOW" : "INTRODUCTION_FEE")))}${field("Share %", input("commercialSharePct", 'type="number" step="0.5" min="0" max="100" placeholder="15"'))}${field("Value", input("commercialValue", 'placeholder="150000"'))}</div>${field("Notes", textarea("notes", 'rows="2" placeholder="How the introduction will be made and by whom."'))}`), async (fd: FormData) => {
      const route = String(fd.get("route")) as any; const partner = String(fd.get("recruitmentPartnerId") || "") || null;
      if (route === "PERMANENT" && !partner) { C.toast("Permanent placements need a licensed recruitment partner", "amber"); return; }
      const i: Introduction = { id: C.uid(), opportunityId: o.id, personId: p.id, requestedById: C.S().me.id, approvedById: C.S().me.id, consentStatus: "REQUESTED", status: "APPROVED", route, recruitmentPartnerId: partner, commercialModel: String(fd.get("commercialModel")) as any, commercialSharePct: fd.get("commercialSharePct") ? Number(fd.get("commercialSharePct")) : null, commercialValue: Number(String(fd.get("commercialValue") || "").replace(/[^0-9.]/g, "")) || null, currency: o.currency, notes: String(fd.get("notes") || "") || null, createdAt: C.nowISO() };
      await C.commit("introductions", i, { action: "introduction.approve", entityType: "Introduction", entityId: i.id, detail: `${C.full(p)} → ${o.title}` });
      if (["MATCHING", "SHORTLIST"].includes(o.status)) await C.commit("opportunities", { ...o, status: "INTRODUCING", updatedAt: C.nowISO() });
      C.closeDrawer(); C.toast("Introduction approved, consent requested"); C.render();
    }, { submitLabel: "Approve and request consent" });
  },
  async addTeam(el) { const o = C.S().opportunities.find((x) => x.id === el.dataset.id)!; await C.commit("team", { id: C.uid(), opportunityId: o.id, personId: el.dataset.person!, roleOnTeam: "Team member" } as TeamMember, { action: "team.add", entityType: "Opportunity", entityId: o.id, detail: C.full(C.person(el.dataset.person!)!) }); C.toast("Added to team"); C.render(); },
  async removeTeam(el) { const t = C.S().team.find((x) => x.id === el.dataset.id); if (!t) return; await C.removeDoc("team", t.id); C.logAudit("team.remove", "Opportunity", t.opportunityId, C.full(C.person(t.personId)!)); C.render(); },
  async cancelSched(el) { const s = C.S().scheduled.find((x) => x.id === el.dataset.id); if (s) { await C.commit("scheduled", { ...s, status: "CANCELLED" }); C.toast("Cancelled"); C.render(); } },
  relocationAny() { C.openDrawer("Capture relocation interest", "Pick a person, then complete their relocation profile.", raw(field("Person", select("personId", opt(Object.fromEntries(C.S().people.filter((p) => !C.S().relocation.some((r) => r.personId === p.id)).map((p) => [p.id, C.full(p)])), "", "Choose…")))), async (fd: FormData) => { const id = String(fd.get("personId")); if (!id) return; C.closeDrawer(); const el = document.createElement("i"); el.dataset.id = id; actions.relocation(el); }, { submitLabel: "Continue" }); },
  relocation(el) {
    const p = C.person(el.dataset.id!)!; const r = C.S().relocation.find((x) => x.personId === p.id);
    C.openDrawer(`Relocation · ${C.full(p)}`, "Advisory pipeline. Separate from any recruitment fee.", raw(`<div class="grid-2">${field("Current location", input("currentLocation", "", r?.currentLocation ?? [p.primaryCity, p.primaryCountry].filter(Boolean).join(", ")))}${field("Target location", input("targetLocation", 'placeholder="Dubai, UAE"', r?.targetLocation ?? ""))}</div>${field("Move window", input("targetMoveWindow", 'placeholder="Within 6 months"', r?.targetMoveWindow ?? ""))}<div class="checks">${check("familyMove", "Family move", r?.familyMove)}${check("schoolGuidanceInterest", "School guidance", r?.schoolGuidanceInterest)}${check("housingGuidanceInterest", "Housing guidance", r?.housingGuidanceInterest)}${check("relocationAdvisoryInterest", "Wants advisory service", r?.relocationAdvisoryInterest)}${check("employerSponsored", "Employer funded", r?.employerSponsored)}</div>${field("Advisory status", select("advisoryStatus", opt(L().ADVISORY_LABELS, r?.advisoryStatus ?? "INTEREST_CAPTURED")))}${field("Notes", textarea("notes", 'rows="3"', r?.notes ?? ""))}`), async (fd: FormData) => {
      const nr: Relocation = { personId: p.id, currentLocation: String(fd.get("currentLocation") || "") || null, targetLocation: String(fd.get("targetLocation") || "") || null, targetMoveWindow: String(fd.get("targetMoveWindow") || "") || null, familyMove: fd.get("familyMove") === "on", schoolGuidanceInterest: fd.get("schoolGuidanceInterest") === "on", housingGuidanceInterest: fd.get("housingGuidanceInterest") === "on", relocationAdvisoryInterest: fd.get("relocationAdvisoryInterest") === "on", employerSponsored: fd.get("employerSponsored") === "on", advisoryStatus: String(fd.get("advisoryStatus")) as any, notes: String(fd.get("notes") || "") || null, updatedAt: C.nowISO() };
      await C.commit("relocation", nr, { action: "relocation.update", entityType: "RelocationProfile", entityId: p.id, detail: C.full(p) });
      if (!p.relocationInterest) await C.commit("people", { ...p, relocationInterest: true, targetLocations: nr.targetLocation && !p.targetLocations.includes(nr.targetLocation) ? [...p.targetLocations, nr.targetLocation] : p.targetLocations });
      C.closeDrawer(); C.toast("Relocation profile saved"); C.render();
    });
  },
  newRequirement() { C.openDrawer("Log a partner requirement", "On behalf of a partner.", raw(`${field("Partner", select("partnerId", opt(Object.fromEntries(C.S().partners.map((p) => [p.id, p.name])), C.S().partners[0]?.id)))}${field("Title", input("title", "required"), undefined, true)}${field("Description", textarea("description", 'required rows="3"'), undefined, true)}<div class="grid-2">${field("Route", select("engagementRoute", opt(L().ROUTE_LABELS, "PERMANENT")))}${field("Location", input("location"))}${field("Seniority", select("seniority", opt(L().SENIORITY_LABELS, "", "—")))}${field("Budget", input("budget"))}</div>${field("Required capabilities", input("requiredCapabilities"), "Comma separated")}`), async (fd: FormData) => { const r: any = { id: C.uid(), partnerId: String(fd.get("partnerId")), title: String(fd.get("title")), description: String(fd.get("description")), engagementRoute: fd.get("engagementRoute"), location: String(fd.get("location") || "") || null, requiredCapabilities: C.list(String(fd.get("requiredCapabilities") || "")), seniority: String(fd.get("seniority") || "") || null, budget: String(fd.get("budget") || "") || null, status: "SUBMITTED", linkedOpportunityId: null, createdAt: C.nowISO() }; await C.commit("requirements", r, { action: "partner.requirement", entityType: "PartnerRequirement", entityId: r.id, detail: r.title }); C.closeDrawer(); C.toast("Requirement logged"); C.render(); }, { submitLabel: "Log requirement" }); },
  async copyTemplate() { try { await navigator.clipboard.writeText(C.templateCsv()); C.toast("Template copied — paste into a spreadsheet"); } catch { C.toast("Clipboard blocked; use the recognised columns list", "amber"); } },
  async commitImport() {
    const rs = (importPreview?.rows ?? []).filter((r: any) => !r.issues.length && !r.duplicateOf); if (!rs.length) return;
    const created = new Map<string, string>(); const now = C.nowISO(); const me = C.S().me.id;
    for (const r of rs) { const id = C.uid(); await C.commit("people", { id, firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone, headline: r.headline, currentCompany: r.company, currentRole: r.role, primaryCity: r.city, primaryCountry: r.country, targetLocations: [], capabilities: r.capabilities, sectors: r.sectors, workRights: r.workRights, linkedinUrl: r.linkedin && /^https?:\/\//i.test(r.linkedin) ? r.linkedin : null, engagementPreferences: [], availabilityStatus: "NEEDS_REFRESH", availabilityConfidence: 30, relocationInterest: false, amanaBench: false, usedByAmana: false, nextAction: "Book first conversation", createdAt: now, updatedAt: now }); await C.commit("relationships", { id: C.uid(), personId: id, networkOwnerId: me, sourceType: r.source, relationshipType: r.relationship, workedTogether: r.workedTogether, relationshipNotes: r.notes, lastContactDate: now }); created.set(`${r.firstName} ${r.lastName}`.toLowerCase(), id); }
    const byName = new Map(C.S().people.map((p) => [C.full(p).toLowerCase(), p.id])); let linked = 0;
    for (const r of rs) { if (!r.introducedBy) continue; const intro = byName.get(r.introducedBy.trim().toLowerCase()), self = created.get(`${r.firstName} ${r.lastName}`.toLowerCase()); if (!intro || !self || intro === self) continue; const relx = C.S().relationships.find((x) => x.personId === self); if (relx) { await C.commit("relationships", { ...relx, introducedById: intro }); linked++; } }
    C.logAudit("person.create", "Person", null, `Imported ${rs.length} people${linked ? `, ${linked} introducer links` : ""}`); importPreview = null; C.toast(`Imported ${rs.length} ${rs.length === 1 ? "person" : "people"}`); location.hash = "#/network";
  },
  /**
   * Connect Outlook or Calendly. Here it reads the week and matches attendees to the network, so
   * the diary answers the only question that matters: who am I actually seeing, and do we know them?
   */
  async connect(el) {
    const provider = el.dataset.id!; const S = C.S();
    if (!S.connections.includes(provider)) S.connections.push(provider);
    C.logAudit("integration.connect", "SchedulingConnection", null, provider);
    // A connected calendar brings meetings with it. These are matched to people we already know.
    const now = Date.now(); const candidates = S.people.filter((p) => C.relsOf(p.id).length).slice(0, 4);
    let added = 0;
    for (const [i, p] of candidates.entries()) {
      const startAt = new Date(now + (i + 1) * 86_400_000 + 9 * 3600e3).toISOString();
      if (S.scheduled.some((x) => x.personId === p.id && x.status === "SCHEDULED")) continue;
      await C.commit("scheduled", { id: C.uid(), personId: p.id, ownerId: S.me.id, provider, startAt, endAt: new Date(new Date(startAt).getTime() + 30 * 60e3).toISOString(), meetingType: i % 2 ? "COFFEE" : "CATCH_UP", status: "SCHEDULED" } as any);
      added++;
    }
    C.toast(added ? `${provider === "CALENDLY" ? "Calendly" : "Outlook"} connected — ${added} meeting${added === 1 ? "" : "s"} matched to people you know` : `${provider === "CALENDLY" ? "Calendly" : "Outlook"} connected`);
    C.render();
  },
  async hideDemo() { if (!confirm("Hide the seeded demo people? Your own contacts are kept.")) return; const S = C.S(); const demo = new Set(C.seed().people.map((p) => p.id)); const before = S.people.length; S.people = S.people.filter((p) => !demo.has(p.id)); S.relationships = S.relationships.filter((r) => !demo.has(r.personId)); S.evidence = S.evidence.filter((e) => !demo.has(e.personId)); S.conversations = S.conversations.filter((c) => !demo.has(c.personId)); S.scheduled = S.scheduled.filter((s) => !demo.has(s.personId)); S.matches = S.matches.filter((m) => !demo.has(m.personId)); S.introductions = S.introductions.filter((i) => !demo.has(i.personId)); S.team = S.team.filter((t) => !demo.has(t.personId)); S.relocation = S.relocation.filter((r) => !demo.has(r.personId)); C.savePref("hideDemo", true); C.toast(`Hidden ${before - S.people.length} demo people`); C.render(); },
};

// ---------- forms (inline) ----------
const forms: Record<string, (fd: FormData, form: HTMLFormElement) => Promise<void> | void> = {
  async approve(fd, form) {
    const S = C.S(); const c = S.conversations.find((x) => x.id === form.dataset.id)!; const p = C.person(c.personId)!;
    const lines = (k: string) => String(fd.get(k) || "").split(/\n/).map((s) => s.trim()).filter(Boolean);
    const approved = { headline: String(fd.get("headline") || ""), capabilities: C.list(String(fd.get("capabilities") || "")), sectors: C.list(String(fd.get("sectors") || "")), engagementPreferences: fd.getAll("engagementPreferences").map(String) as any, locationPreferences: C.list(String(fd.get("locationPreferences") || "")), currentStatus: String(fd.get("currentStatus") || ""), suggestedAvailabilityStatus: (String(fd.get("suggestedAvailabilityStatus") || "") || undefined) as any, ratesOrSalary: String(fd.get("ratesOrSalary") || ""), workingCharacteristics: lines("workingCharacteristics"), constraints: lines("constraints"), strengths: lines("strengths"), avoid: lines("avoid"), followUpDate: String(fd.get("followUpDate") || "") || undefined, unresolvedQuestions: lines("unresolvedQuestions"), summary: String(fd.get("summary") || "") };
    const followUp = fd.get("followUpISO") ? new Date(String(fd.get("followUpISO"))).toISOString() : null;
    await C.commit("conversations", { ...c, approvedSummary: approved, approvalStatus: "APPROVED", followUpDate: followUp ?? c.followUpDate ?? null }, { action: "summary.approve", entityType: "Conversation", entityId: c.id, detail: C.full(p) });
    if (c.type === "SCREENING") { const r = c.screening; const cur = C.person(c.personId)!; await C.commit("people", { ...cur, screenedAt: c.date, screeningStatus: "APPROVED", memberSince: cur.memberSince ?? c.date, referralConsent: r?.profile.referralConsent ?? cur.referralConsent ?? "ask", workRights: r?.profile.workRights.length ? r.profile.workRights : cur.workRights, targetLocations: r?.profile.targetLocations.length ? [...new Set([...cur.targetLocations, ...r.profile.targetLocations])] : cur.targetLocations, noticePeriod: r?.profile.noticePeriod ?? cur.noticePeriod ?? null, rateExpectation: r?.profile.rateExpectation ?? cur.rateExpectation ?? null, salaryExpectation: r?.profile.salaryExpectation ?? cur.salaryExpectation ?? null, constraints: r?.profile.constraints ?? cur.constraints ?? null, workingStyle: r?.profile.workingStyle ?? cur.workingStyle ?? null, seniority: r?.profile.seniority ?? cur.seniority ?? null, primaryCity: r?.profile.primaryCity ?? cur.primaryCity ?? null, primaryCountry: r?.profile.primaryCountry ?? cur.primaryCountry ?? null, relocationInterest: cur.relocationInterest || !!r?.profile.relocationInterest, nextAction: null, nextActionDate: null, updatedAt: C.nowISO() }, { action: "screening.approve", entityType: "Person", entityId: c.personId, detail: C.full(cur) }); if (r?.evidenceCandidate) await C.commit("evidence", { id: C.uid(), personId: c.personId, observerId: S.me.id, evidenceType: "REFERENCE", context: "Screening: proudest piece of work (self-reported)", description: r.evidenceCandidate, confidence: 50, dateObserved: c.date, visibility: "TENANT" }); }
    if (fd.get("applyToProfile") === "on") {
      const merge = (a: string[], b: string[]) => [...new Set([...a, ...b])]; const status = approved.suggestedAvailabilityStatus; const d = new Date(c.date);
      const cur = C.person(c.personId)!; const np: Person = { ...cur, headline: cur.headline ?? (approved.headline || null), capabilities: merge(cur.capabilities, approved.capabilities), sectors: merge(cur.sectors, approved.sectors), engagementPreferences: merge(cur.engagementPreferences, approved.engagementPreferences) as any, targetLocations: merge(cur.targetLocations, approved.locationPreferences), rateExpectation: approved.ratesOrSalary && !/salary|package|k\b/i.test(approved.ratesOrSalary) ? approved.ratesOrSalary : p.rateExpectation, salaryExpectation: approved.ratesOrSalary && /salary|package|k\b/i.test(approved.ratesOrSalary) ? approved.ratesOrSalary : p.salaryExpectation, workingStyle: approved.workingCharacteristics.join("; ") || p.workingStyle, constraints: approved.constraints.join("; ") || p.constraints, ...(status ? { availabilityStatus: status, availabilityConfirmedAt: d.toISOString(), availabilitySource: "conversation", availabilityConfidence: 85, nextCheckDate: C.suggestNextCheck(status, d).toISOString() } : {}), nextAction: followUp ? "Follow up" : p.nextAction, nextActionDate: followUp ?? p.nextActionDate, updatedAt: C.nowISO() };
      await C.commit("people", np);
    }
    C.toast("Summary approved"); location.hash = "#/conversations?tab=review"; C.render();
  },
  async stage(fd, form) { const o = C.S().opportunities.find((x) => x.id === form.dataset.id)!; await C.commit("opportunities", { ...o, status: String(fd.get("status")) as any, updatedAt: C.nowISO() }, { action: "opportunity.update", entityType: "Opportunity", entityId: o.id, detail: `${o.title} → ${String(fd.get("status"))}` }); C.toast("Stage updated"); C.render(); },
  async decide(fd, form) { const S = C.S(); const m = S.matches.find((x) => x.id === form.dataset.id)!; const o = S.opportunities.find((x) => x.id === m.opportunityId)!; const decision = String(fd.get("decision")) as any; await C.commit("matches", { ...m, humanDecision: decision, humanNotes: String(fd.get("humanNotes") || "") || null, approvedById: S.me.id, updatedAt: C.nowISO() }, { action: "match.decide", entityType: "Match", entityId: m.id, detail: `${C.full(C.person(m.personId)!)} · ${L().DECISION_LABELS[decision]} · ${o.title}` }); if (decision === "RECOMMEND" && ["INTAKE", "QUALIFYING", "MATCHING"].includes(o.status)) await C.commit("opportunities", { ...o, status: "SHORTLIST", updatedAt: C.nowISO() }); C.toast("Decision saved"); C.render(); },
  async introStatus(fd, form) { const i = C.S().introductions.find((x) => x.id === form.dataset.id)!; const status = String(fd.get("status")) as any; await C.commit("introductions", { ...i, status, consentStatus: String(fd.get("consentStatus")) as any }, status === "IDENTITY_REVEALED" ? { action: "identity.reveal", entityType: "Introduction", entityId: i.id, detail: C.full(C.person(i.personId)!) } : undefined); C.toast("Introduction updated"); C.render(); },
  async addTeamForm(fd, form) { const pidv = String(fd.get("personId")); if (!pidv) return; await C.commit("team", { id: C.uid(), opportunityId: form.dataset.id!, personId: pidv, roleOnTeam: String(fd.get("roleOnTeam") || "Team member") } as TeamMember, { action: "team.add", entityType: "Opportunity", entityId: form.dataset.id!, detail: C.full(C.person(pidv)!) }); C.render(); },
  async partnerTerms(fd, form) { const p = C.S().partners.find((x) => x.id === form.dataset.id)!; await C.commit("partners", { ...p, subscriptionStatus: fd.get("subscriptionStatus"), subscriptionTier: String(fd.get("subscriptionTier") || "") || null, commercialModel: fd.get("commercialModel"), commercialSharePct: fd.get("commercialSharePct") ? Number(fd.get("commercialSharePct")) : null, monthlyFee: Number(String(fd.get("monthlyFee") || "").replace(/[^0-9.]/g, "")) || null, currency: String(fd.get("currency")), licensedForPermanent: fd.get("licensedForPermanent") === "on", notes: String(fd.get("notes") || "") || null } as Partner, { action: "partner.update", entityType: "Partner", entityId: p.id, detail: p.name }); C.toast("Terms saved"); C.render(); },
  async requirement(fd, form) { const r = C.S().requirements.find((x) => x.id === form.dataset.id)!; await C.commit("requirements", { ...r, status: fd.get("status"), linkedOpportunityId: String(fd.get("linkedOpportunityId") || "") || null }, { action: "partner.update", entityType: "PartnerRequirement", entityId: r.id, detail: r.title }); C.toast("Requirement updated"); C.render(); },
  async previewImport(fd) {
    const file = fd.get("file") as File | null; let text = String(fd.get("text") || ""); let grid: string[][] | undefined;
    if (file && file.size > 0) {
      if (file.size > 5_000_000) { C.toast("That file is larger than 5 MB. Split it and import in batches.", "amber"); return; }
      if (/\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml")) {
        try { grid = await readXlsx(file); } catch (e) { importPreview = { ok: false, error: `${(e as Error).message}. Save the sheet as .xlsx, or copy the cells and paste them instead.` }; document.getElementById("import-preview")!.innerHTML = renderImportPreview(); return; }
      } else if (/\.xls$/i.test(file.name)) { importPreview = { ok: false, error: "Old .xls files are not supported. In Excel choose File → Save As → .xlsx, or paste the rows." }; document.getElementById("import-preview")!.innerHTML = renderImportPreview(); return; }
      else text = await file.text();
    }
    if (!grid && !text.trim()) { C.toast("Choose a file or paste rows first", "amber"); return; }
    importPreview = buildImportPreview(text, String(fd.get("defaultSource")), String(fd.get("defaultRelationship")), grid);
    document.getElementById("import-preview")!.innerHTML = renderImportPreview(); document.getElementById("import-preview")!.scrollIntoView({ behavior: "smooth", block: "start" });
    const steps = document.querySelector(".steps"); if (steps) { steps.children[0].className = "done"; steps.children[1].className = "now"; }
  },
};

const H = { C: () => C, esc, raw, L, badge, chip, card, field, input, textarea, select, check, btn, stat, empty, personLink, availBadge, score, opt, rel, fmtDate, avatar };
const dv = demandViews(H); const mv = memberViews(H);
Object.assign(actions, dv.actions, mv.actions); Object.assign(forms, dv.forms, mv.forms);
export const views = { overview, intelligence, network, person: personView, conversations, opportunities, opportunity, amana, partners, relocation, import: importView, settings, requirements: dv.requirements, requirement: dv.requirement, portal: dv.portal, screening: mv.screening, member: mv.member, referrals: mv.referrals, join: mv.join, actions, forms };
