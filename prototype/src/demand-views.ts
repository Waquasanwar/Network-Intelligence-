/* Demand side of the prototype: requirements & co-pilot, requirement detail, client / agency portal, commercials. */
import type { Person, Account, StoredBrief, ShortlistItem, FeeLine } from "./types";
import type { View, Raw as RawT } from "./app";
import type { Ctx } from "./views";
import type { Brief, Terms, FeeModel, ShortlistDecision, FeeStatus, BriefStatus, AccountKind, RateCard } from "@/lib/demand";

/** Rendering helpers borrowed from views.ts so the two files share one visual language. */
export type H = {
  C: () => Ctx; esc: (s: unknown) => string; raw: (s: string) => RawT; L: () => Record<string, any>;
  badge: (label: string, tone?: string, filled?: boolean) => string; chip: (t: string) => string; card: (title: string | null, body: string, opts?: { desc?: string; action?: string; cls?: string; flush?: boolean }) => string;
  field: (label: string, control: string, hint?: string, req?: boolean) => string; input: (name: string, attrs?: string, value?: string) => string; textarea: (name: string, attrs?: string, value?: string) => string; select: (name: string, options: string, attrs?: string) => string; check: (name: string, label: string, checked?: boolean, value?: string) => string;
  btn: (label: string, attrs?: string, variant?: string) => string; stat: (label: string, value: string | number, hint?: string, href?: string, tone?: string) => string; empty: (title: string, desc?: string, action?: string) => string;
  personLink: (p: Person, sub?: string | null) => string; availBadge: (p: Person) => string; score: (v: number) => string; opt: (entries: Record<string, string>, current?: string | null, blank?: string) => string; rel: (d?: string | null) => string; fmtDate: (d?: string | null) => string; avatar: (p: Person, size?: string, ring?: boolean) => string;
};

const KIND_LABEL: Record<AccountKind, string> = { CLIENT: "Client", AGENCY: "Agency", EXPERT_NETWORK: "Expert network" };
const KIND_TONE: Record<AccountKind, string> = { CLIENT: "navy", AGENCY: "amber", EXPERT_NETWORK: "teal" };
const TIER_LABEL = { meets: "Meets every hard requirement", conversation: "Worth a conversation", stretch: "Stretch" } as const;
const TIER_TONE = { meets: "teal", conversation: "amber", stretch: "neutral" } as const;
const EXAMPLES = [
  "Agency looking for 2 BAs already in Dubai with a visa, perm, retail banking, AED 360k",
  "Client A wants a perm senior project manager in London, £95k, start in January",
  "Fractional CISO 2 days a week for a UAE insurer, £1,200–1,500 per day, 6 months",
  "Expert call: 2 hours on SAP S/4 go-live assurance for a utility, £600/hour, this week",
  "BA or PM",
];

