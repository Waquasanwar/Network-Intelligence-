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
import * as series from "@/lib/series";
import * as credibility from "@/lib/credibility";
import * as privacy from "@/lib/privacy";
import * as traits from "@/lib/traits";
import * as automation from "@/lib/automation";
import * as suitability from "@/lib/suitability";
import { parseBrief, matchBrief, hardChecks, estimateFee, defaultFeeModel, defaultTerms, subscriptionFor, DEFAULT_RATE_CARD, fmt as fmtMoney, rateBand, FEE_MODEL_LABELS, SHORTLIST_LABELS, shortlistLabel, PORTAL_VISIBLE, BRIEF_STATUS_LABELS, FEE_STATUS_LABELS } from "@/lib/demand";
import { trustScore, TRUST_BAND_LABEL } from "@/lib/trust";
import { SCREENING_SCRIPT, SCREENING_MINUTES, screeningToResult } from "@/lib/screening";
import { ATTRIBUTES, fitProfile, fitChecks, fitHighlights, parseFitTraits } from "@/lib/fit";
import { views, setContext, type Ctx } from "./views";
import { defineComponents } from "./components";

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
const COLLECTIONS = ["people", "relationships", "evidence", "conversations", "scheduled", "opportunities", "matches", "introductions", "team", "relocation", "requirements", "partners", "accounts", "briefs", "shortlist", "fees", "vouches", "referrals", "pitches"];
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
export const userName = (id: string) => S.users.find((u) => u.id === id)?.name ?? S.partners.find((p) => p.id === id)?.name ?? (S.people.find((p) => p.id === id) ? full(S.people.find((p) => p.id === id)!) : null) ?? S.accounts.find((a) => a.id === id)?.name ?? "Someone";
export const relsOf = (id: string) => S.relationships.filter((r) => r.personId === id);
export const evOf = (id: string) => S.evidence.filter((e) => e.personId === id);
export const convOf = (id: string) => S.conversations.filter((c) => c.personId === id).sort((a, b) => b.date.localeCompare(a.date));
export const fresh = (p: Person) => assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt ? new Date(p.availabilityConfirmedAt) : null, nextCheckDate: p.nextCheckDate ? new Date(p.nextCheckDate) : null });
export function toMatchPerson(p: Person): MatchPerson {
  return { id: p.id, capabilities: p.capabilities, sectors: p.sectors, seniority: p.seniority ?? null, engagementPreferences: p.engagementPreferences, primaryCity: p.primaryCity ?? null, primaryCountry: p.primaryCountry ?? null, targetLocations: p.targetLocations, availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt ? new Date(p.availabilityConfirmedAt) : null, nextCheckDate: p.nextCheckDate ? new Date(p.nextCheckDate) : null, rateExpectation: p.rateExpectation, salaryExpectation: p.salaryExpectation, relationships: relsOf(p.id).map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain ?? null, yearsKnown: r.yearsKnown ?? null })), evidence: evOf(p.id).map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })), approvedConversations: convOf(p.id).filter((c) => c.approvalStatus === "APPROVED").length };
}
/** How well the network knows someone (0-100). About our knowledge, never their quality. */
export const vouchesOf = (id: string) => S.vouches.filter((v) => v.personId === id);
export const observedAttrs = (id: string) => vouchesOf(id).map((v) => v.attributes).filter((a): a is NonNullable<typeof a> => !!a);
export const fitOf = (p: Person) => fitProfile(p.attributes ?? null, observedAttrs(p.id));
export const toBriefPerson = (p: Person) => ({ ...toMatchPerson(p), workRights: p.workRights ?? [], relocationInterest: p.relocationInterest, attributes: p.attributes ?? null, observedAttributes: observedAttrs(p.id), vouchedBy: vouchesOf(p.id).filter((v) => v.wouldRecommend).length });
export function trustOf(p: Person) {
  const r = relsOf(p.id), e = evOf(p.id), c = convOf(p.id).filter((x) => x.approvalStatus === "APPROVED");
  return trustScore({ vouches: vouchesOf(p.id).map((v) => ({ wouldRecommend: v.wouldRecommend, external: v.voucherKind === "EXTERNAL" })), workedWith: r.filter((x) => x.workedTogether).length, wouldWorkAgain: r.filter((x) => x.wouldWorkTogetherAgain === true).length, evidence: e.filter((x) => x.evidenceType !== "CAUTION").length, cautions: e.filter((x) => x.evidenceType === "CAUTION").length, approvedConversations: c.length, screened: p.screeningStatus === "APPROVED" || !!p.screenedAt, freshness: fresh(p) as "fresh" | "aging" | "stale" | "unknown", referralsAccepted: S.referrals.filter((x) => x.referrerPersonId === p.id && x.status === "ACCEPTED").length });
}
/** Things that need the owner's attention, derived from the data. */
export function alerts() {
  const out: { kind: string; text: string; href: string; when: string; tone: string }[] = [];
  for (const p of S.people) { if (p.screeningStatus === "REGISTERED") out.push({ kind: "New member", text: `${full(p)} registered and needs a screening call`, href: `#/people/${p.id}`, when: p.memberSince ?? p.createdAt, tone: "teal" }); if (p.screeningStatus === "SUBMITTED") out.push({ kind: "Screening", text: `${full(p)} completed the AI screening. Review the summary.`, href: `#/conversations?tab=review`, when: p.updatedAt, tone: "amber" }); }
  for (const r of S.referrals) if (r.status === "NEW") out.push({ kind: "Referral", text: `${userName(r.referrerPersonId)} referred ${r.name}${r.briefId ? " for a requirement" : ""}`, href: "#/referrals", when: r.createdAt, tone: "navy" });
  for (const p of S.pitches) if (p.status === "SUBMITTED") out.push({ kind: "Pitch", text: `${userName(p.personId)} pitched for "${S.briefs.find((b) => b.id === p.briefId)?.title ?? "a requirement"}"`, href: "#/referrals?tab=pitches", when: p.createdAt, tone: "navy" });
  for (const b of S.briefs) if (b.status === "NEW" && b.submittedVia === "PORTAL") out.push({ kind: "Requirement", text: `${S.accounts.find((a) => a.id === b.accountId)?.name ?? "A client"} sent a new requirement`, href: `#/requirements/${b.id}`, when: b.createdAt, tone: "amber" });
  for (const s of S.shortlist) if (s.decision === "CLIENT_INTERESTED") { const b = S.briefs.find((x) => x.id === s.briefId); out.push({ kind: "Introduction", text: `${S.accounts.find((a) => a.id === b?.accountId)?.name ?? "A client"} wants an introduction to ${userName(s.personId)}`, href: `#/requirements/${s.briefId}`, when: s.updatedAt, tone: "teal" }); }
  return out.sort((a, b) => b.when.localeCompare(a.when));
}
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
/**
 * Swap what a drawer is showing without closing it: used by the guided flows, so adding a client
 * feels like one continuous thing rather than three dialogs. The panel stays put; only the
 * content moves, and it moves the way iOS moves — out to the left, in from the right.
 */
