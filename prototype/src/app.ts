/* Network Intelligence — live prototype. Runs entirely in the browser; persists through the artifact data store. */
import { seed } from "./data";
import { createPersist, type Persist } from "./persist";
import type { State, Person, Conversation, Opportunity, Match, Introduction, Relocation, AuditEntry, Relationship, Evidence, Scheduled, TeamMember, Partner } from "./types";
import { retrieveMatches, capabilityCoverage, type MatchPerson } from "@/lib/matching";
import { assessFreshness, suggestNextCheck, ACTIVE_STATUSES } from "@/lib/availability";
import { HeuristicAIProvider } from "@/lib/ai/heuristic";
import { parseCsv, mapHeaders, SOURCE_ALIASES, RELATIONSHIP_ALIASES, templateCsv } from "@/lib/csv";
import { AVAILABILITY_LABELS, AVAILABILITY_TONE, ROUTE_LABELS, SENIORITY_LABELS, SOURCE_LABELS, RELATIONSHIP_LABELS, EVIDENCE_LABELS, OPPORTUNITY_STATUS_LABELS, KANBAN_STAGES, DECISION_LABELS, DECISION_TONE, INTRO_STATUS_LABELS, ADVISORY_LABELS, REQUIREMENT_STATUS_LABELS, CONVERSATION_PROMPTS } from "@/lib/labels";
import { redactForPartner } from "@/lib/authz";
import { parseBrief, matchBrief, hardChecks, estimateFee, defaultFeeModel, defaultTerms, DEFAULT_RATE_CARD, fmt as fmtMoney, rateBand, FEE_MODEL_LABELS, SHORTLIST_LABELS, PORTAL_VISIBLE, BRIEF_STATUS_LABELS, FEE_STATUS_LABELS } from "@/lib/demand";
import { views, setContext, type Ctx } from "./views";

// ---------- helpers ----------
export const ai = new HeuristicAIProvider();
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
export class Raw { constructor(public s: string) {} }
export const raw = (s: string) => new Raw(s);
export const uid = () => "x" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const nowISO = () => new Date().toISOString();
export const full = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;
export const list = (s: string | null | undefined) => (s ? s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean) : []);