export function demandViews(h: H) {
  const { esc, raw, badge, chip, card, field, input, textarea, select, check, btn, stat, empty, personLink, availBadge, score, opt, rel } = h;
  const C = () => h.C();
  const D = () => C().demand;
  const money = (v: number, cur: string) => D().fmt(v, cur);
  const accountOf = (b: StoredBrief) => C().S().accounts.find((a) => a.id === b.accountId);
  const feesFor = (id: string) => C().S().fees.filter((f) => f.briefId === id);
  const listFor = (id: string) => C().S().shortlist.filter((s) => s.briefId === id);
  const estimateOf = (b: StoredBrief) => D().estimateFee(b, b.terms, C().S().rateCard, b.expertHours ?? null);
  const sumBy = (fees: FeeLine[], statuses: FeeStatus[]) => { const out: Record<string, number> = {}; for (const f of fees) if (statuses.includes(f.status)) out[f.currency] = (out[f.currency] ?? 0) + f.ourTake; return out; };
  const moneyList = (m: Record<string, number>, fallback = "—") => Object.entries(m).map(([c, v]) => money(v, c)).join(" + ") || fallback;
  const routeLabel = (r: string | null) => (r ? h.L().ROUTE_LABELS[r] ?? r : "Route to confirm");

  // ----- pieces -----
  const briefChips = (b: Brief) => `<div class="chips read">${b.roles.map((r) => chip(r)).join("") || chip("role to confirm")}${chip(`${b.headcount} ${b.headcount === 1 ? "person" : "people"}`)}${chip(routeLabel(b.engagementRoute))}${b.locations.length ? chip(`${b.mustBeLocal ? "already in " : ""}${b.locations.join(" / ")}`) : ""}${b.workRights ? chip(b.workRights) : ""}${b.seniority ? chip(h.L().SENIORITY_LABELS[b.seniority]) : ""}${b.sectors.map(chip).join("")}${b.budget ? chip(`${money(b.budget.amount, b.budget.currency)}${b.budget.max ? `–${money(b.budget.max, b.budget.currency)}` : ""}${b.budget.kind === "DAY_RATE" ? "/day" : b.budget.kind === "HOURLY" ? "/hour" : b.budget.kind === "SALARY" ? " salary" : " project"}`) : ""}${b.durationMonths ? chip(`${b.durationMonths} months`) : ""}${b.startBy ? chip(`start ${b.startBy}`) : ""}</div>`;
  const readCard = (b: Brief) => `<div class="how-read"><small class="lbl">How the co-pilot read it</small>${briefChips(b)}${b.assumptions.length ? `<ul class="assume">${b.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}${b.questions.length ? `<div class="note-amber"><small>Still to confirm</small><ul>${b.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul></div>` : ""}</div>`;
  const CHECK_ICON: Record<string, string> = { met: "check", unmet: "cross", unknown: "ask", mid: "near" };
  const checkList = (checks: ShortlistItem["checks"]) => `<ul class="checks-list">${checks.map((c) => `<li class="${c.state}" title="${esc(c.note)}"><i><ni-icon name="${CHECK_ICON[c.state]}" size="11"></ni-icon></i>${esc(c.label)}<small>${esc(c.note)}</small></li>`).join("")}</ul>`;
  const tierBadge = (t: keyof typeof TIER_LABEL) => badge(TIER_LABEL[t], TIER_TONE[t], true);
  const fitList = (fit: { label: string; state: string; note: string }[] | undefined) => (fit && fit.length ? `<ul class="checks-list fit"><li class="lbl-in">Fit</li>${fit.map((c) => { const st = c.state === "strong" ? "met" : c.state === "gap" ? "unmet" : c.state === "moderate" ? "mid" : "unknown"; return `<li class="${st}" title="${esc(c.note)}"><i><ni-icon name="${CHECK_ICON[st]}" size="11"></ni-icon></i>${esc(c.label)}<small>${esc(c.note)}</small></li>`; }).join("")}</ul>` : "");
  const termsForm = (b: StoredBrief) => { const est = estimateOf(b); const acc = accountOf(b)!; return `<form data-action="briefTerms" data-id="${b.id}" class="stack terms"><div class="fee-box ${est.confident ? "" : "unsure"}"><small>Estimated fee to us</small><b>${est.confident ? money(est.ourTake, est.currency) : "—"}</b><span>${esc(est.confident ? `${est.basis}` : est.basis)}${est.confident && b.headcount > 1 ? ` · ${money(est.perHead, est.currency)} per placement` : ""}</span>${est.confident ? `<span class="dim">Paying party spends ${money(est.gross, est.currency)}</span>` : ""}</div>${field("Fee model", select("model", opt(D().FEE_MODEL_LABELS, b.terms.model)), `${KIND_LABEL[acc.kind]} · defaults come from the rate card in Settings`)}<div class="grid-2">${field(b.terms.model === "INTRODUCTION_FEE" ? "Flat fee" : "Our %", input(b.terms.model === "INTRODUCTION_FEE" ? "flat" : "pct", 'type="number" step="0.5" min="0"', String(b.terms.model === "INTRODUCTION_FEE" ? b.terms.flat ?? "" : b.terms.pct ?? "")))}${field("Currency", select("currency", opt({ GBP: "GBP", AED: "AED", SAR: "SAR", USD: "USD", EUR: "EUR" }, b.terms.currency)))}</div>${b.engagementRoute === "ADVISORY" ? field("Expert hours", input("expertHours", 'type="number" min="1"', String(b.expertHours ?? C().S().rateCard.defaultExpertHours))) : ""}${check("termsAccepted", "Terms accepted by the paying party", b.termsAccepted)}<div class="row end"><button class="btn primary sm" type="submit">Save terms</button></div></form>`; };
  const anonEntry = (s: ShortlistItem, revealed: boolean) => { const p = C().person(s.personId)!; const kind = accountOf(C().S().briefs.find((b) => b.id === s.briefId)!)?.kind ?? "CLIENT"; const x = C().redactForPartner({ ...p, tenantId: "t", evidence: C().evOf(p.id), relationships: C().relsOf(p.id) }); const rights = s.checks.find((c) => c.label === "Work rights"); const band = D().rateBand(p.rateExpectation ?? p.salaryExpectation); const tr = C().trustOf(p); const hl = C().fit.fitHighlights(C().fitOf(p)); return `<li class="anon"><div class="row"><span class="row"><code>${esc(x.ref)}</code>${revealed ? `<b>${esc(C().full(p))}</b>` : `<b>${esc(x.headlineSummary || p.headline || "Profile")}</b>`}</span>${badge(D().shortlistLabel(s.decision, kind), s.decision === "CLIENT_PASSED" ? "neutral" : s.decision === "PLACED" || s.decision === "INTRODUCED" ? "teal" : "navy", true)}${s.referred ? '<ni-tag tone="trust" solid icon="referral">referred by hand</ni-tag>' : ""}</div><div class="chips">${chip(x.region ?? "region undisclosed")}${chip(`availability: ${x.availabilityBand}`)}${rights ? chip(`work rights: ${rights.state === "met" ? "confirmed" : rights.state === "unmet" ? "sponsorship needed" : "to confirm"}`) : ""}${band ? chip(band) : ""}${chip(s.tier === "meets" ? "meets the brief" : s.tier === "conversation" ? "one point to confirm" : "stretch")}<ni-tag icon="vouch" solid>vouched by ${tr.vouchedBy}</ni-tag><ni-tag icon="trust" tone="${tr.band === "highly trusted" || tr.band === "trusted" ? "trust" : "neutral"}" solid>${esc(C().trust.TRUST_BAND_LABEL[tr.band].toLowerCase())}</ni-tag>${hl.map((t: string) => chip(t)).join("")}</div><small class="dim">${esc(x.evidenceSummary)}</small>${s.clientNote ? `<small class="dim">Note from us: ${esc(s.clientNote)}</small>` : ""}${(() => { const pi = C().S().pitches.find((z: any) => z.personId === s.personId && z.briefId === s.briefId); return pi ? `<div class="pitch-quote"><small class="lbl">In their own words</small><p>“${esc(pi.note)}”</p>${pi.relevantWork ? `<small class="dim">${esc(pi.relevantWork)}</small>` : ""}<div class="chips">${pi.route ? chip(h.L().ROUTE_LABELS[pi.route] ?? pi.route) : ""}${pi.availableFrom ? chip(`available ${pi.availableFrom}`) : ""}</div></div>` : ""; })()}</li>`; };

  // ----- Requirements list + co-pilot -----
  function requirements(q: URLSearchParams): View {
    const S = C().S(); const kindF = q.get("kind") ?? "";
    const briefs = S.briefs.filter((b) => !kindF || accountOf(b)?.kind === kindF).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const open = S.briefs.filter((b) => !["FILLED", "CLOSED"].includes(b.status));
    const proposed = S.shortlist.filter((s) => D().PORTAL_VISIBLE.includes(s.decision)).length;
    const forecast = sumBy(S.fees, ["FORECAST"]), agreed = sumBy(S.fees, ["AGREED", "INVOICED"]), paid = sumBy(S.fees, ["PAID"]);
    const html = `<div class="page-head"><div><div class="eyebrow">Demand</div><h1>Requirements</h1><p>Clients, agencies and Amana tell us what they need. The co-pilot structures it, you decide who to propose, and the fee is worked out as you go.</p></div><div class="actions">${btn("＋ New account", 'data-act="newAccount"', "glass")}</div></div>
      <section class="card copilot"><div class="body"><form data-action="copilot" class="stack"><div class="copilot-in"><span class="spark">✦</span><textarea name="text" rows="2" placeholder="Describe the need in plain words, e.g. “2 BAs already in Dubai with a visa, perm, retail banking, AED 360k”" aria-label="Describe the requirement">${esc(q.get("q") ?? "")}</textarea><button class="btn primary" type="submit">Ask the co-pilot</button></div><div class="examples"><small>Try</small>${EXAMPLES.map((e) => `<button type="button" class="pill" data-act="copilotExample" data-text="${esc(e)}">${esc(e.length > 46 ? e.slice(0, 44) + "…" : e)}</button>`).join("")}</div></form><div id="copilot-out"></div></div></section>
      <div class="stats-row">${stat("Open requirements", open.length, `${S.briefs.filter((b) => b.submittedVia === "PORTAL").length} came through the portal`)}${stat("Proposed to clients", proposed, "anonymised until introduced")}${stat("Forecast fees", moneyList(forecast), "if the open briefs fill", "#/requirements?tab=fees")}${stat("Agreed & invoiced", moneyList(agreed), undefined, undefined, "teal")}${stat("Paid", moneyList(paid), undefined, undefined, "teal")}</div>
      <div class="pills">${[["", "All"], ["CLIENT", "Clients"], ["AGENCY", "Agencies"], ["EXPERT_NETWORK", "Amana"]].map(([k, l]) => `<a class="pill ${kindF === k ? "active" : ""}" href="#/requirements${k ? `?kind=${k}` : ""}">${l}</a>`).join("")}</div>
      <div class="grid-3"><div class="col-2 stack">${card("Requirements", briefs.length ? `<div class="scroll"><table class="data req-table"><thead><tr><th>Requirement</th><th>Route</th><th>Status</th><th class="num">Fee to us</th></tr></thead><tbody>${briefs.map((b) => { const acc = accountOf(b); const sl = listFor(b.id); const est = estimateOf(b); const proposedN = sl.filter((s) => D().PORTAL_VISIBLE.includes(s.decision)).length; return `<tr><td><a href="#/requirements/${b.id}"><b>${esc(b.title)}</b></a><small class="sub">${acc ? `${badge(KIND_LABEL[acc.kind], KIND_TONE[acc.kind], true)} ${esc(acc.name)}` : ""}${b.submittedVia === "PORTAL" ? " · via portal" : ""} · ${esc(rel(b.updatedAt))}</small></td><td>${esc(routeLabel(b.engagementRoute))}${b.headcount > 1 ? ` × ${b.headcount}` : ""}<small class="sub">${esc(b.locations[0] ?? "location to confirm")}${b.mustBeLocal ? " · already there" : ""}${b.workRights ? " · visa" : ""}</small></td><td>${badge(D().BRIEF_STATUS_LABELS[b.status], ["FILLED"].includes(b.status) ? "teal" : ["CLOSED"].includes(b.status) ? "neutral" : "navy")}<small class="sub">${sl.length ? `${sl.filter((s) => s.tier === "meets").length} meet the brief · ${proposedN} proposed` : "not searched yet"}</small></td><td class="num nowrap">${est.confident ? `<b>${money(est.ourTake, est.currency)}</b><small class="sub">${esc(D().FEE_MODEL_LABELS[b.terms.model].split(" (")[0])}</small>` : '<span class="dim">needs a budget</span>'}</td></tr>`; }).join("")}</tbody></table></div>` : empty("No requirements yet", "Ask the co-pilot above, then save the brief against a client, agency or Amana."), { flush: true, desc: "Every brief, who it is from, and what it is worth if it fills." })}</div>
      <div class="stack">${card("Fee pipeline", S.fees.length ? `<ul class="rows">${S.fees.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8).map((f) => { const b = S.briefs.find((x) => x.id === f.briefId); const acc = S.accounts.find((a) => a.id === f.accountId); return `<li class="col"><div class="row"><b>${esc(money(f.ourTake, f.currency))}</b>${badge(D().FEE_STATUS_LABELS[f.status], f.status === "PAID" ? "teal" : f.status === "FORECAST" ? "neutral" : "navy", true)}</div><small class="dim">${esc(acc?.name ?? "")} · <a href="#/requirements/${f.briefId}">${esc(b?.title ?? "requirement")}</a>${f.personId ? ` · ${esc(C().full(C().person(f.personId)!))}` : ""}</small><small class="dim">${esc(f.basis)}</small></li>`; }).join("")}</ul>` : '<span class="dim">Fees appear as briefs are saved and people are placed.</span>', { desc: "Our revenue: forecast, agreed, invoiced, paid." })}
      ${card("Accounts", `<ul class="rows">${S.accounts.map((a) => `<li><span><b class="t">${esc(a.name)}</b><small class="sub">${esc(KIND_LABEL[a.kind])} · ${S.briefs.filter((b) => b.accountId === a.id).length} requirements${a.monthlyFee ? ` · ${money(a.monthlyFee, a.currency)}/mo access` : ""}</small></span>${badge(a.status.toLowerCase(), a.status === "ACTIVE" ? "teal" : "amber")}</li>`).join("")}</ul>`, { desc: "Who pays, and on what terms.", action: btn("Rate card", 'data-act="goCommercials"', "ghost sm") })}</div></div>`;
    return { title: "Requirements", crumbs: [["Requirements"]], html: raw(html), after: () => { const t = q.get("q"); if (t) runCopilot(t); } };
  }

  function runCopilot(text: string) {
    const S = C().S(); const out = document.getElementById("copilot-out"); if (!out) return;
    const brief: Brief = D().parseBrief(text);
    const results = D().matchBrief(brief, S.people.map((p) => C().toBriefPerson(p)), 10);
    const groups = (["meets", "conversation", "stretch"] as const).map((t) => ({ t, rows: results.filter((r: any) => r.tier === t) })).filter((g) => g.rows.length);
    const kindHint: AccountKind | null = /\b(agency|recruiter|agencies)\b/i.test(text) ? "AGENCY" : /\b(amana|expert call|expert network|sow|proposal|bid)\b/i.test(text) ? "EXPERT_NETWORK" : /\b(client|we want|we need)\b/i.test(text) ? "CLIENT" : null;
    const named = S.accounts.find((a) => text.toLowerCase().includes(a.name.toLowerCase().split(" ·")[0].toLowerCase()));
    const defaultAcc = named ?? S.accounts.find((a) => a.kind === kindHint) ?? S.accounts.find((a) => a.kind === "CLIENT") ?? S.accounts[0];
    out.innerHTML = `<div class="copilot-result"><div class="grid-3"><div class="col-2 stack">${readCard(brief)}
      <div class="sect-head"><div><h2>${results.length ? `${results.length} people worth looking at` : "No one obvious yet"}</h2><p>Retrieved for this brief only. Hard requirements are checked and labelled, never used to hide anyone. You decide who to propose.</p></div></div>
      ${groups.map((g) => `<div class="tier-group"><div class="tier-head">${tierBadge(g.t)}<small>${g.rows.length}</small></div>${g.rows.map((r: any) => { const p = C().person(r.match.personId)!; return `<section class="card match compact"><div class="body"><div class="row">${personLink(p)}<span class="meta">${C().S().vouches.some((v: any) => v.personId === p.id) ? badge(`vouched by ${C().trustOf(p).vouchedBy}`, "teal", true) : ""}${availBadge(p)}<span class="fit">${score(r.match.fitScore)}</span></span></div>${checkList(r.checks)}${fitList(r.fit)}<p class="dim">${esc(r.match.fitExplanation)}</p></div></section>`; }).join("")}</div>`).join("") || empty("Nothing retrieved", "Add capabilities or a location to the brief, or import more of your network.")}</div>
      <div class="stack"><form data-action="saveBrief" class="card save-brief"><div class="body stack"><h3>Save as a requirement</h3><p class="dim">Attach it to who is paying. The fee model is chosen from the route and the account type; you can change it.</p><input type="hidden" name="text" value="${esc(text)}">${field("Account", select("accountId", opt(Object.fromEntries(S.accounts.map((a) => [a.id, `${a.name} · ${KIND_LABEL[a.kind]}`])), defaultAcc?.id)), undefined, true)}${field("Title", input("title", "", brief.title))}<div id="save-terms">${saveTerms(brief, defaultAcc)}</div><button class="btn primary" type="submit">Save requirement</button></div></form></div></div></div>`;
    out.querySelector<HTMLSelectElement>("select[name=accountId]")?.addEventListener("change", (e) => { const acc = S.accounts.find((a) => a.id === (e.target as HTMLSelectElement).value); document.getElementById("save-terms")!.innerHTML = saveTerms(brief, acc); });
    out.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }
  function saveTerms(brief: Brief, acc?: Account) {
    if (!acc) return "";
    const model: FeeModel = D().defaultFeeModel(brief.engagementRoute, acc.kind); const terms: Terms = { ...D().defaultTerms(C().S().rateCard, model), ...(acc.terms ?? {}) };
    const est = D().estimateFee(brief, terms, C().S().rateCard, null);
    return `<div class="fee-box ${est.confident ? "" : "unsure"}"><small>Estimated fee to us</small><b>${est.confident ? money(est.ourTake, est.currency) : "—"}</b><span>${esc(D().FEE_MODEL_LABELS[model])}${terms.pct ? ` · ${terms.pct}%` : ""}</span><span class="dim">${esc(est.basis)}</span></div>`;
  }

  // ----- Requirement detail -----
  function requirement(id: string): View {
    const S = C().S(); const b = S.briefs.find((x) => x.id === id);
    if (!b) return { title: "Not found", crumbs: [["Requirements", "#/requirements"], ["Not found"]], html: raw(empty("Requirement not found")) };
    const acc = accountOf(b)!; const sl = listFor(id).sort((a, c) => ({ meets: 0, conversation: 1, stretch: 2 }[a.tier] - { meets: 0, conversation: 1, stretch: 2 }[c.tier]) || c.fitScore - a.fitScore);
    const visible = sl.filter((s) => D().PORTAL_VISIBLE.includes(s.decision)); const fees = feesFor(id);
    const audit = S.audit.filter((a) => a.entityId === id).slice(0, 8);
    const html = `<div class="page-head"><div><div class="eyebrow">${esc(KIND_LABEL[acc.kind])} · ${esc(acc.name)}</div><h1>${esc(b.title)}</h1><p class="meta">${badge(routeLabel(b.engagementRoute), "navy")}${badge(D().BRIEF_STATUS_LABELS[b.status], "navy")}${b.submittedVia === "PORTAL" ? badge("submitted via portal", "amber", true) : ""}${b.termsAccepted ? badge("terms accepted", "teal", true) : badge("terms not yet accepted", "amber", true)}<span class="dim">· ${esc(rel(b.createdAt))}</span></p></div><form class="actions" data-action="briefStatus" data-id="${id}"><select name="status">${opt(D().BRIEF_STATUS_LABELS, b.status)}</select><button class="btn glass" type="submit">Set status</button>${btn("Edit brief", `data-act="editBrief" data-id="${id}"`, "glass")}</form></div>
      <div class="grid-3"><div class="col-2 stack">${card("The brief", `<blockquote class="quote">${esc(b.rawText)}</blockquote>${briefChips(b)}<dl class="kv four"><div><dt>Roles</dt><dd>${esc(b.roles.join(", ") || "to confirm")}</dd></div><div><dt>Headcount</dt><dd>${b.headcount}</dd></div><div><dt>Where</dt><dd>${esc(b.locations.join(" / ") || "—")}${b.mustBeLocal ? '<small class="sub">must already be there</small>' : ""}</dd></div><div><dt>Work rights</dt><dd>${esc(b.workRights ?? "not required")}</dd></div><div><dt>Seniority</dt><dd>${esc(b.seniority ? h.L().SENIORITY_LABELS[b.seniority] : "—")}</dd></div><div><dt>Sectors</dt><dd>${esc(b.sectors.join(", ") || "—")}</dd></div><div><dt>Budget</dt><dd>${b.budget ? `${money(b.budget.amount, b.budget.currency)}${b.budget.max ? `–${money(b.budget.max, b.budget.currency)}` : ""} ${b.budget.kind === "DAY_RATE" ? "per day" : b.budget.kind === "HOURLY" ? "per hour" : b.budget.kind === "SALARY" ? "salary" : "project"}` : "—"}</dd></div><div><dt>Start · duration</dt><dd>${esc(b.startBy ?? "—")}${b.durationMonths ? ` · ${b.durationMonths} months` : ""}</dd></div></dl>${b.questions.length ? `<div class="note-amber"><small>Still to confirm with ${esc(acc.name)}</small><ul>${b.questions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}`, { desc: "What was asked, in their words and in structure." })}
        <div class="sect-head"><div><h2>Shortlist</h2><p>Retrieved for this brief only. Hard requirements are checked and labelled. Only people you mark as proposed appear in the portal, anonymised.</p></div>${btn(sl.length ? "↻ Refresh" : "✦ Find people", `data-act="findForBrief" data-id="${id}"`, sl.length ? "glass" : "primary")}</div>
        ${sl.length ? sl.map((s) => { const p = C().person(s.personId)!; return `<section class="card match ${["PROPOSED", "CLIENT_INTERESTED", "INTRODUCED", "PLACED"].includes(s.decision) ? "rec" : s.decision === "NOT_FOR_THIS" || s.decision === "CLIENT_PASSED" ? "dimmed" : ""}"><div class="body"><div class="row">${personLink(p)}<span class="meta">${tierBadge(s.tier)}<ni-tag icon="vouch" tone="${C().trustOf(p).vouchedBy ? "trust" : "neutral"}" solid>vouched by ${C().trustOf(p).vouchedBy}</ni-tag><ni-tag icon="trust" tone="${C().trustOf(p).score >= 60 ? "trust" : C().trustOf(p).score >= 35 ? "neutral" : "alert"}" solid>trust ${C().trustOf(p).score}</ni-tag>${availBadge(p)}${badge(D().SHORTLIST_LABELS[s.decision], s.decision === "PLACED" ? "teal" : "navy")}</span></div>${checkList(s.checks)}${fitList(C().fit.fitChecks(b.fitTraits ?? [], C().fitOf(p)))}<div class="dims">${s.dimensions.slice(0, 5).map((d) => `<div><small>${esc(d.name)}</small>${score(d.score)}</div>`).join("")}</div><p>${esc(s.fitExplanation)}</p>${s.uncertainty.length ? `<div class="note-amber"><small>Uncertainty</small><ul>${s.uncertainty.map((u) => `<li>${esc(u)}</li>`).join("")}</ul></div>` : ""}<form class="decide" data-action="decideShortlist" data-id="${s.id}">${field("Decision", select("decision", opt(D().SHORTLIST_LABELS, s.decision)))}${field("Note for the client (anonymised card)", input("clientNote", 'placeholder="Why this person, in a sentence they can read."', s.clientNote ?? ""))}<button class="btn glass" type="submit">Save</button></form></div></section>`; }).join("") : empty("No shortlist yet", "Find people for this brief. Nothing is shared until you propose someone.")}</div>
      <div class="stack">${card("Private to you", `<p class="dim">Requirements are only ever seen by you and your team. Clients see their own; members see only what you open to them, without the client's name.</p><form data-action="briefMembers" data-id="${id}" class="stack">${check("openToMembers", "Open to network members (anonymised)", !!b.openToMembers)}${field("What members see", textarea("memberSummary", 'rows="3" placeholder="The need in plain words, no client name."', b.memberSummary ?? ""))}<div class="row end"><button class="btn glass sm" type="submit">Save</button></div></form>${(() => { const ps = S.pitches.filter((x) => x.briefId === id); const rs = S.referrals.filter((x) => x.briefId === id); return ps.length || rs.length ? `<small class="lbl">From members</small><ul class="rows">${ps.map((x) => `<li><span>${personLink(C().person(x.personId)!, null)}<small class="sub">pitched · ${esc(x.status.toLowerCase())}</small></span><a class="btn ghost sm" href="#/referrals?tab=pitches">Review</a></li>`).join("")}${rs.map((x) => `<li><span><b class="t">${esc(x.name)}</b><small class="sub">referred by ${esc(C().userName(x.referrerPersonId))} · ${esc(x.status.toLowerCase())}</small></span><a class="btn ghost sm" href="#/referrals">Review</a></li>`).join("")}</ul>` : ""; })()}`, { desc: "Who can see this requirement." })}
      ${card("Commercials", termsForm(b), { desc: `Who pays: ${acc.name}. Change the model or the % here for this brief only.` })}
        ${card("Fees on this requirement", fees.length ? fees.map((f) => `<div class="intro"><div class="row"><b>${esc(money(f.ourTake, f.currency))}</b>${badge(D().FEE_STATUS_LABELS[f.status], f.status === "PAID" ? "teal" : "navy", true)}</div><small class="dim">${f.personId ? esc(C().full(C().person(f.personId)!)) + " · " : ""}${esc(f.basis)}</small><form class="row wrap" data-action="feeStatus" data-id="${f.id}"><select name="status" class="sm">${opt(D().FEE_STATUS_LABELS, f.status)}</select><button class="btn glass sm" type="submit">Update</button></form></div>`).join("") : '<span class="dim">A fee line is created when someone is placed, or add one now.</span>', { action: btn("＋ Fee line", `data-act="addFee" data-id="${id}"`, "ghost sm") })}
        ${card("What the client sees", visible.length ? `<ul class="rows anon-list">${visible.map((s) => anonEntry(s, ["INTRODUCED", "PLACED"].includes(s.decision))).join("")}</ul><a class="olink" href="#/portal?account=${acc.id}">Open the portal as ${esc(acc.name)} →</a>` : `<span class="dim">Nothing yet. Mark someone as <b>Proposed to client</b> and an anonymised card appears here and in their portal.</span>`, { desc: "Anonymised. Names only after introduction and consent." })}
        ${card("Activity", audit.length ? `<ul class="log">${audit.map((a) => `<li><small>${esc(rel(a.createdAt))} · ${esc(C().userName(a.actorId))}</small><code>${esc(a.action)}</code> ${esc(a.detail ?? "")}</li>`).join("")}</ul>` : '<span class="dim">No activity yet.</span>')}</div></div>`;
    return { title: b.title, crumbs: [["Requirements", "#/requirements"], [b.title]], html: raw(html) };
  }

  // ----- Client / agency portal -----
  function portal(q: URLSearchParams): View {
    const S = C().S(); const accounts = S.accounts.filter((a) => a.portalEnabled);
    const va = S.viewAs; const forced = va.role === "AGENCY" || va.role === "CLIENT" ? accounts.find((a) => a.id === va.accountId) : undefined;
    const acc = forced ?? accounts.find((a) => a.id === q.get("account")) ?? accounts[0];
    if (!acc) return { title: "Portal", crumbs: [["Client & agency portal"]], html: raw(empty("No portal accounts", "Enable the portal on an account in Requirements.")) };
    const agency = acc.kind === "AGENCY"; const rc = S.rateCard;
    const mine = S.briefs.filter((b) => b.accountId === acc.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const open = mine.filter((b) => !["FILLED", "CLOSED"].includes(b.status));
    const proposed = S.shortlist.filter((s) => mine.some((b) => b.id === s.briefId) && D().PORTAL_VISIBLE.includes(s.decision));
    const asked = proposed.filter((s) => s.decision === "CLIENT_INTERESTED");
    const introduced = proposed.filter((s) => ["INTRODUCED", "PLACED"].includes(s.decision));
    const placed = proposed.filter((s) => s.decision === "PLACED");
    const fees = S.fees.filter((f) => f.accountId === acc.id);
    const termsText = (b: StoredBrief) => { const t = b.terms; switch (t.model) { case "PERM_PCT": return `Success fee of ${t.pct}% of first-year base salary, invoiced on start date.`; case "AGENCY_REFERRAL": return `Referral share of ${t.pct}% of your placement fee (assumed ${rc.agencyPermPct}% of salary), invoiced when your client pays.`; case "CONTRACT_MARGIN": return `${t.pct}% of the billed day rate for the length of the engagement.`; case "AGENCY_CONTRACT_SHARE": return `${t.pct}% of your margin on the day rate for the length of the engagement.`; case "EXPERT_HOURLY": return `${t.pct}% platform take on the expert's hourly rate; the expert receives the rest.`; case "SOW_SHARE": return `${t.pct}% of the SOW value for people we bring to the team.`; default: return `Flat introduction fee of ${money(t.flat ?? 0, t.currency)} per introduction.`; } };
    const ctaLabel = agency ? "Put this person to my client" : "Ask to interview this person";
    const waitLabel = agency ? "Asked. We check with them, then you can take them to your client." : "Interview requested. We are asking them, and we will come back with a time";

    // The hero: same structure, different audience. A client is hiring; an agency is filling someone else's role.
    const stats = agency
      ? [["Live requirements", open.length, "open with us"], ["People you can place", proposed.length, "anonymised"], ["With your client", asked.length + introduced.length, "asked or introduced"], ["Placed", placed.length, "through us"]] as const
      : [["Open roles", open.length, "with us"], ["People proposed", proposed.length, "anonymised"], ["Interviews requested", asked.length, "we are asking them"], ["Hires", placed.length, "started"]] as const;
    const hero = `<div class="portal-hero"><div><div class="eyebrow">${forced ? `${KIND_LABEL[acc.kind]} portal` : `${KIND_LABEL[acc.kind]} portal · viewing as`}</div>${forced ? "" : `<form class="row wrap switcher" data-action="portalSwitch"><select name="account" class="lg">${opt(Object.fromEntries(accounts.map((a) => [a.id, `${a.name} · ${KIND_LABEL[a.kind]}`])), acc.id)}</select><button class="btn glass sm" type="submit">Switch</button></form>`}<h1>${esc(acc.name)}</h1><p>${agency ? "Requirements you are working on, and people from our network you can put in front of your client. Names stay with us until they agree to be introduced — so the relationship, and the fee, are protected on both sides." : "The roles you have with us, and the people we would put in front of you. Every card is someone a person in our network has worked with. Names come with their consent, and you pay only when someone starts."}</p></div>
      <div class="hero-stats">${stats.map(([l, v, h]) => `<div class="stat"><small>${esc(l)}</small><b data-count="${v}">0</b><span>${esc(h)}</span></div>`).join("")}</div></div>`;

    // Right column: an agency wants the commercial split; a client wants the pipeline.
    const howClient = `<ol class="steps-list"><li><b>Tell us the role</b> in plain words. We structure it and confirm anything unclear.</li><li><b>We look at people we know</b>, not a database. Every card is someone in our network has seen deliver.</li><li><b>You see anonymised cards</b>: capability, region, availability, work rights, rate band, trust.</li><li><b>Ask to interview someone.</b> We ask them first. You get a name only when they say yes.</li><li><b>You pay on success</b> — nothing until someone starts.</li></ol>`;
    const howAgency = `<ol class="steps-list"><li><b>Send us the live requirement</b> you are working, with the fee you charge your client.</li><li><b>We propose people we know</b>, anonymised, with the hard requirements already checked.</li><li><b>You take them to your client</b> once the person agrees to be introduced.</li><li><b>You keep the client relationship.</b> We never approach them.</li><li><b>We invoice our share</b> when your client pays you. No placement, no fee.</li></ol>`;
    const split = (() => { const perm = rc.agencyPermPct, share = rc.agencyReferralSharePct; const keep = Math.round((100 - share) * 10) / 10; return `<div class="wash-tile split"><div><small>Your fee</small><b>${perm}%</b><span>of first-year salary, charged to your client</span></div><div class="arrow"><ni-icon name="arrow" size="16"></ni-icon></div><div><small>Our share</small><b class="accent-text">${share}%</b><span>of your fee, when your client pays</span></div><div class="arrow"><ni-icon name="arrow" size="16"></ni-icon></div><div><small>You keep</small><b>${keep}%</b><span>of your fee, and the client</span></div></div><ul class="rows tight"><li><span>Contract and interim</span><small class="dim">${rc.agencyContractSharePct}% of your margin, for the length of the engagement</small></li><li><span>Access</span><small class="dim">${acc.monthlyFee ? `${money(acc.monthlyFee, acc.currency)} a month` : "no access fee on your account"}</small></li><li><span>If nothing places</span><small class="dim">You pay nothing. Ever.</small></li></ul>`; })();
    const pipe = (() => { const stages: [string, number, string][] = [["Proposed", proposed.length - asked.length - introduced.length, "waiting on you"], ["You asked", asked.length, "we are asking them"], ["Introduced", introduced.length - placed.length, "names shared"], ["Started", placed.length, "invoiced on start"]]; return `<div class="pipe">${stages.map(([l, n, h]) => `<div class="${n > 0 ? "on" : ""}"><b>${Math.max(0, n)}</b><small>${esc(l)}</small><span>${esc(h)}</span></div>`).join("")}</div>`; })();
    const invoices = fees.length ? `<ul class="rows">${fees.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map((f) => { const b = mine.find((x) => x.id === f.briefId); return `<li><span><b class="t">${esc(money(f.ourTake, f.currency))}</b><small class="sub">${esc(b?.title ?? "requirement")}${f.personId ? " · one person" : ""}</small></span><ni-tag icon="money" tone="${f.status === "PAID" ? "trust" : f.status === "FORECAST" ? "neutral" : "alert"}" solid>${esc(D().FEE_STATUS_LABELS[f.status])}</ni-tag></li>`; }).join("")}</ul>` : '<span class="dim">Nothing yet. A fee line appears here the moment someone is placed.</span>';

    const side = agency
      ? `${card("How this works", howAgency, { cls: "accent" })}${card("The split, in plain numbers", split, { desc: "What you charge, what we take, what you keep." })}${card("Our invoices to you", invoices, { desc: "Only ever on a placement." })}${card("What you can and cannot see", `<div class="grid-2 boundary"><div><b class="ok">Can</b><ul><li>Your own requirements</li><li>Anonymised capability cards</li><li>Availability and work rights</li><li>Rate or salary band</li><li>Ask us to introduce someone</li></ul></div><div><b class="bad">Cannot</b><ul><li>Any name until they agree</li><li>How we know them</li><li>Who else is in the network</li><li>Other agencies' requirements</li><li>Export anything</li></ul></div></div>`, { desc: "The boundary works both ways: we never approach your client either." })}`
      : `${card("How this works", howClient, { cls: "accent" })}${card("Your pipeline", pipe, { desc: "Where every person we proposed has got to." })}${card("What you pay", `<div class="wash-tile"><small class="lbl" style="margin-top:0">Permanent</small><b class="big">${rc.permPct}%</b><span class="dim">of first-year base salary, invoiced on the start date</span></div><ul class="rows tight"><li><span>Contract and interim</span><small class="dim">${rc.contractMarginPct}% of the billed day rate</small></li><li><span>Expert calls</span><small class="dim">${money(rc.introductionFee, rc.currency)} per introduction, or hourly</small></li><li><span>If nobody starts</span><small class="dim">You pay nothing. There is no retainer.</small></li></ul>`, { desc: "On success only. The terms on each role below are what count." })}${card("What you can and cannot see", `<div class="grid-2 boundary"><div><b class="ok">Can</b><ul><li>Your own roles</li><li>Anonymised capability cards</li><li>Availability and work rights</li><li>Rate or salary band</li><li>Ask to interview someone</li></ul></div><div><b class="bad">Cannot</b><ul><li>Any name until they consent</li><li>How we know them</li><li>Who else is in the network</li><li>Other clients' roles</li><li>Export anything</li></ul></div></div>`, { desc: "Their privacy is the reason they are here." })}`;

    const submit = card(agency ? "Send us a live requirement" : "Tell us about a role", `<form data-action="portalSubmit" data-account="${acc.id}" class="stack"><div class="copilot-in"><span class="spark">✦</span><textarea name="text" rows="2" placeholder="${esc(agency ? "e.g. We need 2 BAs already in Dubai with a visa, perm, retail banking, AED 360k — our client pays 20%" : acc.kind === "CLIENT" ? "e.g. We want a permanent senior project manager for our digital programme, London, £95k, start January" : "e.g. Expert call: 2 hours on SAP S/4 go-live assurance for a utility, this week")}" aria-label="Describe your requirement"></textarea><button class="btn glass" type="button" data-act="portalPreview">Preview</button></div><div id="portal-read"></div><div class="row"><small class="dim">${agency ? "You will see how we read it before it is sent. We come back with people we genuinely know." : "You will see how we read it before it is sent. We come back with people we genuinely know, not a database search."}</small><button class="btn primary" type="submit">Send${agency ? " requirement" : " role"}</button></div></form>`, { desc: "Plain words are fine. We will confirm anything unclear." });

    const briefCards = mine.length ? mine.map((b) => { const items = S.shortlist.filter((s) => s.briefId === b.id && D().PORTAL_VISIBLE.includes(s.decision)); return card(b.title, `${briefChips(b)}${b.questions.length && b.status !== "FILLED" ? `<div class="note-amber"><small>We will confirm with you</small><ul>${b.questions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}<div class="terms-line"><b>${agency ? "Our share" : "Terms"}</b> ${esc(termsText(b))} ${b.termsAccepted ? badge("accepted", "teal", true) : btn("Accept terms", `data-act="acceptTerms" data-id="${b.id}"`, "primary sm")}</div><small class="lbl">${agency ? "People you can place" : "People we propose"}</small>${items.length ? `<ul class="rows anon-list">${items.map((s) => `${anonEntry(s, ["INTRODUCED", "PLACED"].includes(s.decision))}${s.decision === "PROPOSED" ? `<li class="row portal-actions">${btn(ctaLabel, `data-act="portalInterest" data-id="${s.id}"`, "primary sm")}${btn("Not for us", `data-act="portalPass" data-id="${s.id}"`, "ghost sm")}<small class="dim">Their name stays hidden. We ask them first.</small></li>` : s.decision === "CLIENT_INTERESTED" ? `<li class="row portal-actions"><small class="dim">${esc(waitLabel)}${b.termsAccepted ? "" : ". Accept the terms above so we can proceed"}.</small></li>` : ""}`).join("")}</ul>` : `<span class="dim">${b.status === "NEW" ? "Received. We are reading it now." : "Searching the network. You will see anonymised cards here first."}</span>`}`, { desc: `${D().BRIEF_STATUS_LABELS[b.status]} · sent ${rel(b.createdAt)}` }); }).join("") : empty(agency ? "No requirements yet" : "No roles yet", "Send your first one above.");

    const html = `${hero}<div class="grid-3"><div class="col-2 stack">${submit}${briefCards}</div><div class="stack">${side}</div></div>`;
    return { title: `Portal · ${acc.name}`, crumbs: [[agency ? "Agency portal" : "Client portal"], [acc.name]], html: raw(html) };
  }

  // ----- Commercials (settings) -----
  function commercialsCard(): string {
    const rc: RateCard = C().S().rateCard;
    const f = (name: keyof RateCard, label: string, hint?: string) => field(label, input(name, 'type="number" step="0.5" min="0"', String(rc[name])), hint);
    return card("Commercials · rate card", `<form data-action="saveRateCard" class="stack"><p class="dim">Defaults for every new requirement. Each account or brief can override them. Nothing here is hard-coded.</p><small class="lbl">Permanent</small><div class="grid-2">${f("permPct", "Direct client success fee %", "of first-year base salary")}${f("agencyPermPct", "Agency's own fee %", "what the agency charges its client")}${f("agencyReferralSharePct", "Our share of the agency fee %", "referral share on perm placements")}</div><small class="lbl">Contract · interim · fractional</small><div class="grid-2">${f("contractMarginPct", "Direct client margin %", "of the billed day rate")}${f("agencyContractMarginPct", "Agency's margin %", "on the day rate")}${f("agencyContractSharePct", "Our share of the agency margin %")}${f("workingDaysPerYear", "Working days per year")}</div><small class="lbl">Advisory · Amana</small><div class="grid-2">${f("expertHourlyTakePct", "Expert call take %", "platform share of the hourly rate")}${f("defaultExpertHours", "Default expert hours")}${f("sowSharePct", "SOW share %", "of SOW value for people we supply")}${f("introductionFee", "Flat introduction fee")}</div>${field("Currency", select("currency", opt({ GBP: "GBP", AED: "AED", SAR: "SAR", USD: "USD", EUR: "EUR" }, rc.currency)))}<div class="row end"><button class="btn primary" type="submit">Save rate card</button></div></form>`, { desc: "How we charge clients, agencies and Amana." });
  }

  // ----- Referrals made on someone's behalf (person profile) -----
  /** Every client and agency this person has been put in front of, with the fee that rides on it. Owner view only. */
  function referredCard(p: Person): string {
    const S = C().S();
    const mine = S.shortlist.filter((s) => s.personId === p.id && (s.referred || D().PORTAL_VISIBLE.includes(s.decision))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const body = mine.length ? `<ul class="refer-list">${mine.map((s) => {
      const b = S.briefs.find((x) => x.id === s.briefId); if (!b) return "";
      const acc = accountOf(b); const fee = S.fees.find((f) => f.briefId === b.id && f.personId === p.id);
      const est = D().estimateFee({ ...b, headcount: 1 }, b.terms, S.rateCard, b.expertHours ?? null);
      return `<li><div class="row"><span class="row gap-sm"><ni-icon name="${acc?.kind === "AGENCY" ? "brief" : "person"}" size="14" tone="mute"></ni-icon><b class="t">${esc(acc?.name ?? "account")}</b></span><ni-tag tone="${s.decision === "PLACED" || s.decision === "INTRODUCED" ? "trust" : s.decision === "CLIENT_PASSED" ? "neutral" : "alert"}" solid>${esc(D().shortlistLabel(s.decision, acc?.kind ?? "CLIENT"))}</ni-tag></div><small class="sub"><a href="#/requirements/${b.id}">${esc(b.title)}</a> · ${esc(routeLabel(b.engagementRoute))} · ${esc(rel(s.updatedAt))}</small><div class="row fee-row"><span class="row gap-sm"><ni-icon name="money" size="14" tone="${fee ? "trust" : "mute"}"></ni-icon><b>${esc(fee ? money(fee.ourTake, fee.currency) : est.confident ? money(est.ourTake, est.currency) : "fee to agree")}</b></span><small class="dim">${esc(fee ? D().FEE_STATUS_LABELS[fee.status].toLowerCase() : est.confident ? "estimated, no line yet" : est.basis)}</small></div>${s.clientNote ? `<small class="dim">“${esc(s.clientNote)}”</small>` : ""}</li>`;
    }).join("")}</ul>` : '<span class="dim">Not yet put forward to anyone. Refer them and the client or agency sees an anonymised card.</span>';
    return card("Referred to", body, { desc: "Perm or contract. They see the card, never the name — the fee is agreed with us.", action: btn("Refer", `data-act="referToAccount" data-id="${p.id}"`, "glass sm") });
  }

  /**
   * Adding a client or an agency, as one flow rather than a form and then some settings you have
   * to go and find: who they are, how we get paid, and then their first requirement — which is the
   * only reason the account exists. Each step saves as you go, so nothing is lost if you stop.
   */
  function accountFlow(kind: AccountKind) {
    const S = C().S(); const rc = S.rateCard;
    const agency = kind === "AGENCY";
    const draft: { id: string; name: string; contactName: string; contactEmail: string; currency: string; monthlyFee: number | null; model: FeeModel; pct: number; portal: boolean } = {
      id: C().uid(), name: "", contactName: "", contactEmail: "", currency: agency ? "AED" : rc.currency, monthlyFee: null,
      model: agency ? "AGENCY_REFERRAL" : "PERM_PCT", pct: agency ? rc.agencyReferralSharePct : rc.permPct, portal: true,
    };

    const step1 = () => {
      C().setStepBack(null);
      C().setDrawerStep(agency ? "Add an agency" : "Add a client", agency ? "An agency places our people with their own clients and shares the fee." : "A client hires directly and pays us on success.", raw(
        `${field("Name", input("name", 'required placeholder="' + (agency ? "Gulf Talent Partners" : "Meridian Energy") + '"', draft.name), agency ? "As you would say it to them" : undefined, true)}
         <div class="grid-2">${field("Who you deal with", input("contactName", "", draft.contactName))}${field("Their email", input("contactEmail", 'type="email"', draft.contactEmail))}</div>
         ${field("Currency", select("currency", opt({ GBP: "GBP", AED: "AED", SAR: "SAR", USD: "USD", EUR: "EUR" }, draft.currency)), "What you will invoice them in")}
         <div class="wash-tile"><b>${agency ? "They keep the client. We share the fee." : "They pay only when someone starts."}</b><span class="dim">${agency ? "We never approach an agency's client. Their name stays hidden from our experts, and our experts' names stay hidden from them until an introduction is agreed." : "No retainer, no list access. A fee on a start, on the terms you set next."}</span></div>`
      ), (fd: FormData) => {
        draft.name = String(fd.get("name") || "").trim();
        if (!draft.name) { C().toast("Give them a name", "amber"); return; }
        draft.contactName = String(fd.get("contactName") || ""); draft.contactEmail = String(fd.get("contactEmail") || ""); draft.currency = String(fd.get("currency"));
        step2();
      }, { submitLabel: "Continue", step: [0, 3] });
    };

    const step2 = () => {
      C().setStepBack(step1);
      const models: Record<string, string> = agency
        ? { AGENCY_REFERRAL: D().FEE_MODEL_LABELS.AGENCY_REFERRAL, AGENCY_CONTRACT_SHARE: D().FEE_MODEL_LABELS.AGENCY_CONTRACT_SHARE, INTRODUCTION_FEE: D().FEE_MODEL_LABELS.INTRODUCTION_FEE }
        : { PERM_PCT: D().FEE_MODEL_LABELS.PERM_PCT, CONTRACT_MARGIN: D().FEE_MODEL_LABELS.CONTRACT_MARGIN, EXPERT_HOURLY: D().FEE_MODEL_LABELS.EXPERT_HOURLY, SOW_SHARE: D().FEE_MODEL_LABELS.SOW_SHARE, INTRODUCTION_FEE: D().FEE_MODEL_LABELS.INTRODUCTION_FEE };
      const example = agency
        ? `On a ${money(360000, draft.currency)} salary, an agency fee of ${rc.agencyPermPct}% is ${money(360000 * rc.agencyPermPct / 100, draft.currency)}. Our ${draft.pct}% of that is <b>${money(360000 * rc.agencyPermPct / 100 * draft.pct / 100, draft.currency)}</b>.`
        : `On a ${money(120000, draft.currency)} salary, ${draft.pct}% is <b>${money(120000 * draft.pct / 100, draft.currency)}</b>, invoiced on the start date.`;
      C().setDrawerStep("How we get paid", "The default for every requirement on this account. Any single requirement can override it.", raw(
        `${field("Fee model", select("model", opt(models, draft.model)))}
         <div class="grid-2">${field("Our %", input("pct", 'type="number" step="0.5" min="0"', String(draft.pct)))}${agency ? field("Monthly access fee", input("monthlyFee", 'type="number" min="0"', draft.monthlyFee ? String(draft.monthlyFee) : ""), "Optional") : field("Introduction fee", input("flat", 'type="number" min="0"', String(rc.introductionFee)), "Used for expert calls")}</div>
         <div class="wash-tile"><small class="lbl" style="margin-top:0">For example</small><span>${example}</span></div>
         ${check("portal", agency ? "Give them portal access — they send requirements and see anonymised people" : "Give them portal access — they send roles and see anonymised people", draft.portal)}`
      ), async (fd: FormData) => {
        draft.model = String(fd.get("model")) as FeeModel; draft.pct = Number(fd.get("pct") || 0) || draft.pct;
        draft.monthlyFee = Number(fd.get("monthlyFee") || 0) || null; draft.portal = fd.get("portal") === "on";
        const a: Account = { id: draft.id, name: draft.name, kind, status: "ACTIVE", contactName: draft.contactName || null, contactEmail: draft.contactEmail || null, currency: draft.currency, monthlyFee: draft.monthlyFee, portalEnabled: draft.portal, notes: null, terms: { model: draft.model, pct: draft.pct, flat: null, currency: draft.currency }, createdAt: C().nowISO() };
        await C().commit("accounts", a, { action: "account.create", entityType: "Account", entityId: a.id, detail: `${a.name} · ${KIND_LABEL[kind]}` });
        C().toast(`${a.name} added`); step3();
      }, { submitLabel: "Save and continue", back: true, step: [1, 3] });
    };

    const step3 = () => {
      C().setStepBack(step2);
      C().setDrawerStep("Their first requirement", "Optional, but this is the only reason the account exists. Plain words — the co-pilot structures it.", raw(
        `${field("What do they need?", textarea("text", 'rows="3" placeholder="' + esc(agency ? "2 BAs already in Dubai with a visa, perm, retail banking, AED 360k" : "A permanent senior project manager for our digital programme, London, £95k, start January") + '"'))}
         <div class="wash-tile"><b>What happens next</b><span class="dim">We read it, check it against people we know, and you decide who to propose. They see anonymised cards${draft.portal ? " in their portal" : ""} — never a name until an introduction is agreed.</span></div>`
      ), async (fd: FormData) => {
        const text = String(fd.get("text") || "").trim();
        C().closeDrawer();
        if (!text) { C().toast("Account ready. Add a requirement whenever you like."); location.hash = "#/requirements"; C().render(); return; }
        const acc = C().S().accounts.find((a) => a.id === draft.id)!;
        const parsed: Brief = D().parseBrief(text); const now = C().nowISO();
        const b: StoredBrief = { ...parsed, id: C().uid(), accountId: acc.id, submittedVia: "OWNER", status: "QUALIFYING", terms: { model: draft.model, pct: draft.pct, flat: draft.model === "INTRODUCTION_FEE" ? C().S().rateCard.introductionFee : null, currency: draft.currency }, termsAccepted: false, createdAt: now, updatedAt: now };
        await C().commit("briefs", b, { action: "brief.create", entityType: "Brief", entityId: b.id, detail: `${acc.name} · ${b.title}` });
        const est = estimateOf(b); if (est.confident) await C().commit("fees", { id: C().uid(), briefId: b.id, accountId: acc.id, personId: null, model: b.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency, status: "FORECAST", createdAt: now, updatedAt: now } as FeeLine);
        const results = D().matchBrief(b, C().S().people.map((x: Person) => C().toBriefPerson(x)), 12);
        for (const r of results) await C().commit("shortlist", { id: C().uid(), briefId: b.id, personId: r.match.personId, fitScore: r.match.fitScore, fitExplanation: r.match.fitExplanation, dimensions: r.match.dimensions, uncertainty: r.match.uncertainty, checks: r.checks, tier: r.tier, decision: "CANDIDATE", createdAt: now, updatedAt: now } as ShortlistItem);
        C().toast(`${acc.name} is set up, with ${results.length} people to look at`);
        location.hash = `#/requirements/${b.id}`; C().render();
      }, { submitLabel: "Finish", back: true, step: [2, 3] });
    };

    C().openDrawer(agency ? "Add an agency" : "Add a client", "Three steps.", raw(""), () => {}, {});
    step1();
  }

  // ----- actions -----
  const actions: Record<string, (el: HTMLElement) => Promise<void> | void> = {
    /** Refer someone we know to a client or an agency — for a live requirement, or on spec. They land in that portal as an anonymised card with the fee attached. */
    referToAccount(el) {
      const S = C().S(); const p = C().person(el.dataset.id!)!;
      const open = (a: Account) => S.briefs.filter((b) => b.accountId === a.id && !["FILLED", "CLOSED"].includes(b.status)).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
      const accounts = S.accounts.filter((a) => a.status !== "PAUSED");
      if (!accounts.length) { C().toast("Add a client or agency account first", "amber"); return; }
      const already = new Set(S.shortlist.filter((s) => s.personId === p.id && D().PORTAL_VISIBLE.includes(s.decision)).map((s) => s.briefId));
      const groups = accounts.map((a) => `<optgroup label="${esc(a.name)} · ${esc(KIND_LABEL[a.kind])}">${open(a).map((b) => `<option value="${b.id}" ${already.has(b.id) ? "disabled" : ""}>${esc(b.title)} · ${esc(routeLabel(b.engagementRoute))}${b.headcount > 1 ? ` × ${b.headcount}` : ""}${already.has(b.id) ? " — already proposed" : ""}</option>`).join("")}<option value="spec:${a.id}">On spec — no requirement yet</option></optgroup>`).join("");
      const suggestion = (() => { const v = C().vouchesOf(p.id).find((x: any) => x.statement); const r = C().relsOf(p.id).find((x) => x.workedTogetherContext); return v?.statement ?? r?.workedTogetherContext ?? p.headline ?? ""; })();
      C().openDrawer(`Refer ${C().full(p)}`, "Choose who to put them in front of. They appear in that client or agency's portal as an anonymised card — the name stays with us until an introduction is agreed and they say yes.", raw(
        `${field("Refer to", `<select name="target" required onchange="document.getElementById('spec-route').hidden = !this.value.startsWith('spec:')">${groups}</select>`, "A live requirement — perm or contract — or on spec where there is no brief yet", true)}
        <div id="spec-route" hidden>${field("Route for the on-spec introduction", select("route", opt(h.L().ROUTE_LABELS, p.engagementPreferences[0] ?? "", "— their stated preference —")), "Perm, contract, interim or advisory. This sets the fee model.")}</div>
        ${field("What they read on the card", textarea("clientNote", 'rows="3" placeholder="Why this person, in a sentence the client can read. No names, no employers."', suggestion))}
        <small class="lbl">Fee</small><div class="grid-2">${field("Fee model", select("model", opt(D().FEE_MODEL_LABELS, "", "— keep the requirement's terms —")))}${field("Our %", input("pct", 'type="number" step="0.5" min="0" placeholder="from the rate card"'))}</div>
        ${check("createFee", "Create a forecast fee line against this person", true)}`
      ), async (fd: FormData) => {
        const now = C().nowISO(); const target = String(fd.get("target") || "");
        if (!target) { C().toast("Choose who to refer them to", "amber"); return; }
        let b: StoredBrief;
        if (target.startsWith("spec:")) {
          const acc = S.accounts.find((a) => a.id === target.slice(5))!;
          const route = (String(fd.get("route") || "") || p.engagementPreferences[0] || "CONTRACT") as StoredBrief["engagementRoute"];
          const where = [p.primaryCity, p.primaryCountry].filter(Boolean).join(", ");
          const parsed: Brief = D().parseBrief(`${p.currentRole ?? "Senior practitioner"} in ${where || "the network"}`);
          const model: FeeModel = D().defaultFeeModel(route, acc.kind);
          b = { ...parsed, id: C().uid(), title: `On spec · ${p.currentRole ?? p.headline ?? "introduction"}`, rawText: `Put forward on spec by ${C().userName(S.me.id)}. No requirement yet — ${esc(p.headline ?? "someone worth knowing")}.`, roles: p.currentRole ? [p.currentRole] : parsed.roles, capabilities: p.capabilities.slice(0, 6), locations: [p.primaryCity ?? p.primaryCountry ?? ""].filter(Boolean), mustBeLocal: false, workRights: null, sectors: p.sectors.slice(0, 3), seniority: p.seniority ?? null, engagementRoute: route, headcount: 1, budget: null, questions: [], assumptions: [`Introduced on spec, not against a brief.`], accountId: acc.id, submittedVia: "OWNER", status: "SHORTLISTED", terms: { ...D().defaultTerms(S.rateCard, model), ...(acc.terms ?? {}) }, termsAccepted: false, openToMembers: false, memberSummary: null, createdAt: now, updatedAt: now };
          await C().commit("briefs", b, { action: "brief.on_spec", entityType: "Brief", entityId: b.id, detail: `${acc.name} · on-spec introduction` });
        } else {
          b = S.briefs.find((x) => x.id === target)!;
        }
        const chosen = String(fd.get("model") || "") as FeeModel; const pct = Number(fd.get("pct") || 0);
        if (chosen || pct) {
          const model = chosen || b.terms.model; const base = D().defaultTerms(S.rateCard, model);
          b = { ...b, terms: { model, pct: model === "INTRODUCTION_FEE" ? null : pct || base.pct, flat: model === "INTRODUCTION_FEE" ? pct || base.flat : null, currency: b.terms.currency }, updatedAt: now };
          await C().commit("briefs", b, { action: "brief.terms", entityType: "Brief", entityId: b.id, detail: `${D().FEE_MODEL_LABELS[b.terms.model]}${b.terms.pct ? ` ${b.terms.pct}%` : ""}` });
        }
        const acc = accountOf(b)!;
        const bp = C().toBriefPerson(p); const r = D().matchBrief(b, [bp], 1)[0];
        const checks: ShortlistItem["checks"] = r?.checks ?? D().hardChecks(b, bp);
        const ex = S.shortlist.find((s) => s.briefId === b.id && s.personId === p.id);
        const item: ShortlistItem = { id: ex?.id ?? C().uid(), briefId: b.id, personId: p.id, fitScore: r?.match.fitScore ?? 0, fitExplanation: r?.match.fitExplanation ?? `Referred by hand by ${C().userName(S.me.id)}, not retrieved by the matcher.`, dimensions: r?.match.dimensions ?? [], uncertainty: r?.match.uncertainty ?? [], checks, tier: r?.tier ?? (checks.some((c) => c.state === "unmet") ? "stretch" : checks.some((c) => c.state === "unknown") ? "conversation" : "meets"), decision: "PROPOSED", referred: true, referredBy: S.me.id, note: ex?.note ?? `Referred by ${C().userName(S.me.id)}`, clientNote: String(fd.get("clientNote") || "") || null, createdAt: ex?.createdAt ?? now, updatedAt: now };
        await C().commit("shortlist", item, { action: "shortlist.referred", entityType: "Brief", entityId: b.id, detail: `${C().full(p)} referred to ${acc.name}` });
        const est = D().estimateFee({ ...b, headcount: 1 }, b.terms, S.rateCard, b.expertHours ?? null);
        if (fd.get("createFee") === "on" && est.confident && !feesFor(b.id).some((f) => f.personId === p.id)) {
          await C().commit("fees", { id: C().uid(), briefId: b.id, accountId: acc.id, personId: p.id, model: b.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency, status: "FORECAST", createdAt: now, updatedAt: now } as FeeLine, { action: "fee.create", entityType: "Brief", entityId: b.id, detail: `${money(est.ourTake, est.currency)} forecast · ${C().full(p)}` });
        }
        if (["NEW", "QUALIFYING", "SEARCHING"].includes(b.status)) await C().commit("briefs", { ...b, status: "SHORTLISTED", updatedAt: now });
        C().closeDrawer(); C().toast(`Referred. ${acc.name} sees an anonymised card${est.confident ? ` · ${money(est.ourTake, est.currency)} to us if it lands` : ""}`);
        location.hash = `#/requirements/${b.id}`; C().render();
      }, { wide: true, submitLabel: "Refer them" });
    },
    copilotExample(el) { const ta = document.querySelector<HTMLTextAreaElement>("form[data-action=copilot] textarea"); if (ta) ta.value = el.dataset.text ?? ""; runCopilot(el.dataset.text ?? ""); },
    goCommercials() { location.hash = "#/settings?tab=commercials"; },
    async findForBrief(el) {
      const S = C().S(); const b = S.briefs.find((x) => x.id === el.dataset.id)!;
      const results = D().matchBrief(b, S.people.map((p) => C().toBriefPerson(p)), 12); const now = C().nowISO();
      for (const r of results) { const ex = S.shortlist.find((s) => s.briefId === b.id && s.personId === r.match.personId); const item: ShortlistItem = { id: ex?.id ?? C().uid(), briefId: b.id, personId: r.match.personId, fitScore: r.match.fitScore, fitExplanation: r.match.fitExplanation, dimensions: r.match.dimensions, uncertainty: r.match.uncertainty, checks: r.checks, tier: r.tier, decision: ex?.decision ?? "CANDIDATE", note: ex?.note ?? null, clientNote: ex?.clientNote ?? null, createdAt: ex?.createdAt ?? now, updatedAt: now }; await C().commit("shortlist", item); }
      if (["NEW", "QUALIFYING"].includes(b.status)) await C().commit("briefs", { ...b, status: "SEARCHING", updatedAt: now });
      C().logAudit("brief.search", "Brief", b.id, `${results.length} people retrieved · ${b.title}`); C().toast(`${results.length} people retrieved — you decide who to propose`); C().render();
    },
    editBrief(el) {
      const b = C().S().briefs.find((x) => x.id === el.dataset.id)!;
      C().openDrawer("Edit the brief", "Correct anything the co-pilot read wrongly. The shortlist is refreshed against the new brief.", raw(`${field("In their words", textarea("rawText", 'rows="3"', b.rawText))}${field("Title", input("title", "", b.title))}<div class="grid-2">${field("Route", select("engagementRoute", opt(h.L().ROUTE_LABELS, b.engagementRoute ?? "", "— to confirm —")))}${field("Headcount", input("headcount", 'type="number" min="1"', String(b.headcount)))}${field("Roles", input("roles", "", b.roles.join(", ")), "Comma separated")}${field("Capabilities to match", input("capabilities", "", b.capabilities.join(", ")), "Comma separated")}${field("Locations", input("locations", "", b.locations.join(", ")))}${field("Work rights required", input("workRights", 'placeholder="Right to work in UAE"', b.workRights ?? ""))}${field("Seniority", select("seniority", opt(h.L().SENIORITY_LABELS, b.seniority ?? "", "—")))}${field("Sectors", input("sectors", "", b.sectors.join(", ")))}${field("Budget amount", input("budgetAmount", 'type="number" min="0"', b.budget ? String(b.budget.amount) : ""))}${field("Budget kind", select("budgetKind", opt({ SALARY: "Salary (per year)", DAY_RATE: "Day rate", HOURLY: "Hourly", PROJECT: "Project / SOW value" }, b.budget?.kind ?? "DAY_RATE")))}${field("Currency", select("budgetCurrency", opt({ GBP: "GBP", AED: "AED", SAR: "SAR", USD: "USD", EUR: "EUR" }, b.budget?.currency ?? b.terms.currency)))}${field("Duration (months)", input("durationMonths", 'type="number" min="0"', b.durationMonths ? String(b.durationMonths) : ""))}${field("Start by", input("startBy", "", b.startBy ?? ""))}</div>${check("mustBeLocal", "Must already be in the location (no relocation)", b.mustBeLocal)}`), async (fd: FormData) => {
        const amount = Number(fd.get("budgetAmount") || 0);
        const nb: StoredBrief = { ...b, rawText: String(fd.get("rawText") || b.rawText), title: String(fd.get("title") || b.title), engagementRoute: (String(fd.get("engagementRoute") || "") || null) as any, headcount: Math.max(1, Number(fd.get("headcount") || 1)), roles: C().list(String(fd.get("roles") || "")), capabilities: C().list(String(fd.get("capabilities") || "")), locations: C().list(String(fd.get("locations") || "")), workRights: String(fd.get("workRights") || "") || null, seniority: (String(fd.get("seniority") || "") || null) as any, sectors: C().list(String(fd.get("sectors") || "")), budget: amount ? { kind: String(fd.get("budgetKind")) as any, amount, currency: String(fd.get("budgetCurrency")), max: null } : null, durationMonths: Number(fd.get("durationMonths") || 0) || null, startBy: String(fd.get("startBy") || "") || null, mustBeLocal: fd.get("mustBeLocal") === "on", questions: [], updatedAt: C().nowISO() };
        await C().commit("briefs", nb, { action: "brief.update", entityType: "Brief", entityId: b.id, detail: nb.title });
        for (const s of listFor(b.id)) { const p = C().person(s.personId); if (p) await C().commit("shortlist", { ...s, checks: D().hardChecks(nb, C().toBriefPerson(p)), updatedAt: C().nowISO() }); }
        C().closeDrawer(); C().toast("Brief updated"); C().render();
      }, { wide: true, submitLabel: "Save brief" });
    },
    addFee(el) {
      const b = C().S().briefs.find((x) => x.id === el.dataset.id)!; const est = estimateOf(b);
      C().openDrawer("Add a fee line", "Record a fee against this requirement.", raw(`<div class="grid-2">${field("Person", select("personId", opt(Object.fromEntries(listFor(b.id).map((s) => [s.personId, C().full(C().person(s.personId)!)])), "", "— none / whole brief —")))}${field("Status", select("status", opt(D().FEE_STATUS_LABELS, "FORECAST")))}${field("Gross (what they pay)", input("gross", 'type="number" min="0"', String(est.gross || "")))}${field("Our take", input("ourTake", 'type="number" min="0"', String(est.perHead || "")))}${field("Currency", select("currency", opt({ GBP: "GBP", AED: "AED", SAR: "SAR", USD: "USD", EUR: "EUR" }, est.currency)))}${field("Basis", input("basis", "", est.basis))}</div>`), async (fd: FormData) => {
        const now = C().nowISO(); const f: FeeLine = { id: C().uid(), briefId: b.id, accountId: b.accountId, personId: String(fd.get("personId") || "") || null, model: b.terms.model, basis: String(fd.get("basis") || ""), gross: Number(fd.get("gross") || 0), ourTake: Number(fd.get("ourTake") || 0), currency: String(fd.get("currency")), status: String(fd.get("status")) as FeeStatus, createdAt: now, updatedAt: now };
        await C().commit("fees", f, { action: "fee.create", entityType: "Brief", entityId: b.id, detail: `${money(f.ourTake, f.currency)} ${f.status.toLowerCase()}` }); C().closeDrawer(); C().toast("Fee line added"); C().render();
      }, { submitLabel: "Add fee line" });
    },
    setupClient() { accountFlow("CLIENT"); },
    setupAgency() { accountFlow("AGENCY"); },
    newRequirement() { location.hash = "#/requirements"; setTimeout(() => document.querySelector<HTMLTextAreaElement>("form[data-action=copilot] textarea")?.focus(), 250); },
    goImport() { location.hash = "#/import"; },
    inviteMember() { location.hash = "#/join"; },
    newAccount() {
      C().openDrawer("New account", "A client, an agency, or an expert network that sends requirements and pays fees.", raw(`${field("Name", input("name", "required"), undefined, true)}<div class="grid-2">${field("Type", select("kind", opt(KIND_LABEL, "CLIENT")))}${field("Status", select("status", opt({ PROSPECT: "Prospect", ACTIVE: "Active", PAUSED: "Paused" }, "PROSPECT")))}${field("Contact name", input("contactName"))}${field("Contact email", input("contactEmail", 'type="email"'))}${field("Currency", select("currency", opt({ GBP: "GBP", AED: "AED", SAR: "SAR", USD: "USD", EUR: "EUR" }, C().S().rateCard.currency)))}${field("Monthly access fee", input("monthlyFee", 'type="number" min="0"'), "Optional. For agencies with portal access.")}</div>${check("portalEnabled", "Portal access", true)}${field("Notes", textarea("notes", 'rows="2"'))}`), async (fd: FormData) => {
        const a: Account = { id: C().uid(), name: String(fd.get("name") || "").trim(), kind: String(fd.get("kind")) as AccountKind, status: String(fd.get("status")) as any, contactName: String(fd.get("contactName") || "") || null, contactEmail: String(fd.get("contactEmail") || "") || null, currency: String(fd.get("currency")), monthlyFee: Number(fd.get("monthlyFee") || 0) || null, portalEnabled: fd.get("portalEnabled") === "on", notes: String(fd.get("notes") || "") || null, createdAt: C().nowISO() };
        if (!a.name) { C().toast("Give the account a name", "amber"); return; }
        await C().commit("accounts", a, { action: "account.create", entityType: "Account", entityId: a.id, detail: a.name }); C().closeDrawer(); C().toast("Account created"); C().render();
      }, { submitLabel: "Create account" });
    },
    portalPreview(el) { const form = el.closest("form")!; const text = (form.querySelector("textarea") as HTMLTextAreaElement).value.trim(); const out = document.getElementById("portal-read")!; if (!text) { out.innerHTML = ""; return; } out.innerHTML = readCard(D().parseBrief(text)); },
    async portalInterest(el) { const s = C().S().shortlist.find((x) => x.id === el.dataset.id)!; const b = C().S().briefs.find((x) => x.id === s.briefId)!; await C().commit("shortlist", { ...s, decision: "CLIENT_INTERESTED", updatedAt: C().nowISO() }, { action: "portal.introduction_requested", entityType: "Brief", entityId: b.id, detail: `${accountOf(b)?.name} interested in ${C().full(C().person(s.personId)!)}` }); C().toast("Asked. We will come back to you with a time."); C().render(); },
    async portalPass(el) { const s = C().S().shortlist.find((x) => x.id === el.dataset.id)!; await C().commit("shortlist", { ...s, decision: "CLIENT_PASSED", updatedAt: C().nowISO() }, { action: "portal.passed", entityType: "Brief", entityId: s.briefId, detail: C().full(C().person(s.personId)!) }); C().toast("Noted"); C().render(); },
    async acceptTerms(el) { const b = C().S().briefs.find((x) => x.id === el.dataset.id)!; await C().commit("briefs", { ...b, termsAccepted: true, updatedAt: C().nowISO() }, { action: "terms.accept", entityType: "Brief", entityId: b.id, detail: `${accountOf(b)?.name} accepted ${D().FEE_MODEL_LABELS[b.terms.model]}` }); C().toast("Terms accepted"); C().render(); },
  };

  // ----- forms -----
  const forms: Record<string, (fd: FormData, form: HTMLFormElement) => Promise<void> | void> = {
    copilot(fd) { const text = String(fd.get("text") || "").trim(); if (!text) { C().toast("Describe the need first", "amber"); return; } runCopilot(text); },
    async saveBrief(fd) {
      const S = C().S(); const text = String(fd.get("text") || ""); const acc = S.accounts.find((a) => a.id === String(fd.get("accountId")));
      if (!acc) { C().toast("Choose an account", "amber"); return; }
      const parsed: Brief = D().parseBrief(text); const model: FeeModel = D().defaultFeeModel(parsed.engagementRoute, acc.kind); const now = C().nowISO();
      const b: StoredBrief = { ...parsed, id: C().uid(), title: String(fd.get("title") || parsed.title), accountId: acc.id, submittedVia: "OWNER", status: "QUALIFYING", terms: { ...D().defaultTerms(S.rateCard, model), ...(acc.terms ?? {}) }, termsAccepted: false, createdAt: now, updatedAt: now };
      await C().commit("briefs", b, { action: "brief.create", entityType: "Brief", entityId: b.id, detail: `${acc.name} · ${b.title}` });
      const est = estimateOf(b); if (est.confident) await C().commit("fees", { id: C().uid(), briefId: b.id, accountId: acc.id, personId: null, model: b.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency, status: "FORECAST", createdAt: now, updatedAt: now } as FeeLine);
      const results = D().matchBrief(b, S.people.map((p) => C().toBriefPerson(p)), 12);
      for (const r of results) await C().commit("shortlist", { id: C().uid(), briefId: b.id, personId: r.match.personId, fitScore: r.match.fitScore, fitExplanation: r.match.fitExplanation, dimensions: r.match.dimensions, uncertainty: r.match.uncertainty, checks: r.checks, tier: r.tier, decision: "CANDIDATE", createdAt: now, updatedAt: now } as ShortlistItem);
      C().toast("Requirement saved with a shortlist to review"); location.hash = `#/requirements/${b.id}`;
    },
    async briefTerms(fd, form) {
      const b = C().S().briefs.find((x) => x.id === form.dataset.id)!; const model = String(fd.get("model")) as FeeModel;
      const nb: StoredBrief = { ...b, terms: { model, pct: model === "INTRODUCTION_FEE" ? null : Number(fd.get("pct") || 0), flat: model === "INTRODUCTION_FEE" ? Number(fd.get("flat") || 0) : null, currency: String(fd.get("currency")) }, expertHours: (Number(fd.get("expertHours") || 0) || b.expertHours) ?? null, termsAccepted: fd.get("termsAccepted") === "on", updatedAt: C().nowISO() };
      if (model !== b.terms.model) nb.terms = { ...D().defaultTerms(C().S().rateCard, model), currency: nb.terms.currency, ...(model === "INTRODUCTION_FEE" ? { flat: nb.terms.flat || C().S().rateCard.introductionFee } : { pct: Number(fd.get("pct") || 0) || D().defaultTerms(C().S().rateCard, model).pct }) };
      await C().commit("briefs", nb, { action: "brief.terms", entityType: "Brief", entityId: b.id, detail: `${D().FEE_MODEL_LABELS[nb.terms.model]}${nb.terms.pct ? ` ${nb.terms.pct}%` : ""}` });
      const est = estimateOf(nb); const fc = feesFor(b.id).find((f) => f.status === "FORECAST" && !f.personId); if (fc && est.confident) await C().commit("fees", { ...fc, model: nb.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency, updatedAt: C().nowISO() });
      C().toast("Terms saved"); C().render();
    },
    async briefMembers(fd, form) { const b = C().S().briefs.find((x) => x.id === form.dataset.id)!; await C().commit("briefs", { ...b, openToMembers: fd.get("openToMembers") === "on", memberSummary: String(fd.get("memberSummary") || "") || null, updatedAt: C().nowISO() }, { action: "brief.members", entityType: "Brief", entityId: b.id, detail: fd.get("openToMembers") === "on" ? "opened to members" : "closed to members" }); C().toast(fd.get("openToMembers") === "on" ? "Members can now see this, anonymised" : "Saved"); C().render(); },
    async briefStatus(fd, form) { const b = C().S().briefs.find((x) => x.id === form.dataset.id)!; await C().commit("briefs", { ...b, status: String(fd.get("status")) as BriefStatus, updatedAt: C().nowISO() }, { action: "brief.status", entityType: "Brief", entityId: b.id, detail: String(fd.get("status")) }); C().toast("Status updated"); C().render(); },
    async decideShortlist(fd, form) {
      const S = C().S(); const s = S.shortlist.find((x) => x.id === form.dataset.id)!; const b = S.briefs.find((x) => x.id === s.briefId)!; const p = C().person(s.personId)!; const decision = String(fd.get("decision")) as ShortlistDecision; const now = C().nowISO();
      await C().commit("shortlist", { ...s, decision, clientNote: String(fd.get("clientNote") || "") || null, updatedAt: now }, { action: `shortlist.${decision.toLowerCase()}`, entityType: "Brief", entityId: b.id, detail: `${C().full(p)} · ${b.title}` });
      if (decision === "PLACED" && !feesFor(b.id).some((f) => f.personId === p.id)) { const est = D().estimateFee({ ...b, headcount: 1 }, b.terms, S.rateCard, b.expertHours ?? null); await C().commit("fees", { id: C().uid(), briefId: b.id, accountId: b.accountId, personId: p.id, model: b.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency, status: "AGREED", createdAt: now, updatedAt: now } as FeeLine, { action: "fee.create", entityType: "Brief", entityId: b.id, detail: `${money(est.ourTake, est.currency)} agreed · ${C().full(p)}` }); }
      const placed = listFor(b.id).filter((x) => x.decision === "PLACED").length;
      const next: BriefStatus | null = placed >= b.headcount ? "FILLED" : decision === "INTRODUCED" ? "INTRODUCING" : decision === "PROPOSED" && ["SEARCHING", "QUALIFYING", "NEW"].includes(b.status) ? "SHORTLISTED" : null;
      if (next && next !== b.status) await C().commit("briefs", { ...b, status: next, updatedAt: now });
      C().toast(decision === "PLACED" ? "Placed. Fee line created." : decision === "PROPOSED" ? "Proposed. The client now sees an anonymised card." : "Saved"); C().render();
    },
    async feeStatus(fd, form) { const f = C().S().fees.find((x) => x.id === form.dataset.id)!; await C().commit("fees", { ...f, status: String(fd.get("status")) as FeeStatus, updatedAt: C().nowISO() }, { action: "fee.status", entityType: "Brief", entityId: f.briefId, detail: `${money(f.ourTake, f.currency)} → ${String(fd.get("status")).toLowerCase()}` }); C().toast("Fee updated"); C().render(); },
    portalSwitch(fd) { location.hash = `#/portal?account=${fd.get("account")}`; },
    async portalSubmit(fd, form) {
      const S = C().S(); const acc = S.accounts.find((a) => a.id === form.dataset.account)!; const text = String(fd.get("text") || "").trim(); if (!text) { C().toast("Describe the requirement first", "amber"); return; }
      const parsed: Brief = D().parseBrief(text); const model: FeeModel = D().defaultFeeModel(parsed.engagementRoute, acc.kind); const now = C().nowISO();
      const b: StoredBrief = { ...parsed, id: C().uid(), accountId: acc.id, submittedVia: "PORTAL", status: "NEW", terms: { ...D().defaultTerms(S.rateCard, model), ...(acc.terms ?? {}) }, termsAccepted: false, createdAt: now, updatedAt: now };
      await C().commit("briefs", b, { action: "portal.brief_submitted", entityType: "Brief", entityId: b.id, detail: `${acc.name} · ${b.title}` });
      const est = estimateOf(b); if (est.confident) await C().commit("fees", { id: C().uid(), briefId: b.id, accountId: acc.id, personId: null, model: b.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency, status: "FORECAST", createdAt: now, updatedAt: now } as FeeLine);
      C().toast("Sent. We will come back with people we know."); C().render();
    },
    async saveRateCard(fd) {
      const rc = { ...C().S().rateCard } as any; for (const k of Object.keys(rc)) { const v = fd.get(k); if (v === null) continue; rc[k] = k === "currency" ? String(v) : Number(v); }
      await C().saveRateCard(rc); C().logAudit("ratecard.update", "Settings", null, `${rc.permPct}% perm · ${rc.contractMarginPct}% contract · ${rc.expertHourlyTakePct}% expert`); C().toast("Rate card saved"); C().render();
    },
  };

  return { requirements, requirement, portal, commercialsCard, referredCard, actions, forms };
}