export function setDrawerStep(title: string, desc: string, body: Raw, onSubmit: typeof drawerSubmit, opts: { submitLabel?: string; back?: boolean; step?: [number, number] } = {}) {
  const root = document.getElementById("drawer")!;
  const panel = root.querySelector(".panel");
  if (!panel) { openDrawer(title, desc, body, onSubmit, { submitLabel: opts.submitLabel }); return; }
  drawerSubmit = onSubmit;
  const head = panel.querySelector("header > div")!;
  const old = panel.querySelector("#drawer-form") as HTMLElement | null;
  const dots = opts.step ? `<div class="step-dots">${Array.from({ length: opts.step[1] }, (_, i) => `<i class="${i < opts.step![0] ? "done" : i === opts.step![0] ? "now" : ""}"></i>`).join("")}</div>` : "";
  head.innerHTML = `<h2>${esc(title)}</h2><p>${esc(desc)}</p>${dots}`;
  const next = document.createElement("form");
  next.id = "drawer-form"; next.className = "content step-in";
  next.innerHTML = `${body.s}<footer>${opts.back ? '<button type="button" class="btn ghost" data-step-back>← Back</button>' : '<button type="button" class="btn ghost" data-close>Cancel</button>'}<button type="submit" class="btn primary">${esc(opts.submitLabel ?? "Continue")}</button></footer>`;
  if (old) { old.classList.add("step-out"); setTimeout(() => old.remove(), 180); }
  panel.appendChild(next);
  setTimeout(() => (next.querySelector("input:not([type=hidden]),textarea,select") as HTMLElement | null)?.focus(), 60);
}