// ---------- store ----------
export let S: State = seed();
let persist: Persist;
const COLLECTIONS = ["people", "relationships", "evidence", "conversations", "scheduled", "opportunities", "matches", "introductions", "team", "relocation", "requirements", "partners", "accounts", "briefs", "shortlist", "fees"];
const keyOf = (c: string, d: any) => (c === "relocation" ? d.personId : d.id);
export async function commit(collection: string, doc: any, audit?: { action: string; entityType: string; entityId?: string | null; detail?: string | null }) {
  const arr = (S as any)[collection] as any[];
  const k = keyOf(collection, doc);
  const idx = arr.findIndex((x) => keyOf(collection, x) === k);
  if (idx >= 0) arr[idx] = doc; else arr.push(doc);
  if (audit) S.audit.unshift({ id: uid(), actorId: S.me.id, createdAt: nowISO(), ...audit });
  try { await persist.save(collection, k, doc); if (audit) await persist.save("audit", "log", { entries: S.audit.slice(0, 400) }); } catch { toast("Saved on this device only", "amber"); }
}
export async function removeDoc(collection: string, id: string) {
  (S as any)[collection] = ((S as any)[collection] as any[]).filter((x) => keyOf(collection, x) !== id);
  try { await persist.remove(collection, id); } catch { /* local */ }
}
export function logAudit(action: string, entityType: string, entityId: string | null, detail: string | null) {
  S.audit.unshift({ id: uid(), actorId: S.me.id, action, entityType, entityId, detail, createdAt: nowISO() });
  persist.save("audit", "log", { entries: S.audit.slice(0, 400) }).catch(() => {});
}
function overlay(loaded: Record<string, any[]>) {
  for (const c of COLLECTIONS) {
    const arr = (S as any)[c] as any[];
    for (const doc of loaded[c] ?? []) { const k = keyOf(c, doc); const idx = arr.findIndex((x) => keyOf(c, x) === k); if (idx >= 0) arr[idx] = doc; else arr.push(doc); }
  }
  const log = loaded.audit?.find((d) => d.id === "log");
  if (log?.entries) S.audit = [...log.entries, ...S.audit.filter((a) => !log.entries.some((e: AuditEntry) => e.id === a.id))];
}
export const person = (id: string) => S.people.find((p) => p.id === id);
export const userName = (id: string) => S.users.find((u) => u.id === id)?.name ?? S.partners.find((p) => p.id === id)?.name ?? "Someone";
export const relsOf = (id: string) => S.relationships.filter((r) => r.personId === id);
export const evOf = (id: string) => S.evidence.filter((e) => e.personId === id);
export const convOf = (id: string) => S.conversations.filter((c) => c.personId === id).sort((a, b) => b.date.localeCompare(a.date));
export const fresh = (p: Person) => assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt ? new Date(p.availabilityConfirmedAt) : null, nextCheckDate: p.nextCheckDate ? new Date(p.nextCheckDate) : null });
export function toMatchPerson(p: Person): MatchPerson {
  return { id: p.id, capabilities: p.capabilities, sectors: p.sectors, seniority: p.seniority ?? null, engagementPreferences: p.engagementPreferences, primaryCity: p.primaryCity ?? null, primaryCountry: p.primaryCountry ?? null, targetLocations: p.targetLocations, availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt ? new Date(p.availabilityConfirmedAt) : null, nextCheckDate: p.nextCheckDate ? new Date(p.nextCheckDate) : null, rateExpectation: p.rateExpectation, salaryExpectation: p.salaryExpectation, relationships: relsOf(p.id).map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain ?? null, yearsKnown: r.yearsKnown ?? null })), evidence: evOf(p.id).map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })), approvedConversations: convOf(p.id).filter((c) => c.approvalStatus === "APPROVED").length };
}
/** How well the network knows someone (0-100). About our knowledge, never their quality. */
export const toBriefPerson = (p: Person) => ({ ...toMatchPerson(p), workRights: p.workRights ?? [], relocationInterest: p.relocationInterest });
export function depth(p: Person) {
  const r = relsOf(p.id), e = evOf(p.id), c = convOf(p.id).filter((x) => x.approvalStatus === "APPROVED");
  let d = Math.min(25, r.length * 12 + (r.some((x) => x.workedTogether) ? 13 : 0)) + Math.min(30, e.length * 12) + Math.min(30, c.length * 18);
  d += fresh(p) === "fresh" ? 15 : fresh(p) === "aging" ? 8 : 0;
  return Math.min(100, Math.round(d));
}