export function closeDrawer() { const root = document.getElementById("drawer")!; root.hidden = true; root.innerHTML = ""; document.body.style.overflow = ""; drawerSubmit = null; stepBack = null; }
/** Set by a guided flow so the drawer's Back button can walk the steps. */
export let stepBack: (() => void) | null = null;
export function setStepBack(fn: (() => void) | null) { stepBack = fn; }
let renderShell: () => void = () => {};
let paletteIdx = 0;
function openPalette() { const root = document.getElementById("palette")!; root.hidden = false; const inp = root.querySelector("input") as HTMLInputElement; inp.value = ""; paletteIdx = 0; renderPalette(""); setTimeout(() => inp.focus(), 20); }
function closePalette() { document.getElementById("palette")!.hidden = true; }

/** One place to start anything. Same items wherever you are, so nothing is buried in a page. */
const NEW_ITEMS: { act: string; label: string; hint: string; icon: string }[] = [
  { act: "captureAny", label: "Capture a conversation", hint: "A coffee, a call, a corridor chat", icon: "conversation" },
  { act: "addPerson", label: "Add a person", hint: "Someone you know", icon: "person" },
  { act: "setupClient", label: "Add a client", hint: "Hires directly, pays on success", icon: "brief" },
  { act: "setupAgency", label: "Add an agency", hint: "Places our people, shares the fee", icon: "money" },
  { act: "newRequirement", label: "Add a requirement", hint: "A role to fill", icon: "arrow" },
  { act: "inviteMember", label: "Invite someone to the network", hint: "Join link and screening", icon: "referral" },
  { act: "goImport", label: "Import contacts", hint: "Excel or CSV", icon: "evidence" },
];
function toggleNewMenu() {
  const root = document.getElementById("newmenu")!;
  const btn = document.getElementById("new-btn")!;
  if (!root.hidden) { root.hidden = true; btn.setAttribute("aria-expanded", "false"); return; }
  root.innerHTML = `<div class="menu-panel" role="menu">${NEW_ITEMS.map((i) => `<button type="button" role="menuitem" data-new-item data-act="${i.act}"><ni-icon name="${i.icon}" size="15" tone="mute"></ni-icon><span><b>${esc(i.label)}</b><small>${esc(i.hint)}</small></span></button>`).join("")}</div>`;
  root.hidden = false; btn.setAttribute("aria-expanded", "true");
}
function paletteItems(q: string) {
  const pages = [["Overview", "#/overview"], ["Experts", "#/network"], ["Conversations", "#/conversations"], ["Amana delivery", "#/opportunities"], ["Requirements & co-pilot", "#/requirements"], ["Client & agency view", "#/portal"], ["Referrals & pitches", "#/referrals"], ["Expert view", "#/member"], ["Join the network", "#/join"], ["Amana Expert Network", "#/amana"], ["Partners", "#/partners"], ["Relocation", "#/relocation"], ["Import contacts", "#/import"], ["Commercials", "#/settings?tab=commercials"], ["Settings", "#/settings"]].map(([l, href]) => ({ label: l, hint: "Page", href }));
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
  const role = S.viewAs.role;
  const allowed = role === "OWNER" ? null : role === "MEMBER" ? ["member", "screening", "people"] : ["portal"];
  if (allowed && seg[0] && !allowed.includes(seg[0])) { location.hash = role === "MEMBER" ? "#/member" : "#/portal"; return views.overview(); }
  if (allowed && !seg[0]) { location.hash = role === "MEMBER" ? "#/member" : "#/portal"; return views.overview(); }
  if (role === "MEMBER" && seg[0] === "people" && seg[1] !== S.viewAs.personId) { location.hash = "#/member"; return views.overview(); }
  if (seg[0] === "requirements" && seg[1]) return views.requirement(seg[1]);
  if (seg[0] === "screening" && seg[1]) return views.screening(seg[1], q);
  const v = (views as any)[seg[0]];
  return typeof v === "function" && seg[0] !== "person" && seg[0] !== "opportunity" && seg[0] !== "requirement" && seg[0] !== "screening" ? v(q) : views.overview();
}
/**
 * Which light the interface is standing in. A client and an agency are not the same audience
 * and should not look the same: the accent, the gradients and the primary action follow the view.
 */
function viewLight(): "" | "client" | "agency" | "member" {
  const path = location.hash.split("?")[0].replace(/^#/, "") || "/overview";
  if (path.startsWith("/member") || path.startsWith("/screening") || path.startsWith("/join")) return "member";
  if (path.startsWith("/portal")) {
    const q = new URLSearchParams(location.hash.split("?")[1] ?? "");
    const va = S.viewAs;
    const acc = (va.role === "CLIENT" || va.role === "AGENCY" ? S.accounts.find((a) => a.id === va.accountId) : undefined) ?? S.accounts.find((a) => a.id === q.get("account")) ?? S.accounts.find((a) => a.portalEnabled);
    return acc?.kind === "AGENCY" ? "agency" : acc?.kind === "CLIENT" ? "client" : "";
  }
  if (S.viewAs.role === "MEMBER") return "member";
  return "";
}

export function render() {
  const v = route();
  document.title = `${v.title} · Network Intelligence`;
  const light = viewLight();
  if (light) document.documentElement.dataset.view = light; else delete document.documentElement.dataset.view;
  const main = document.getElementById("main")!;
  main.innerHTML = v.html.s;
  window.scrollTo(0, 0);
  document.getElementById("crumbs")!.innerHTML = v.crumbs.map(([l, href], i) => (href && i < v.crumbs.length - 1 ? `<a href="${href}">${esc(l)}</a>` : `<b>${esc(l)}</b>`)).join('<span class="sep">/</span>');
  const path = location.hash.split("?")[0].replace(/^#/, "") || "/overview";
  const view = document.documentElement.dataset.view ?? "";
  document.querySelectorAll<HTMLAnchorElement>("#rail a[data-nav]").forEach((a) => {
    const nav = a.dataset.nav ?? ""; const [navPath, navQs] = nav.split("?");
    const navAccount = new URLSearchParams(navQs ?? "").get("account");
    // Two rail entries point at /portal — one for clients, one for agencies. The active one is
    // whichever matches the portal you are actually looking at.
    const active = navPath === "/portal" && path === "/portal"
      ? (navAccount ? new URLSearchParams(location.hash.split("?")[1] ?? "").get("account") === navAccount || (view === "agency") === (S.accounts.find((x) => x.id === navAccount)?.kind === "AGENCY") : true)
      : path === navPath || path.startsWith(navPath + "/") || (navPath === "/network" && path.startsWith("/people/"));
    a.classList.toggle("active", active);
  });
  countUp(main); v.after?.();
  const bell = document.getElementById("bell-count"); if (bell) { const n = S.viewAs.role === "OWNER" ? alerts().length : 0; bell.textContent = String(n); bell.hidden = n === 0; }
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
    for (const n of nodes) { const [x, y] = pos.get(n.id)!; const hot = hover === n; ctx.beginPath(); ctx.arc(x, y, n.r + (hot ? 10 : 6), 0, Math.PI * 2); ctx.fillStyle = col(n.tone, hot ? 0.28 : n.ring ? 0.16 : 0.08); ctx.fill(); ctx.beginPath(); ctx.arc(x, y, n.r + (hot ? 1.5 : 0), 0, Math.PI * 2); ctx.fillStyle = col(n.tone, 0.95); ctx.fill(); if (hot || n.ring) { ctx.fillStyle = hot ? "#fff" : "rgba(255,255,255,0.62)"; ctx.font = `${hot ? 600 : 500} 11px "Inter Tight", system-ui, sans-serif`; ctx.fillText(n.label, x + n.r + 7, y + 4); } }
    const [yx, yy] = pos.get("you")!; ctx.beginPath(); ctx.arc(yx, yy, 16, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fill(); ctx.beginPath(); ctx.arc(yx, yy, 6, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = '600 11px "Inter Tight", system-ui, sans-serif'; ctx.fillText("You", yx + 14, yy + 4);
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
  defineComponents();
  const app = document.getElementById("app")!;
  const ini = S.me.name.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const ICO: Record<string, string> = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    network: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/>',
    conversations: '<path d="M4 5h16v10H9l-5 4z"/>',
    opportunities: '<path d="M12 3l9 9-9 9-9-9z"/>',
    requirements: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="17.5" cy="16.5" r="3"/><path d="m20 19 2 2"/>',
    portal: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 9h6M7 13h4"/>',
    referrals: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><path d="M17 8h4M19 6v4"/>',
    member: '<circle cx="12" cy="9" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M12 2.5l1 1.8 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 4.6l2-.3z"/>',
    join: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    amana: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6"/>',
    partners: '<path d="M8 12l3 3 5-5"/><circle cx="12" cy="12" r="9"/>',
    relocation: '<path d="M3 12h13"/><path d="M12 6l6 6-6 6"/><path d="M19 4v16"/>',
    import: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
    performance: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    intelligence: '<path d="M12 3a5 5 0 0 1 5 5c0 1.8-.9 3-1.8 4S14 14 14 15.5h-4c0-1.5-.3-2.5-1.2-3.5S7 9.8 7 8a5 5 0 0 1 5-5z"/><path d="M10 19h4M10.5 21.5h3"/>',
    agency: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-5h6v5"/><path d="M9.5 11h1M13.5 11h1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  };
  const ico = (k: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
  const railNav = () => {
    const role = S.viewAs.role;
    const link = ([p, l, i]: string[]) => `<a data-nav="${p}" href="#${p}"><i>${ico(i)}</i>${l}</a>`;
    if (role === "MEMBER") return `<nav>${[["/member", "My expert profile", "member"], ["/member?tab=opportunities", "Work open to me", "opportunities"], ["/member?tab=refer", "Refer someone", "referrals"]].map(link).join("")}</nav>`;
    if (role !== "OWNER") return `<nav>${[["/portal", "My requirements", "requirements"], ["/portal?tab=people", "Experts proposed", "portal"]].map(link).join("")}</nav>`;
    return `<nav>${[["/overview", "Overview", "overview"], ["/network", "Experts", "network"], ["/requirements", "Requirements", "requirements"], ["/intelligence", "Intelligence", "intelligence"], ["/performance", "Performance", "performance"], ["/referrals", "Referrals & pitches", "referrals"], ["/conversations", "Conversations", "conversations"]].map(link).join("")}<div class="group">Views</div>${[["/amana", "Amana Expert Network", "amana"], [`/portal?account=${S.accounts.find((a) => a.kind === "CLIENT" && a.portalEnabled)?.id ?? ""}`, "Client view", "portal"], [`/portal?account=${S.accounts.find((a) => a.kind === "AGENCY" && a.portalEnabled)?.id ?? ""}`, "Agency view", "agency"], ["/member", "Expert view", "member"]].map(link).join("")}<div class="group">Setup</div>${[["/import", "Import contacts", "import"], ["/join", "Join link", "join"], ["/relocation", "Relocation", "relocation"], ["/partners", "Partners", "partners"], ["/settings", "Settings", "settings"]].map(link).join("")}</nav>`;
  };
  const whoAmI = () => { const va = S.viewAs; if (va.role === "MEMBER") { const p = S.people.find((x) => x.id === va.personId); return { name: p ? full(p) : "Expert", sub: "Expert", ini: p ? `${p.firstName[0]}${p.lastName[0]}` : "E" }; } if (va.role === "AGENCY" || va.role === "CLIENT") { const a = S.accounts.find((x) => x.id === va.accountId); return { name: a?.name ?? "Account", sub: va.role === "AGENCY" ? "Agency" : "Client", ini: (a?.name ?? "A").slice(0, 2).toUpperCase() }; } return { name: S.me.name, sub: "Owner", ini }; };
  const roleOptions = () => { const va = S.viewAs; const sel = (k: string) => (k === `${va.role}:${va.accountId ?? va.personId ?? ""}` ? "selected" : ""); return `<optgroup label="Amana Network"><option value="OWNER:" ${sel("OWNER:")}>${esc(S.me.name)} · owner</option></optgroup><optgroup label="Client view">${S.accounts.filter((a) => a.portalEnabled && a.kind === "CLIENT").map((a) => `<option value="CLIENT:${a.id}" ${sel(`CLIENT:${a.id}`)}>${esc(a.name)}</option>`).join("")}</optgroup><optgroup label="Agency view">${S.accounts.filter((a) => a.portalEnabled && a.kind === "AGENCY").map((a) => `<option value="AGENCY:${a.id}" ${sel(`AGENCY:${a.id}`)}>${esc(a.name)}</option>`).join("")}</optgroup><optgroup label="Expert view">${S.people.filter((p) => p.memberSince).slice(0, 10).map((p) => `<option value="MEMBER:${p.id}" ${sel(`MEMBER:${p.id}`)}>${esc(full(p))}</option>`).join("")}</optgroup>`; };
  const renderShellInner = () => {
    const me = whoAmI();
    document.getElementById("rail")!.innerHTML = `<a class="brand" href="#/${S.viewAs.role === "OWNER" ? "overview" : S.viewAs.role === "MEMBER" ? "member" : "portal"}"><span class="mark">NI</span><span><b>Network Intelligence</b><small>${S.viewAs.role === "OWNER" ? "Amana Network" : S.viewAs.role === "MEMBER" ? "Expert view" : S.viewAs.role === "AGENCY" ? "Agency view" : "Client view"}</small></span></a>${railNav()}
      <div class="me"><span class="avatar hue-1 md"><span>${esc(me.ini)}</span></span><div><b>${esc(me.name)}</b><small>${esc(me.sub)}</small></div><button type="button" class="icon" id="theme" title="Toggle theme" aria-label="Toggle theme">◐</button></div>
      <label class="signin"><span>Signed in as</span><select id="viewas" aria-label="Sign in as">${roleOptions()}</select></label>`;
    document.getElementById("theme")!.addEventListener("click", () => { const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); const next = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; try { localStorage.setItem("ni-theme", next); } catch { /* no storage */ } });
    document.getElementById("viewas")!.addEventListener("change", (e) => { const [role, id] = (e.target as HTMLSelectElement).value.split(":"); const v = role === "MEMBER" ? { role: "MEMBER" as const, personId: id } : role === "OWNER" ? { role: "OWNER" as const } : { role: role as "AGENCY" | "CLIENT", accountId: id }; S.viewAs = v; try { localStorage.setItem("ni-viewas", JSON.stringify(v)); } catch { /* no storage */ } location.hash = role === "OWNER" ? "#/overview" : role === "MEMBER" ? "#/member" : "#/portal"; renderShellInner(); render(); });
  };
  renderShell = renderShellInner;
  app.innerHTML = `
    <div class="ambient" aria-hidden="true"></div>
    <aside id="rail"></aside>
    <div class="content"><header id="top"><nav id="crumbs" aria-label="Breadcrumb"></nav><div class="top-actions"><button type="button" class="searchbtn" id="open-palette"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Search people, opportunities… <kbd>⌘K</kbd></button><button type="button" class="newbtn" id="new-btn" aria-haspopup="menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>New</button><button type="button" class="bell" id="bell" aria-label="Alerts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg><i id="bell-count" hidden>0</i></button></div></header><div id="alerts" hidden></div><div id="newmenu" hidden></div><main id="main"></main></div>
    <div id="drawer" hidden></div><div id="palette" hidden><div class="scrim" data-close-palette></div><div class="box"><div class="in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input placeholder="Search people, opportunities, pages…" aria-label="Search"><kbd>esc</kbd></div><ul id="palette-list"></ul></div></div><div id="toasts"></div>`;
  try { const t = localStorage.getItem("ni-theme"); if (t) document.documentElement.dataset.theme = t; } catch { /* no storage */ }
  persist = await createPersist();
  try { const loaded = await persist.loadAll([...COLLECTIONS, "audit", "settings"]); overlay(loaded); const rc = loaded.settings?.find((d) => d.id === "rateCard"); if (rc) S.rateCard = { ...S.rateCard, ...rc }; const sc = loaded.settings?.find((d) => d.id === "screeningScript") as { sections?: typeof S.screeningScript } | undefined; if (sc?.sections?.length) S.screeningScript = sc.sections; try { const va = localStorage.getItem("ni-viewas"); if (va) S.viewAs = JSON.parse(va); } catch { /* default owner */ } if (loaded.settings?.find((d) => d.id === "prefs")?.hideDemo) { const demoIds = new Set(seed().people.map((p) => p.id)); S.people = S.people.filter((p) => !demoIds.has(p.id)); } } catch { /* start from seed */ }
  const ctx: Ctx = { S: () => S, ai, esc, raw, h: null as any, uid, nowISO, full, list, person, userName, relsOf, evOf, convOf, fresh, depth, toMatchPerson, commit, removeDoc, logAudit, toast, openDrawer, setDrawerStep, setStepBack, closeDrawer, render, constellation, series, credibility, privacy, traits, automation, suitability, retrieveMatches, capabilityCoverage, suggestNextCheck, ACTIVE_STATUSES, redactForPartner, parseCsv, mapHeaders, SOURCE_ALIASES, RELATIONSHIP_ALIASES, templateCsv, seed, persistMode: () => persist.mode, savePref: (k, v) => persist.save("settings", "prefs", { [k]: v }).catch(() => {}), saveRateCard: (card) => { S.rateCard = card; return persist.save("settings", "rateCard", card).catch(() => {}); }, saveScript: (sections) => { S.screeningScript = sections; return persist.save("settings", "screeningScript", { sections }).catch(() => {}); }, toBriefPerson, trustOf, fitOf, vouchesOf, alerts, setViewAs: (v) => { S.viewAs = v; try { localStorage.setItem("ni-viewas", JSON.stringify(v)); } catch { /* no storage */ } renderShell(); }, trust: { TRUST_BAND_LABEL }, screening: { SCREENING_SCRIPT, SCREENING_MINUTES, screeningToResult, script: () => S.screeningScript }, fit: { ATTRIBUTES, fitProfile, fitChecks, fitHighlights, parseFitTraits }, demand: { parseBrief, matchBrief, hardChecks, estimateFee, defaultFeeModel, defaultTerms, subscriptionFor, DEFAULT_RATE_CARD, fmt: fmtMoney, rateBand, FEE_MODEL_LABELS, SHORTLIST_LABELS, shortlistLabel, PORTAL_VISIBLE, BRIEF_STATUS_LABELS, FEE_STATUS_LABELS }, labels: { AVAILABILITY_LABELS, AVAILABILITY_TONE, ROUTE_LABELS, SENIORITY_LABELS, SOURCE_LABELS, RELATIONSHIP_LABELS, EVIDENCE_LABELS, OPPORTUNITY_STATUS_LABELS, KANBAN_STAGES, DECISION_LABELS, DECISION_TONE, INTRO_STATUS_LABELS, ADVISORY_LABELS, REQUIREMENT_STATUS_LABELS, CONVERSATION_PROMPTS } };
  setContext(ctx);
  renderShellInner();
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("#bell")) { const panel = document.getElementById("alerts")!; if (!panel.hidden) { panel.hidden = true; return; } const items = alerts(); panel.innerHTML = `<div class="alerts-panel"><header><b>Needs your attention</b><small>${items.length} item${items.length === 1 ? "" : "s"}</small></header>${items.length ? `<ul>${items.map((a) => `<li><a href="${a.href}" data-alert><span class="badge filled tone-${a.tone}">${esc(a.kind)}</span><span>${esc(a.text)}</span><small>${esc(new Date(a.when).toLocaleDateString("en-GB", { day: "numeric", month: "short" }))}</small></a></li>`).join("")}</ul>` : '<p class="dim">Nothing waiting. New registrations, screenings, referrals, pitches and client requests appear here.</p>'}</div>`; panel.hidden = false; return; }
    if (t.closest("[data-alert]")) { document.getElementById("alerts")!.hidden = true; return; }
    if (!t.closest("#alerts")) document.getElementById("alerts")!.hidden = true;
    const act = t.closest<HTMLElement>("[data-act]"); if (act && !(act as HTMLButtonElement).disabled) { e.preventDefault(); Promise.resolve(views.actions[act.dataset.act!]?.(act)).catch((err) => { console.error(err); toast("Something went wrong", "risk"); }); return; }
    if (t.closest("[data-step-back]")) { stepBack?.(); return; }
    if (t.closest("[data-close]")) { closeDrawer(); return; }
    if (t.closest("#new-btn")) { toggleNewMenu(); return; }
    if (t.closest("[data-new-item]")) { document.getElementById("newmenu")!.hidden = true; return; }
    if (!t.closest("#newmenu")) document.getElementById("newmenu")!.hidden = true;
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
  // Radio and checkbox groups drawn as pills keep their own selected state, wherever they appear.
  document.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (!(t instanceof HTMLInputElement) || (t.type !== "radio" && t.type !== "checkbox")) return;
    const pick = t.closest(".pick-chip"); if (pick) { pick.classList.toggle("on", t.checked); return; }
    const group = t.closest(".choice"); if (!group) return;
    if (t.type === "radio") group.querySelectorAll("label").forEach((l) => l.classList.toggle("on", !!l.querySelector<HTMLInputElement>("input")?.checked));
    else t.closest("label")?.classList.toggle("on", t.checked);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (document.getElementById("palette")!.hidden) openPalette(); else closePalette(); return; }
    if (e.key === "Escape") { closePalette(); if (!document.getElementById("drawer")!.hidden) closeDrawer(); }
    // The decision deck: left is "not for this", right is "propose". Only when nothing else has focus.
    const deck = document.querySelector<HTMLElement>(".deck-card");
    if (deck && !document.getElementById("drawer")!.hidden === false && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const t = e.target as HTMLElement;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      e.preventDefault();
      deck.querySelector<HTMLElement>(`[data-act="${e.key === "ArrowRight" ? "deckPropose" : "deckPass"}"]`)?.click();
    }
    const pal = document.getElementById("palette")!;
    if (!pal.hidden) { const inp = pal.querySelector("input") as HTMLInputElement; const items = paletteItems(inp.value); if (e.key === "ArrowDown") { paletteIdx = Math.min(items.length - 1, paletteIdx + 1); renderPalette(inp.value); e.preventDefault(); } if (e.key === "ArrowUp") { paletteIdx = Math.max(0, paletteIdx - 1); renderPalette(inp.value); e.preventDefault(); } if (e.key === "Enter" && items[paletteIdx]) { closePalette(); location.hash = items[paletteIdx].href; } }
  });
  document.getElementById("palette")!.querySelector("input")!.addEventListener("input", (e) => { paletteIdx = 0; renderPalette((e.target as HTMLInputElement).value); });
  window.addEventListener("hashchange", render);
  render();
  if (persist.mode === "local") toast("Changes are saved in this browser", "neutral");
}
boot();