// ---------- toasts, drawer, palette ----------
export function toast(msg: string, tone = "teal") {
  const el = document.createElement("div"); el.className = `toast tone-${tone}`; el.textContent = msg;
  document.getElementById("toasts")!.appendChild(el); setTimeout(() => el.classList.add("out"), 2600); setTimeout(() => el.remove(), 3000);
}
let drawerSubmit: ((fd: FormData, form: HTMLFormElement) => Promise<void> | void) | null = null;
export function openDrawer(title: string, desc: string, body: Raw, onSubmit: typeof drawerSubmit, opts: { wide?: boolean; submitLabel?: string } = {}) {
  drawerSubmit = onSubmit;
  const root = document.getElementById("drawer")!;
  root.innerHTML = `<div class="scrim" data-close></div><div class="panel ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true"><header><div><h2>${esc(title)}</h2><p>${esc(desc)}</p></div><button type="button" class="icon" data-close aria-label="Close">✕</button></header><form id="drawer-form" class="content">${body.s}<footer><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn primary">${esc(opts.submitLabel ?? "Save")}</button></footer></form></div>`;
  root.hidden = false; document.body.style.overflow = "hidden";
  setTimeout(() => (root.querySelector("input:not([type=hidden]),textarea,select") as HTMLElement | null)?.focus(), 30);
}
export function closeDrawer() { const root = document.getElementById("drawer")!; root.hidden = true; root.innerHTML = ""; document.body.style.overflow = ""; drawerSubmit = null; }
let paletteIdx = 0;
function openPalette() { const root = document.getElementById("palette")!; root.hidden = false; const inp = root.querySelector("input") as HTMLInputElement; inp.value = ""; paletteIdx = 0; renderPalette(""); setTimeout(() => inp.focus(), 20); }
function closePalette() { document.getElementById("palette")!.hidden = true; }
function paletteItems(q: string) {
  const pages = [["Overview", "#/overview"], ["Network", "#/network"], ["Conversations", "#/conversations"], ["Opportunities", "#/opportunities"], ["Requirements & co-pilot", "#/requirements"], ["Client & agency portal", "#/portal"], ["Amana Expert Network", "#/amana"], ["Partners", "#/partners"], ["Relocation", "#/relocation"], ["Import contacts", "#/import"], ["Commercials", "#/settings?tab=commercials"], ["Settings", "#/settings"]].map(([l, href]) => ({ label: l, hint: "Page", href }));
  const briefs = S.briefs.map((b) => ({ label: b.title, hint: `Requirement · ${S.accounts.find((a) => a.id === b.accountId)?.name ?? ""}`, href: `#/requirements/${b.id}` }));
  const people = S.people.map((p) => ({ label: full(p), hint: p.headline ?? "Person", href: `#/people/${p.id}` }));
  const opps = S.opportunities.map((o) => ({ label: o.title, hint: o.clientName ?? "Opportunity", href: `#/opportunities/${o.id}` }));
  const t = q.trim().toLowerCase();
  return (t ? [...pages, ...people, ...opps, ...briefs].filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(t)) : pages).slice(0, 12);
}
function renderPalette(q: string) {
  const items = paletteItems(q);
  document.getElementById("palette-list")!.innerHTML = items.length ? items.map((i, idx) => `<li><a href="${i.href}" class="${idx === paletteIdx ? "active" : ""}" data-palette-item><span>${esc(i.label)}</span><small>${esc(i.hint)}</small></a></li>`).join("") : `<li class="none">No results</li>`;
}

// ---------- router ----------
export type View = { title: string; crumbs: [string, string?][]; html: Raw; after?: () => void };
function route(): View {
  const hash = location.hash.replace(/^#/, "") || "/overview";
  const [path, qs] = hash.split("?");
  const q = new URLSearchParams(qs ?? "");
  const seg = path.split("/").filter(Boolean);
  if (seg[0] === "people" && seg[1]) return views.person(seg[1], q);
  if (seg[0] === "opportunities" && seg[1]) return views.opportunity(seg[1]);
  if (seg[0] === "requirements" && seg[1]) return views.requirement(seg[1]);
  const v = (views as any)[seg[0]];
  return typeof v === "function" && seg[0] !== "person" && seg[0] !== "opportunity" && seg[0] !== "requirement" ? v(q) : views.overview();
}
export function render() {
  const v = route();
  document.title = `${v.title} · Network Intelligence`;
  const main = document.getElementById("main")!;
  main.innerHTML = v.html.s;
  window.scrollTo(0, 0);
  document.getElementById("crumbs")!.innerHTML = v.crumbs.map(([l, href], i) => (href && i < v.crumbs.length - 1 ? `<a href="${href}">${esc(l)}</a>` : `<b>${esc(l)}</b>`)).join('<span class="sep">/</span>');
  const path = location.hash.split("?")[0].replace(/^#/, "") || "/overview";
  document.querySelectorAll<HTMLAnchorElement>("#rail a[data-nav]").forEach((a) => a.classList.toggle("active", path === a.dataset.nav || (path.startsWith(a.dataset.nav + "/")) || (a.dataset.nav === "/network" && path.startsWith("/people/"))));
  countUp(main); v.after?.();
}
function countUp(root: HTMLElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count); if (!Number.isFinite(target) || el.dataset.count === "") return;
    const start = performance.now(); const dur = 700;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = String(Math.round(target * e)); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

// ---------- constellation ----------
let constellationStop: (() => void) | null = null;
export function constellation(canvas: HTMLCanvasElement | null) {
  constellationStop?.(); if (!canvas) return;
  const ctx = canvas.getContext("2d")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const people = S.people.slice(0, 90);
  type N = { id: string; x: number; y: number; r: number; tone: string; label: string; ring: number };
  const W = () => canvas.clientWidth, H = () => canvas.clientHeight;
  let seedR = 7;
  const rnd = () => { seedR = (seedR * 9301 + 49297) % 233280; return seedR / 233280; };
  const nodes: N[] = people.map((p, i) => {
    const t = fresh(p) === "stale" || fresh(p) === "unknown" ? "amber" : AVAILABILITY_TONE[p.availabilityStatus];
    const worked = relsOf(p.id).some((r) => r.workedTogether);
    const ang = (i / people.length) * Math.PI * 2 + (worked ? 0.35 : 0), rad = worked ? 0.2 : 0.36;
    const cx = 0.7, cy = 0.42;
    const x = Math.min(0.97, Math.max(0.44, cx + Math.cos(ang) * rad * (0.75 + rnd() * 0.5) * 0.9));
    const y = Math.min(0.72, Math.max(0.08, cy + Math.sin(ang) * rad * (0.7 + rnd() * 0.5) * 1.6));
    return { id: p.id, x, y, r: worked ? 4.5 : 3.5, tone: t, label: full(p), ring: worked ? 1 : 0 };
  });
  const edges = S.relationships.map((r) => ({ a: r.personId, b: r.introducedById ?? "you", worked: r.workedTogether }));
  let hover: N | null = null, raf = 0; const t0 = performance.now();
  let pos = new Map<string, number[]>();
  const resize = () => { const dpr = devicePixelRatio || 1; canvas.width = W() * dpr; canvas.height = H() * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize();
  const col = (tone: string, a = 1) => ({ teal: `rgba(45,212,191,${a})`, amber: `rgba(251,191,36,${a})`, navy: `rgba(147,177,255,${a})`, neutral: `rgba(200,210,230,${a})` }[tone] ?? `rgba(200,210,230,${a})`);
  const draw = (now: number) => {
    const w = W(), hgt = H(), t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, hgt);
    pos = new Map();
    nodes.forEach((n, i) => pos.set(n.id, [n.x * w + (reduce ? 0 : Math.sin(t * 0.35 + i) * 6), n.y * hgt + (reduce ? 0 : Math.cos(t * 0.3 + i * 1.7) * 5)]));
    pos.set("you", [0.7 * w, 0.42 * hgt]);
    for (const e of edges) { const a = pos.get(e.a), b = pos.get(e.b); if (!a || !b) continue; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = e.worked ? "rgba(45,212,191,0.55)" : "rgba(255,255,255,0.14)"; ctx.lineWidth = e.worked ? 1.2 : 1; ctx.setLineDash(e.worked ? [] : [2, 5]); ctx.stroke(); ctx.setLineDash([]); }
    for (const n of nodes) { const [x, y] = pos.get(n.id)!; const hot = hover === n; ctx.beginPath(); ctx.arc(x, y, n.r + (hot ? 10 : 6), 0, Math.PI * 2); ctx.fillStyle = col(n.tone, hot ? 0.28 : n.ring ? 0.16 : 0.08); ctx.fill(); ctx.beginPath(); ctx.arc(x, y, n.r + (hot ? 1.5 : 0), 0, Math.PI * 2); ctx.fillStyle = col(n.tone, 0.95); ctx.fill(); if (hot || n.ring) { ctx.fillStyle = hot ? "#fff" : "rgba(255,255,255,0.62)"; ctx.font = `${hot ? 600 : 500} 11px Geist, system-ui, sans-serif`; ctx.fillText(n.label, x + n.r + 7, y + 4); } }
    const [yx, yy] = pos.get("you")!; ctx.beginPath(); ctx.arc(yx, yy, 16, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fill(); ctx.beginPath(); ctx.arc(yx, yy, 6, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "600 11px Geist, system-ui, sans-serif"; ctx.fillText("You", yx + 14, yy + 4);
    if (!reduce) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  const onMove = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; hover = null; for (const n of nodes) { const p = pos.get(n.id); if (p && Math.hypot(p[0] - mx, p[1] - my) < 14) { hover = n; break; } } canvas.style.cursor = hover ? "pointer" : "default"; if (reduce) draw(performance.now()); };
  const onClick = () => { if (hover) location.hash = `#/people/${hover.id}`; };
  canvas.addEventListener("mousemove", onMove); canvas.addEventListener("click", onClick); window.addEventListener("resize", resize);
  constellationStop = () => { cancelAnimationFrame(raf); canvas.removeEventListener("mousemove", onMove); canvas.removeEventListener("click", onClick); window.removeEventListener("resize", resize); };
}

// ---------- boot ----------
async function boot() {
  const app = document.getElementById("app")!;
  const ini = S.me.name.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const ICO: Record<string, string> = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    network: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/>',
    conversations: '<path d="M4 5h16v10H9l-5 4z"/>',
    opportunities: '<path d="M12 3l9 9-9 9-9-9z"/>',
    requirements: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="17.5" cy="16.5" r="3"/><path d="m20 19 2 2"/>',
    portal: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 9h6M7 13h4"/>',
    amana: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6"/>',
    partners: '<path d="M8 12l3 3 5-5"/><circle cx="12" cy="12" r="9"/>',
    relocation: '<path d="M3 12h13"/><path d="M12 6l6 6-6 6"/><path d="M19 4v16"/>',
    import: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  };
  const ico = (k: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
  app.innerHTML = `
    <div class="ambient" aria-hidden="true"></div>
    <aside id="rail"><a class="brand" href="#/overview"><span class="mark">NI</span><span><b>Network Intelligence</b><small>Founder network</small></span></a>
      <nav>${[["/overview", "Overview", "overview"], ["/network", "Network", "network"], ["/conversations", "Conversations", "conversations"], ["/opportunities", "Opportunities", "opportunities"], ["/requirements", "Requirements", "requirements"]].map(([p, l, i]) => `<a data-nav="${p}" href="#${p}"><i>${ico(i)}</i>${l}</a>`).join("")}<div class="group">Workspaces</div>${[["/amana", "Amana Expert Network", "amana"], ["/portal", "Client & agency portal", "portal"], ["/partners", "Partners", "partners"], ["/relocation", "Relocation", "relocation"]].map(([p, l, i]) => `<a data-nav="${p}" href="#${p}"><i>${ico(i)}</i>${l}</a>`).join("")}<div class="group">Setup</div>${[["/import", "Import contacts", "import"], ["/settings", "Settings", "settings"]].map(([p, l, i]) => `<a data-nav="${p}" href="#${p}"><i>${ico(i)}</i>${l}</a>`).join("")}</nav>
      <div class="me"><span class="avatar hue-1 md"><span>${esc(ini)}</span></span><div><b>${esc(S.me.name)}</b><small>Owner</small></div><button type="button" class="icon" id="theme" title="Toggle theme" aria-label="Toggle theme">◐</button></div></aside>
    <div class="content"><header id="top"><nav id="crumbs" aria-label="Breadcrumb"></nav><button type="button" class="searchbtn" id="open-palette"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Search people, opportunities… <kbd>⌘K</kbd></button></header><main id="main"></main></div>
    <div id="drawer" hidden></div><div id="palette" hidden><div class="scrim" data-close-palette></div><div class="box"><div class="in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input placeholder="Search people, opportunities, pages…" aria-label="Search"><kbd>esc</kbd></div><ul id="palette-list"></ul></div></div><div id="toasts"></div>`;
  try { const t = localStorage.getItem("ni-theme"); if (t) document.documentElement.dataset.theme = t; } catch { /* no storage */ }
  document.getElementById("theme")!.addEventListener("click", () => { const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); const next = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; try { localStorage.setItem("ni-theme", next); } catch { /* no storage */ } });
  persist = await createPersist();
  try { const loaded = await persist.loadAll([...COLLECTIONS, "audit", "settings"]); overlay(loaded); const rc = loaded.settings?.find((d) => d.id === "rateCard"); if (rc) S.rateCard = { ...S.rateCard, ...rc }; if (loaded.settings?.find((d) => d.id === "prefs")?.hideDemo) { const demoIds = new Set(seed().people.map((p) => p.id)); S.people = S.people.filter((p) => !demoIds.has(p.id)); } } catch { /* start from seed */ }
  const ctx: Ctx = { S: () => S, ai, esc, raw, h: null as any, uid, nowISO, full, list, person, userName, relsOf, evOf, convOf, fresh, depth, toMatchPerson, commit, removeDoc, logAudit, toast, openDrawer, closeDrawer, render, constellation, retrieveMatches, capabilityCoverage, suggestNextCheck, ACTIVE_STATUSES, redactForPartner, parseCsv, mapHeaders, SOURCE_ALIASES, RELATIONSHIP_ALIASES, templateCsv, seed, persistMode: () => persist.mode, savePref: (k, v) => persist.save("settings", "prefs", { [k]: v }).catch(() => {}), saveRateCard: (card) => { S.rateCard = card; return persist.save("settings", "rateCard", card).catch(() => {}); }, toBriefPerson, demand: { parseBrief, matchBrief, hardChecks, estimateFee, defaultFeeModel, defaultTerms, DEFAULT_RATE_CARD, fmt: fmtMoney, rateBand, FEE_MODEL_LABELS, SHORTLIST_LABELS, PORTAL_VISIBLE, BRIEF_STATUS_LABELS, FEE_STATUS_LABELS }, labels: { AVAILABILITY_LABELS, AVAILABILITY_TONE, ROUTE_LABELS, SENIORITY_LABELS, SOURCE_LABELS, RELATIONSHIP_LABELS, EVIDENCE_LABELS, OPPORTUNITY_STATUS_LABELS, KANBAN_STAGES, DECISION_LABELS, DECISION_TONE, INTRO_STATUS_LABELS, ADVISORY_LABELS, REQUIREMENT_STATUS_LABELS, CONVERSATION_PROMPTS } };
  setContext(ctx);
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>("[data-act]"); if (act && !(act as HTMLButtonElement).disabled) { e.preventDefault(); Promise.resolve(views.actions[act.dataset.act!]?.(act)).catch((err) => { console.error(err); toast("Something went wrong", "risk"); }); return; }
    if (t.closest("[data-close]")) { closeDrawer(); return; }
    if (t.closest("[data-close-palette]")) { closePalette(); return; }
    if (t.closest("#open-palette")) { openPalette(); return; }
    if (t.closest("[data-palette-item]")) { closePalette(); return; }
  });
  document.addEventListener("submit", (e) => {
    const form = e.target as HTMLFormElement; e.preventDefault();
    const fd = new FormData(form);
    if (form.id === "drawer-form") { Promise.resolve(drawerSubmit?.(fd, form)).catch((err) => { console.error(err); toast("Could not save", "risk"); }); return; }
    if (form.hasAttribute("data-search")) { const qp = new URLSearchParams(); for (const [k, v] of fd.entries()) if (String(v).trim()) qp.set(k, String(v).trim()); location.hash = `#/network?${qp}`; return; }
    const a = form.dataset.action; if (a && views.forms[a]) Promise.resolve(views.forms[a](fd, form)).catch((err) => { console.error(err); toast("Could not save", "risk"); });
  });
  document.addEventListener("change", (e) => { const t = e.target as HTMLInputElement; if (t.matches("[data-file]")) { document.getElementById("drop-label")!.textContent = t.files?.[0]?.name ?? "Choose an Excel or CSV file"; if (t.files?.[0]) t.form?.requestSubmit(); } });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (document.getElementById("palette")!.hidden) openPalette(); else closePalette(); return; }
    if (e.key === "Escape") { closePalette(); if (!document.getElementById("drawer")!.hidden) closeDrawer(); }
    const pal = document.getElementById("palette")!;
    if (!pal.hidden) { const inp = pal.querySelector("input") as HTMLInputElement; const items = paletteItems(inp.value); if (e.key === "ArrowDown") { paletteIdx = Math.min(items.length - 1, paletteIdx + 1); renderPalette(inp.value); e.preventDefault(); } if (e.key === "ArrowUp") { paletteIdx = Math.max(0, paletteIdx - 1); renderPalette(inp.value); e.preventDefault(); } if (e.key === "Enter" && items[paletteIdx]) { closePalette(); location.hash = items[paletteIdx].href; } }
  });
  document.getElementById("palette")!.querySelector("input")!.addEventListener("input", (e) => { paletteIdx = 0; renderPalette((e.target as HTMLInputElement).value); });
  window.addEventListener("hashchange", render);
  render();
  if (persist.mode === "local") toast("Changes are saved in this browser", "neutral");
}
boot();
