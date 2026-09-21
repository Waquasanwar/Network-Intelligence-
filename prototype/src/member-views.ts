/* Trust, fit, screening, member portal, referrals and registration for the live prototype. */
import type { Person, Conversation, Vouch, Referral, Pitch, StoredBrief, ShortlistItem, Relationship } from "./types";
import type { View } from "./app";
import type { H } from "./demand-views";
import { speechSupported, speakSupported, speak, stopSpeaking, listen, stopListening, listening, matchChoice, matchScale, splitSpokenList } from "./voice";

const REF_STATUS: Record<Referral["status"], string> = { NEW: "New", CONTACTED: "Contacted", SCREENING: "Screening booked", ACCEPTED: "In the network", DECLINED: "Not now" };
const PITCH_STATUS: Record<Pitch["status"], string> = { SUBMITTED: "Submitted", SHORTLISTED: "On the shortlist", DECLINED: "Not this time" };
const SCREEN_STATUS: Record<string, [string, string]> = { NONE: ["Not screened", "neutral"], REGISTERED: ["Registered · needs screening", "amber"], INVITED: ["Invited to screening", "amber"], BOOKED: ["Screening call booked", "navy"], SUBMITTED: ["Screening submitted · review", "amber"], APPROVED: ["Screened", "teal"] };

type ScreenState = { personId: string; mode: "owner" | "member"; step: number; answers: Record<string, unknown>; startedAt: number; voice: boolean; muted: boolean; started: boolean };
let scr: ScreenState | null = null;
const newScreen = (personId: string, mode: "owner" | "member"): ScreenState => ({ personId, mode, step: 0, answers: {}, startedAt: Date.now(), voice: false, muted: false, started: false });

export function memberViews(h: H) {
  const { esc, raw, badge, chip, card, field, input, textarea, select, check, btn, stat, empty, personLink, availBadge, opt, rel, avatar } = h;
  const C = () => h.C();
  const S = () => C().S();
  const L = () => h.L();
  const me = () => S().viewAs;
  const memberPerson = () => (me().role === "MEMBER" ? C().person(me().personId!) : undefined);
  const screenLabel = (p: Person) => { const [l, t] = SCREEN_STATUS[p.screeningStatus ?? (p.screenedAt ? "APPROVED" : "NONE")] ?? SCREEN_STATUS.NONE; const tone = t === "teal" ? "trust" : t === "amber" ? "alert" : t === "navy" ? "neutral" : "neutral"; return `<ni-tag tone="${tone}" solid icon="screening">${esc(l)}</ni-tag>`; };

  // ----- trust & fit pieces -----
  const ring = (score: number, label: string, size = 64) => { const tone = score >= 60 ? "hi" : score >= 35 ? "mid" : "lo"; return `<div class="ring" style="--size:${size}px"><svg viewBox="0 0 44 44"><circle class="track" cx="22" cy="22" r="18"/><circle class="val ${tone}" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="${score} 100"/></svg><div><b>${score}</b>${label ? `<small>${esc(label)}</small>` : ""}</div></div>`; };
  const voucherName = (v: Vouch) => (v.voucherKind === "EXTERNAL" ? v.voucherName ?? "External reference" : C().userName(v.voucherId));
  const chainOf = (p: Person, compact = true) => { const vs = C().vouchesOf(p.id).filter((v: Vouch) => v.wouldRecommend); return `<ni-chain ${compact ? "compact" : ""} people="${esc(vs.map(voucherName).join("|"))}" count="${vs.length}" score="${C().trustOf(p).score}"></ni-chain>`; };
  const trustMini = (p: Person) => { const t = C().trustOf(p); return `<span class="trust-mini" title="${esc(C().trust.TRUST_BAND_LABEL[t.band])} · vouched by ${t.vouchedBy}"><svg viewBox="0 0 44 44"><circle class="track" cx="22" cy="22" r="18"/><circle class="val ${t.score >= 60 ? "hi" : t.score >= 35 ? "mid" : "lo"}" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="${t.score} 100"/></svg><b>${t.score}</b><small>${t.vouchedBy} vouch${t.vouchedBy === 1 ? "" : "es"}</small></span>`; };
  const TRUST_ICON: Record<string, string> = { "Vouched for": "vouch", "Worked with directly": "worked", "Observed evidence": "evidence", Conversations: "conversation", Screening: "screening", "Status freshness": "fresh", "Referrals accepted": "referral", Cautions: "caution" };
  const trustCard = (p: Person, opts: { canVouch?: boolean; self?: boolean } = {}) => {
    const t = C().trustOf(p); const vs = C().vouchesOf(p.id).filter((v: Vouch) => v.wouldRecommend);
    return card("Trust", `<div class="trust-head"><ni-trust score="${t.score}" band="of 100" size="84"></ni-trust><div><b class="band">${esc(C().trust.TRUST_BAND_LABEL[t.band])}</b><p class="dim">${opts.self ? "How many people stand behind you, and how well the network knows you." : `How many people stand behind ${esc(p.firstName)}, and how well the network knows them. Network confidence, never a verdict on the person.`}</p><div class="chain-row"><ni-chain people="${esc(vs.map(voucherName).join("|"))}" count="${vs.length}"></ni-chain></div></div></div>
      <ul class="trust-bars">${t.breakdown.map((b: any) => `<li><span class="tb-l"><ni-icon name="${TRUST_ICON[b.label] ?? "check"}" size="14" tone="${b.points < 0 ? "stop" : b.points > 0 ? "trust" : "mute"}"></ni-icon>${esc(b.label)}</span><div class="bar"><div class="fill ${b.points < 0 ? "neg" : ""}" style="width:${b.max ? Math.min(100, Math.max(0, (b.points / b.max) * 100)) : 100}%"></div></div><b class="${b.points < 0 ? "bad" : ""}">${b.points > 0 ? "+" : ""}${b.points}</b><small>${esc(b.note)}</small></li>`).join("")}</ul>`,
      { action: opts.canVouch ? btn("Vouch for them", `data-act="vouch" data-id="${p.id}"`, "glass sm") : undefined });
  };
  const fitCard = (p: Person, opts: { self?: boolean; traits?: string[] } = {}) => {
    const rows = C().fitOf(p); const any = rows.some((r: any) => r.combined !== null);
    return card(opts.self ? "How you work" : "How they work", any
      ? `<div class="fit-rows">${rows.map((r: any) => `<ni-meter label="${esc(r.label)}" low="${esc(r.low)}" high="${esc(r.high)}" ${r.self !== null ? `self="${r.self}"` : ""} ${r.peers !== null ? `peers="${r.peers}"` : ""} peercount="${r.peerCount}" ${opts.traits?.includes(r.key) ? "wanted" : ""}></ni-meter>`).join("")}</div><p class="legend"><i class="self"></i> self-assessed in the conversation <i class="peers"></i> observed by people who vouched</p>`
      : `<span class="dim">${opts.self ? "Finish the conversation to build your working-style profile." : "Not assessed yet. The conversation captures this, and each vouch adds what people saw."}</span>`,
      { desc: opts.self ? "Assertiveness, conflict, political and commercial awareness. Clients see the strengths, never the numbers." : "Working style and attitude, so we know where they will land well. Never a pass or fail." });
  };
  const vouchList = (p: Person) => { const vs = C().vouchesOf(p.id); return card(`Vouched for by ${vs.length}`, vs.length ? `<ul class="rows">${vs.map((v: Vouch) => `<li class="col"><div class="row"><b>${esc(v.voucherKind === "EXTERNAL" ? v.voucherName ?? "External" : C().userName(v.voucherId))}</b><span class="meta">${v.voucherKind === "EXTERNAL" ? `<ni-tag solid icon="ask">${esc(v.source ?? "external")}</ni-tag>` : `<ni-tag tone="trust" solid icon="vouch">${v.voucherKind === "USER" ? "you" : "member"}</ni-tag>`}${v.wouldRecommend ? "" : badge("would not recommend", "amber", true)}</span></div><small class="dim">${esc(v.context)}</small>${v.statement ? `<ni-quote size="sm">${esc(v.statement)}</ni-quote>` : ""}${v.attributes ? `<div class="chips">${Object.entries(v.attributes).filter(([, n]) => (n as number) >= 4).map(([k]) => chip(C().fit.ATTRIBUTES.find((a: any) => a.key === k)?.label.toLowerCase() ?? k)).join("")}</div>` : ""}<small class="dim">${esc(rel(v.createdAt))}</small></li>`).join("")}</ul>` : '<span class="dim">Nobody has vouched yet. Ask someone who has seen them deliver.</span>', { desc: "Each vouch is a person putting their name behind them. LinkedIn recommendations count at a lower weight." }); };

  // ----- screening flow -----
  /** What an expert may read about a requirement: never the client's words, never their name. */
  const safeSummary = (b: StoredBrief) => {
    const bits = [`${b.headcount > 1 ? `${b.headcount} people` : "One person"} needed`, b.roles.length ? `as ${b.roles.join(" or ").toLowerCase()}` : "", b.engagementRoute ? `on a ${(L().ROUTE_LABELS[b.engagementRoute] ?? "").toLowerCase()} basis` : "", b.locations.length ? `in ${b.locations.join(" or ")}` : "", b.sectors.length ? `in ${b.sectors.join(" / ").toLowerCase()}` : ""].filter(Boolean).join(" ");
    return `${bits}.${b.mustBeLocal ? " You need to be there already." : ""}${b.workRights ? ` ${b.workRights}.` : ""}${b.startBy ? ` Starting ${b.startBy}.` : ""} We have not named the client; ask us if you want to know more.`;
  };
  const script = () => C().screening.script() as any[];
  const allQuestions = () => script().flatMap((s: any) => s.questions.map((q: any) => ({ ...q, section: s })));
  const scriptMinutes = () => script().reduce((a: number, x: any) => a + (x.minutes || 0), 0);
  function screening(personId: string, q: URLSearchParams): View {
    const p = C().person(personId);
    if (!p) return { title: "Screening", crumbs: [["Screening"]], html: raw(empty("Person not found")) };
    const mode: "owner" | "member" = me().role === "MEMBER" ? "member" : "owner";
    if (!scr || scr.personId !== personId) scr = newScreen(personId, mode);
    if (q.get("restart")) { scr = newScreen(personId, mode); history.replaceState(null, "", `#/screening/${personId}`); }
    const st = scr; const qs = allQuestions();
    // The call starts on a lobby screen so the person chooses voice or typing, and grants the mic once.
    if (!st.started) return lobby(p, mode, st);
    const cur = qs[st.step]; const sec = cur.section; const secIdx = script().indexOf(sec);
    const done = Object.keys(st.answers).length; const pct = Math.round((st.step / qs.length) * 100);
    const val = st.answers[cur.key];
    const answered = Array.isArray(val) ? val.length > 0 : !!val;
    const control = (() => {
      switch (cur.kind) {
        case "text": return `<input name="a" class="lg" value="${esc(val ?? "")}" placeholder="${esc(cur.placeholder ?? "")}" autocomplete="off">`;
        case "long": return `<textarea name="a" rows="4" class="lg" placeholder="${esc(cur.placeholder ?? "Take your time. Specifics beat adjectives.")}">${esc(val ?? "")}</textarea>`;
        case "select": return `<div class="choice">${(cur.options as [string, string][]).map(([k, l]) => `<label class="${val === k ? "on" : ""}"><input type="radio" name="a" value="${k}" ${val === k ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>`;
        case "multi": return `<div class="choice">${(cur.options as [string, string][]).map(([k, l]) => `<label class="${Array.isArray(val) && (val as string[]).includes(k) ? "on" : ""}"><input type="checkbox" name="a" value="${k}" ${Array.isArray(val) && (val as string[]).includes(k) ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>`;
        case "chips": return `<input name="a" class="lg" value="${esc(Array.isArray(val) ? (val as string[]).join(", ") : val ?? "")}" placeholder="${esc(cur.placeholder ?? "")}" autocomplete="off"><small class="dim">Separate with commas.</small>`;
        case "scale": { const n = Number(val ?? 0); return `<div class="scale"><small>${esc(cur.low)}</small><div class="scale-btns">${[1, 2, 3, 4, 5].map((i) => `<label class="${n === i ? "on" : ""}"><input type="radio" name="a" value="${i}" ${n === i ? "checked" : ""}><span>${i}</span></label>`).join("")}</div><small>${esc(cur.high)}</small></div>`; }
        case "people": { const rows = (Array.isArray(val) ? (val as any[]) : [{}, {}]) as { name?: string; context?: string; email?: string }[]; return `<div class="people-rows" id="people-rows">${rows.map((r) => `<div class="grid-3f"><input name="pn" value="${esc(r.name ?? "")}" placeholder="Full name"><input name="pc" value="${esc(r.context ?? "")}" placeholder="What you have seen them do"><input name="pe" value="${esc(r.email ?? "")}" placeholder="Email (optional)"></div>`).join("")}</div>${btn("＋ Another person", 'data-act="scrAddPerson"', "ghost sm")}`; }
      }
    })();
    const answeredList = qs.slice(0, st.step).filter((x: any) => st.answers[x.key]).slice(-4).map((x: any) => { const v = st.answers[x.key]; const text = Array.isArray(v) ? (typeof v[0] === "object" ? (v as any[]).map((r) => r.name).filter(Boolean).join(", ") : (v as string[]).join(", ")) : String(v); return `<li><small>${esc(x.section.title)}</small><span>${esc(text.length > 90 ? text.slice(0, 88) + "…" : text)}</span></li>`; }).join("");
    const html = `<div class="call ${st.voice ? "voice" : "typed"}">
      <header class="call-top"><div class="call-who"><span class="call-dot"></span><b>${esc(mode === "member" ? "Your conversation with Amana Network" : `Screening · ${C().full(p)}`)}</b><small>${secIdx + 1} of ${script().length} · ${esc(sec.title)}</small></div>
        <div class="call-top-actions">${speechSupported() ? `<button type="button" class="chip-btn ${st.voice ? "on" : ""}" data-act="scrVoiceToggle">${st.voice ? "◉ Voice on" : "Switch to voice"}</button>${st.voice && speakSupported() ? `<button type="button" class="chip-btn ${st.muted ? "on" : ""}" data-act="scrMute">${st.muted ? "Unmute" : "Mute"}</button>` : ""}` : ""}<button type="button" class="chip-btn" data-act="scrLeave">Save and leave</button></div>
        <div class="call-progress"><div style="width:${pct}%"></div></div></header>
      <div class="call-body">
        <div class="call-stage">
          ${st.voice ? `<ni-orb id="orb" state="idle"></ni-orb>` : ""}
          <div class="q-eyebrow">${esc(sec.intent)}</div>
          <h1>${esc(cur.prompt)}</h1>
          ${cur.help ? `<p class="help">${esc(cur.help)}</p>` : ""}
          ${st.voice ? `<div class="call-state"><b id="voice-status">Connecting…</b><p id="voice-heard" class="heard"></p></div>` : ""}
          <form data-action="scrNext" class="stack q-form ${st.voice ? "quiet" : ""}">${st.voice ? `<details class="type-instead" ${answered ? "open" : ""}><summary>${cur.kind === "text" || cur.kind === "long" || cur.kind === "chips" ? "What I heard, edit if needed" : "Or choose"}</summary><div class="ti-body">${control}</div></details>` : control}
            <div class="row q-actions"><span>${st.step > 0 ? btn("← Back", 'data-act="scrBack"', "ghost") : ""}</span><span class="row">${cur.required ? "" : btn("Skip", 'data-act="scrSkip"', "ghost")}<button class="btn primary" type="submit">${st.step === qs.length - 1 ? "Finish" : "Next →"}</button></span></div>
          </form>
          ${st.voice ? `<div class="mic-row"><button type="button" class="mic" id="mic" aria-label="Start or stop listening"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg><span class="pulse"></span></button><small>Speak when the circle is live. It moves on when you stop.</small></div>` : ""}
        </div>
        <aside class="call-side">
          <div class="call-sections">${script().map((x: any, i: number) => `<div class="cs ${i < secIdx ? "done" : i === secIdx ? "now" : ""}"><i></i><b>${esc(x.title)}</b><small>${x.minutes} min</small></div>`).join("")}</div>
          ${answeredList ? `<div class="call-answers"><small class="lbl">Captured so far</small><ul>${answeredList}</ul></div>` : `<div class="call-answers"><small class="lbl">Captured so far</small><p class="dim">Your answers appear here as we go. Nothing is on your profile until a person has read it.</p></div>`}
          <div class="call-meta"><span>${done} of ${qs.length} answered</span><span>${Math.round((Date.now() - st.startedAt) / 60000)} min</span></div>
        </aside>
      </div></div>`;
    return { title: "Screening", crumbs: mode === "member" ? [["My expert profile", "#/member"], ["Conversation"]] : [["Experts", "#/network"], [C().full(p), `#/people/${p.id}`], ["Screening"]], html: raw(html), after: () => { wireVoice(cur); if (!scr?.voice) { const el = document.querySelector<HTMLElement>(".q-form input:not([type=radio]):not([type=checkbox]), .q-form textarea"); el?.focus(); } } };
  }

  /** Lobby: choose how to do it, and grant the microphone once. */
  function lobby(p: Person, mode: "owner" | "member", st: ScreenState): View {
    const mins = scriptMinutes(); const canVoice = speechSupported();
    const html = `<div class="lobby"><div class="lobby-card">
      <div class="eyebrow">${mode === "member" ? "Joining the network" : `Screening · ${esc(C().full(p))}`}</div>
      <h1>${mode === "member" ? `Let's have a ${mins}-minute conversation` : `Run the ${mins}-minute screening`}</h1>
      <p>${mode === "member" ? "It is a proper conversation, not a form. I ask, you talk, and I write it up. You can read and change every word before it goes anywhere, and nothing reaches your profile until a person has reviewed it." : "The script is read aloud so you can run it like a real call, or you can type the answers as you go."}</p>
      <div class="lobby-sections">${script().map((x: any) => `<div><b>${esc(x.title)}</b><small>${x.minutes} min · ${esc(x.intent)}</small></div>`).join("")}</div>
      <div class="lobby-actions">${canVoice ? btn("🎙 Start the voice conversation", 'data-act="scrStartVoice"', "primary lg") : ""}${btn(canVoice ? "I would rather type" : "Start", 'data-act="scrStartTyped"', canVoice ? "glass lg" : "primary lg")}</div>
      <small class="dim">${canVoice ? "Your browser will ask for the microphone. Audio stays on this device; only the text is kept." : "Voice is not available in this browser, so we will do it in writing."}</small>
    </div></div>`;
    return { title: "Screening", crumbs: mode === "member" ? [["My expert profile", "#/member"], ["Conversation"]] : [["Experts", "#/network"], [C().full(p), `#/people/${p.id}`], ["Screening"]], html: raw(html) };
  }

  /** Put a spoken answer into whatever control this question uses. */
  function applySpoken(cur: any, said: string) {
    const form = document.querySelector<HTMLFormElement>(".q-form"); if (!form || !said.trim()) return;
    if (cur.kind === "text" || cur.kind === "long" || cur.kind === "chips") { const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>("[name=a]"); if (el) el.value = said; return; }
    if (cur.kind === "select" || cur.kind === "multi") {
      const key = matchChoice(said, cur.options as [string, string][]);
      if (key) { const inp = form.querySelector<HTMLInputElement>(`input[name=a][value="${key}"]`); if (inp) { inp.checked = cur.kind === "multi" ? true : inp.checked || true; inp.closest("label")?.classList.add("on"); } }
      return;
    }
    if (cur.kind === "scale") { const n = matchScale(said); if (n) { const inp = form.querySelector<HTMLInputElement>(`input[name=a][value="${n}"]`); if (inp) { inp.checked = true; form.querySelectorAll(".scale-btns label").forEach((l, i) => l.classList.toggle("on", i + 1 === n)); } } return; }
    if (cur.kind === "people") { const names = splitSpokenList(said); const rows = form.querySelectorAll<HTMLInputElement>("input[name=pn]"); names.forEach((n, i) => { if (rows[i]) rows[i].value = n; }); const ctx = form.querySelector<HTMLInputElement>("input[name=pc]"); if (ctx && !ctx.value) ctx.value = said; }
  }

  function setVoiceUI(status: string, heard?: string, on = false, speaking = false) {
    const s1 = document.getElementById("voice-status"); const s2 = document.getElementById("voice-heard"); const mic = document.getElementById("mic"); const orb = document.getElementById("orb");
    if (s1) s1.textContent = status;
    if (s2 && heard !== undefined) s2.textContent = heard;
    mic?.classList.toggle("on", on);
    if (orb) orb.setAttribute("state", on ? "listening" : speaking ? "speaking" : "idle");
  }

  function startListening(cur: any) {
    const ok = listen({
      onText: (finalText, interim) => { setVoiceUI("Listening", [finalText, interim].filter(Boolean).join(" "), true); },
      onEnd: (reason, message) => {
        const heard = document.getElementById("voice-heard")?.textContent ?? "";
        if (reason === "error") { setVoiceUI(message ?? "Voice is not available. You can type instead.", heard, false); return; }
        if (heard.trim()) { applySpoken(cur, heard.trim()); setVoiceUI("Got that. Check it reads right, then continue.", heard, false); const d = document.querySelector<HTMLDetailsElement>(".type-instead"); if (d) d.open = true; }
        else setVoiceUI("I did not catch that. Tap the microphone to try again, or type.", "", false);
      },
    });
    if (ok) setVoiceUI("Listening", "", true);
    else setVoiceUI("Voice is not available in this browser. You can type instead.", "", false);
  }

  function wireVoice(cur: any) {
    const st = scr; if (!st) return;
    if (!st.voice) { stopListening(); stopSpeaking(); return; }
    const mic = document.getElementById("mic");
    mic?.addEventListener("click", () => { if (listening()) { stopListening(); setVoiceUI("Stopped. Tap to listen again.", undefined, false); } else { stopSpeaking(); startListening(cur); } });
    const prompt = [cur.prompt, cur.kind === "scale" ? `On a scale of one to five, where one is ${cur.low} and five is ${cur.high}.` : "", cur.kind === "select" || cur.kind === "multi" ? `Options are: ${(cur.options as [string, string][]).map(([, l]) => l).join(", ")}.` : ""].filter(Boolean).join(" ");
    setVoiceUI(st.muted ? "Tap the microphone when you are ready" : "Asking…", "", false, !st.muted);
    speak(prompt, st.muted).then(() => { if (scr === st && st.voice && document.getElementById("mic")) startListening(cur); });
  }

  function readAnswer(form: HTMLFormElement) {
    const qs = allQuestions(); const cur = qs[scr!.step]; const fd = new FormData(form);
    switch (cur.kind) {
      case "multi": return fd.getAll("a").map(String);
      case "chips": return String(fd.get("a") || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      case "people": { const n = fd.getAll("pn").map(String), c = fd.getAll("pc").map(String), e = fd.getAll("pe").map(String); return n.map((name, i) => ({ name: name.trim(), context: c[i]?.trim() ?? "", email: e[i]?.trim() || undefined })).filter((r) => r.name); }
      default: return String(fd.get("a") ?? "").trim();
    }
  }
  async function finishScreening() {
    const st = scr!; const p = C().person(st.personId)!; const r = C().screening.screeningToResult(st.answers); const now = C().nowISO();
    stopListening(); stopSpeaking();
    const c: Conversation = { id: C().uid(), personId: p.id, conductedById: st.mode === "member" ? p.id : S().me.id, date: now, type: "SCREENING", rawNotes: Object.entries(st.answers).map(([k, v]) => `${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`).join("\n"), transcript: null, aiSummary: r.summary, screening: r, approvalStatus: "NEEDS_REVIEW", tags: ["screening"] };
    await C().commit("conversations", c, { action: "summary.generate", entityType: "Conversation", entityId: c.id, detail: `${C().full(p)} · screening (${r.completeness}% complete)` });
    for (const ref of r.referrals) await C().commit("referrals", { id: C().uid(), referrerPersonId: p.id, referredPersonId: S().people.find((x) => C().full(x).toLowerCase() === ref.name.toLowerCase())?.id ?? null, name: ref.name, email: ref.email ?? null, context: ref.context, note: "Named in screening", briefId: null, status: "NEW", createdAt: now, updatedAt: now } as Referral);
    await C().commit("people", { ...p, screeningStatus: "SUBMITTED", attributes: Object.keys(r.attributes).length ? { ...(p.attributes ?? {}), ...r.attributes } : p.attributes ?? null, memberSince: p.memberSince ?? now, updatedAt: now });
    scr = null; C().toast(st.mode === "member" ? "Thank you. A person will review this and confirm your profile." : "Screening captured. Review the summary to apply it to the profile.");
    location.hash = st.mode === "member" ? "#/member" : `#/conversations?tab=review&open=${c.id}`;
  }

  // ----- member portal -----
  function member(q: URLSearchParams): View {
    const p = memberPerson() ?? S().people.find((x) => x.memberSince) ?? S().people[0];
    if (!p) return { title: "Member portal", crumbs: [["Member portal"]], html: raw(empty("No members yet")) };
    const tab = q.get("tab") ?? "home"; const t = C().trustOf(p);
    const open = S().briefs.filter((b: StoredBrief) => b.openToMembers && !["FILLED", "CLOSED"].includes(b.status));
    const myRefs = S().referrals.filter((r: Referral) => r.referrerPersonId === p.id).sort((a: Referral, b: Referral) => b.createdAt.localeCompare(a.createdAt));
    const myPitches = S().pitches.filter((x: Pitch) => x.personId === p.id);
    const screened = p.screeningStatus === "APPROVED" || !!p.screenedAt; const submitted = p.screeningStatus === "SUBMITTED";
    const anon = C().redactForPartner({ ...p, tenantId: "t", evidence: C().evOf(p.id), relationships: C().relsOf(p.id) });
    const highlights = C().fit.fitHighlights(C().fitOf(p));
    const oppCard = (b: StoredBrief) => { const pitched = myPitches.find((x: Pitch) => x.briefId === b.id); const refd = myRefs.filter((r: Referral) => r.briefId === b.id); return `<section class="card opp"><div class="body"><div class="row"><div><b class="t">${esc(b.roles[0] ?? "Requirement")}${b.headcount > 1 ? ` × ${b.headcount}` : ""}</b><small class="sub">${esc(b.engagementRoute ? L().ROUTE_LABELS[b.engagementRoute] : "route to confirm")} · ${esc(b.locations.join(" / ") || "location flexible")} · ${esc(b.sectors.join(", ") || "any sector")}</small></div>${badge("client name hidden", "neutral", true)}</div><p>${esc(b.memberSummary ?? safeSummary(b))}</p><div class="chips">${b.capabilities.map(chip).join("")}${b.workRights ? chip(b.workRights) : ""}${(b.fitTraits ?? []).map((k: string) => chip(`needs ${C().fit.ATTRIBUTES.find((a: any) => a.key === k)?.label.toLowerCase() ?? k}`)).join("")}</div><div class="row wrap">${pitched ? badge(`You pitched · ${PITCH_STATUS[pitched.status]}`, pitched.status === "SHORTLISTED" ? "teal" : "navy", true) : screened ? btn("Pitch with my profile", `data-act="pitch" data-id="${b.id}"`, "primary sm") : `<small class="dim">Complete your screening to pitch.</small>`}${btn("Refer someone", `data-act="referFor" data-id="${b.id}"`, "glass sm")}${refd.length ? badge(`${refd.length} referred`, "teal", true) : ""}</div></div></section>`; };
    let body = "";
    if (tab === "opportunities") body = `<div class="sect-head"><div><h2>Opportunities open to members</h2><p>Anonymised. Pitch with your own profile, or refer someone you would put your name behind. You are only ever named to a client with your consent.</p></div></div>${open.length ? `<div class="stack">${open.map(oppCard).join("")}</div>` : empty("Nothing open right now", "When a requirement is opened to members, it appears here.")}`;
    else if (tab === "refer") body = `<div class="grid-3"><div class="col-2 stack">${card("Refer someone", `<form data-action="refer" class="stack"><p class="dim">Only people you would genuinely stand behind. Your referral is anonymous to clients; we tell the person you sent them only if you say we can.</p><div class="grid-2">${field("Full name", input("name", "required"), undefined, true)}${field("Email or LinkedIn", input("email", 'placeholder="so we can reach them"'))}</div>${field("How you know them and what you have seen them do", textarea("context", 'rows="3" required placeholder="e.g. Ran the requirements workstream for me on the payments hub. Precise, calm, well liked by the business."'), undefined, true)}<div class="grid-2">${field("For an open opportunity?", select("briefId", opt(Object.fromEntries(open.map((b: StoredBrief) => [b.id, `${b.roles[0] ?? "Requirement"} · ${b.locations[0] ?? ""}`])), "", "— general referral —")))}${field("Anything else", input("note"))}</div>${check("tell", "You may tell them I referred them", true)}<div class="row end"><button class="btn primary" type="submit">Send referral</button></div></form>`, { desc: "This is what makes the network compound." })}</div><div class="stack">${card("Your referrals", myRefs.length ? `<ul class="rows">${myRefs.map((r: Referral) => `<li class="col"><div class="row"><b>${esc(r.name)}</b>${badge(REF_STATUS[r.status], r.status === "ACCEPTED" ? "teal" : r.status === "DECLINED" ? "neutral" : "amber", true)}</div><small class="dim">${esc(r.context)}</small></li>`).join("")}</ul>` : '<span class="dim">None yet.</span>', { desc: `${myRefs.filter((r: Referral) => r.status === "ACCEPTED").length} accepted into the network` })}</div></div>`;
    else body = `<div class="grid-3"><div class="col-2 stack">
      ${card("Your screening", screened ? `<div class="row"><span>${screenLabel(p)}<small class="sub">Completed ${esc(rel(p.screenedAt ?? p.memberSince))}. Your profile is live in the network.</small></span>${btn("Redo screening", `data-act="startScreening" data-id="${p.id}"`, "ghost sm")}</div>` : submitted ? `<div class="row"><span>${screenLabel(p)}<small class="sub">A person is reviewing your answers. You will be on the radar for opportunities as soon as it is confirmed.</small></span></div>` : `<div class="screen-cta"><div><b>Do your ${C().screening.SCREENING_MINUTES}-minute screening</b><p class="dim">Seven short sections: your story, expertise, availability, location and work rights, commercials, how you work, and who you would vouch for. It is the one thing every member does, and it is what puts you on the radar for opportunities.</p></div><div class="row wrap">${btn(speechSupported() ? "Start the voice interview" : "Start the screening", `data-act="startScreening" data-id="${p.id}"`, "primary")}${btn("Book a real call instead", `data-act="bookScreening" data-id="${p.id}"`, "glass")}</div></div>`, { desc: "A real conversation, structured. Nothing goes live until a person has reviewed it." })}
      <div class="sect-head"><div><h2>Open to members</h2><p>Requirements you can pitch for or refer into. Client names stay hidden.</p></div><a class="btn ghost sm" href="#/member?tab=opportunities">All</a></div>${open.length ? `<div class="stack">${open.slice(0, 2).map(oppCard).join("")}</div>` : empty("Nothing open right now")}
      ${fitCard(p, { self: true })}</div>
      <div class="stack">${trustCard(p, { self: true })}
      ${card("How the network sees you", `<ul class="rows anon-list"><li class="anon"><div class="row"><span class="row"><code>${esc(anon.ref)}</code><b>${esc(anon.headlineSummary || p.headline || "Profile")}</b></span></div><div class="chips">${chip(anon.region ?? "region undisclosed")}${chip(`availability: ${anon.availabilityBand}`)}${chip(`vouched by ${t.vouchedBy}`)}${highlights.map(chip).join("")}${C().demand.rateBand(p.rateExpectation ?? p.salaryExpectation) ? chip(C().demand.rateBand(p.rateExpectation ?? p.salaryExpectation)) : ""}</div><small class="dim">${esc(anon.evidenceSummary)}</small></li></ul>`, { desc: "This is the anonymised card a client or agency sees. Your name only after you consent." })}
      ${card("Your consent", `<form data-action="consent" data-id="${p.id}" class="stack"><div class="choice compact">${[["yes", "Refer me for opportunities"], ["ask", "Ask me each time"], ["no", "Not for now"]].map(([k, l]) => `<label class="${(p.referralConsent ?? "ask") === k ? "on" : ""}"><input type="radio" name="referralConsent" value="${k}" ${(p.referralConsent ?? "ask") === k ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div><div class="row end"><button class="btn glass sm" type="submit">Save</button></div></form>`, { desc: "You decide whether you are on the radar." })}
      ${card("Your referrals and pitches", `<ul class="rows">${myRefs.slice(0, 4).map((r: Referral) => `<li><span><b class="t">${esc(r.name)}</b><small class="sub">referral</small></span>${badge(REF_STATUS[r.status], r.status === "ACCEPTED" ? "teal" : "amber", true)}</li>`).join("")}${myPitches.map((x: Pitch) => `<li><span><b class="t">${esc(S().briefs.find((b: StoredBrief) => b.id === x.briefId)?.roles[0] ?? "Requirement")}</b><small class="sub">pitch</small></span>${badge(PITCH_STATUS[x.status], x.status === "SHORTLISTED" ? "teal" : "navy", true)}</li>`).join("")}${!myRefs.length && !myPitches.length ? '<li class="dim">None yet. Refer someone or pitch for an opportunity.</li>' : ""}</ul>`, { action: `<a class="btn ghost sm" href="#/member?tab=refer">Refer</a>` })}</div></div>`;
    const html = `<div class="member-hero"><div class="who">${avatar(p, "xl", true)}<div><div class="eyebrow">Network member${p.memberSince ? ` since ${esc(new Date(p.memberSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" }))}` : ""}</div><h1>${esc(C().full(p))}</h1><p>${esc(p.headline ?? "Add a headline in your screening")}</p><div class="meta">${screenLabel(p)}${availBadge(p)}${p.referralConsent === "yes" ? badge("on the radar", "teal", true) : p.referralConsent === "no" ? badge("not being referred", "neutral", true) : badge("asked each time", "amber", true)}</div></div></div><div class="hero-stats">${stat("Trust", t.score, C().trust.TRUST_BAND_LABEL[t.band])}${stat("Vouched by", t.vouchedBy, "people")}${stat("Referrals", myRefs.length, `${myRefs.filter((r: Referral) => r.status === "ACCEPTED").length} accepted`)}${stat("Open to you", open.length, "opportunities", "#/member?tab=opportunities")}</div></div>
      <nav class="tabs">${[["home", "Home"], ["opportunities", "Opportunities"], ["refer", "Refer someone"]].map(([k, l]) => `<a href="#/member${k === "home" ? "" : `?tab=${k}`}" class="${tab === k ? "active" : ""}">${l}</a>`).join("")}</nav>${body}`;
    return { title: "Member portal", crumbs: [["My network profile"]], html: raw(html) };
  }

  /** Admin editor for the screening script. Sections and questions, reorderable, saved for everyone. */
  function scriptEditor(): string {
    const sections = script();
    const kinds: Record<string, string> = { text: "Short answer", long: "Long answer", chips: "List (comma separated)", select: "Choose one", multi: "Choose several", scale: "1–5 scale", people: "People they know" };
    return card("The screening conversation", `<p class="dim">This is what every expert is asked, in order. It is read aloud on the voice call and used as the script when you run it yourself. Changes apply to the next conversation.</p>
      <div class="script-edit">${sections.map((sec: any, si: number) => `<section class="sec-edit">
        <form class="sec-head" data-action="secEdit" data-i="${si}">
          <input name="title" value="${esc(sec.title)}" class="t" aria-label="Section title">
          <input name="minutes" type="number" min="1" max="20" value="${sec.minutes}" class="mins" aria-label="Minutes"><span class="unit">min</span>
          <input name="intent" value="${esc(sec.intent)}" class="i" placeholder="Why this section exists" aria-label="Intent">
          <button class="btn glass sm" type="submit">Save</button>
          ${si > 0 ? btn("↑", `data-act="secUp" data-i="${si}"`, "ghost sm") : ""}${si < sections.length - 1 ? btn("↓", `data-act="secDown" data-i="${si}"`, "ghost sm") : ""}${btn("Remove", `data-act="secDel" data-i="${si}"`, "ghost sm")}
        </form>
        <ul class="q-edit">${sec.questions.map((q: any, qi: number) => `<li><form data-action="qEdit" data-i="${si}" data-q="${qi}">
          <input name="prompt" value="${esc(q.prompt)}" class="p" aria-label="Question">
          <input name="help" value="${esc(q.help ?? "")}" class="h" placeholder="Help text (optional)" aria-label="Help">
          <select name="kind" class="k" aria-label="Answer type">${opt(kinds, q.kind)}</select>
          <label class="check sm"><input type="checkbox" name="required" ${q.required ? "checked" : ""}><span>Required</span></label>
          <button class="btn glass sm" type="submit">Save</button>${qi > 0 ? btn("↑", `data-act="qUp" data-i="${si}" data-q="${qi}"`, "ghost sm") : ""}${btn("✕", `data-act="qDel" data-i="${si}" data-q="${qi}"`, "ghost sm")}
        </form></li>`).join("")}</ul>
        ${btn("＋ Add question", `data-act="qAdd" data-i="${si}"`, "ghost sm")}
      </section>`).join("")}</div>
      <div class="row wrap" style="margin-top:14px">${btn("＋ Add section", 'data-act="secAdd"', "glass sm")}${btn("Reset to the default script", 'data-act="scriptReset"', "ghost sm")}<span class="dim" style="margin-left:auto">${sections.length} sections · ${allQuestions().length} questions · about ${scriptMinutes()} minutes</span></div>`, { desc: "Configurable. What you ask is your call.", action: `<a class="btn glass sm" href="#/screening/${S().people[0]?.id ?? ""}?restart=1">Preview the call</a>` });
  }

  // ----- owner: referrals & pitches inbox -----
  function referrals(q: URLSearchParams): View {
    const tab = q.get("tab") ?? "referrals";
    const refs = S().referrals.slice().sort((a: Referral, b: Referral) => b.createdAt.localeCompare(a.createdAt));
    const pitches = S().pitches.slice().sort((a: Pitch, b: Pitch) => b.createdAt.localeCompare(a.createdAt));
    const joiners = S().people.filter((p: Person) => ["REGISTERED", "INVITED", "BOOKED", "SUBMITTED"].includes(p.screeningStatus ?? ""));
    const html = `<div class="page-head"><div><div class="eyebrow">Referral network</div><h1>Referrals & pitches</h1><p>People who know people. Every referral carries the referrer's name inside the network and nothing outside it.</p></div></div>
      <div class="stats-row">${stat("New referrals", refs.filter((r: Referral) => r.status === "NEW").length, "to triage")}${stat("Accepted", refs.filter((r: Referral) => r.status === "ACCEPTED").length, "into the network", undefined, "teal")}${stat("Pitches", pitches.filter((x: Pitch) => x.status === "SUBMITTED").length, "waiting")}${stat("Joining", joiners.length, "registered or in screening")}${stat("Members screened", S().people.filter((p: Person) => p.screeningStatus === "APPROVED" || p.screenedAt).length, undefined, undefined, "teal")}</div>
      <nav class="tabs">${[["referrals", "Referrals", refs.length], ["pitches", "Pitches", pitches.length], ["joining", "Joining", joiners.length]].map(([k, l, n]) => `<a href="#/referrals?tab=${k}" class="${tab === k ? "active" : ""}">${l}<i>${n}</i></a>`).join("")}</nav>
      ${tab === "pitches" ? (pitches.length ? `<div class="stack">${pitches.map((x: Pitch) => { const p = C().person(x.personId)!; const b = S().briefs.find((y: StoredBrief) => y.id === x.briefId); return `<section class="card"><div class="body"><div class="row">${personLink(p)}<span class="meta">${trustMini(p)}${badge(PITCH_STATUS[x.status], x.status === "SHORTLISTED" ? "teal" : "navy")}</span></div><ni-quote size="sm">${esc(x.note)}</ni-quote>${x.relevantWork ? `<small class="dim">Closest work: ${esc(x.relevantWork)}</small>` : ""}<div class="chips">${x.route ? chip(L().ROUTE_LABELS[x.route] ?? x.route) : ""}${x.availableFrom ? chip(`from ${x.availableFrom}`) : ""}${x.rate ? chip(x.rate) : ""}</div><small class="dim">For <a href="#/requirements/${x.briefId}"><b>${esc(b?.title ?? "requirement")}</b></a> · ${esc(rel(x.createdAt))}</small>${x.status === "SUBMITTED" ? `<div class="row wrap" style="margin-top:10px">${btn("Add to shortlist", `data-act="pitchShortlist" data-id="${x.id}"`, "primary sm")}${btn("Not this time", `data-act="pitchDecline" data-id="${x.id}"`, "ghost sm")}</div>` : ""}</div></section>`; }).join("")}</div>` : empty("No pitches yet", "Members pitch from their portal when a requirement is opened to them."))
      : tab === "joining" ? (joiners.length ? `<div class="card table-card"><div class="scroll"><table class="data"><thead><tr><th>Person</th><th>Came via</th><th>Status</th><th>Trust</th><th></th></tr></thead><tbody>${joiners.map((p: Person) => { const r = C().relsOf(p.id)[0]; return `<tr><td>${personLink(p)}</td><td class="dim">${esc(r ? L().SOURCE_LABELS[r.sourceType] : "—")}${r?.introducedById && C().person(r.introducedById) ? `<small class="sub">via ${esc(C().full(C().person(r.introducedById)!))}</small>` : ""}</td><td>${screenLabel(p)}</td><td>${trustMini(p)}</td><td class="nowrap">${p.screeningStatus === "SUBMITTED" ? `<a class="btn primary sm" href="#/conversations?tab=review">Review screening</a>` : `${btn("Run screening", `data-act="startScreening" data-id="${p.id}"`, "primary sm")} ${btn("Book call", `data-act="bookScreening" data-id="${p.id}"`, "glass sm")}`}</td></tr>`; }).join("")}</tbody></table></div></div>` : empty("Nobody joining right now", "New registrations from the join link appear here and in your alerts."))
      : (refs.length ? `<div class="stack">${refs.map((r: Referral) => { const ref = C().person(r.referrerPersonId); const existing = r.referredPersonId ? C().person(r.referredPersonId) : S().people.find((p: Person) => C().full(p).toLowerCase() === r.name.toLowerCase()); const b = r.briefId ? S().briefs.find((y: StoredBrief) => y.id === r.briefId) : null; return `<section class="card"><div class="body"><div class="row"><span><b class="t">${esc(r.name)}</b><small class="sub">referred by ${ref ? `<a href="#/people/${ref.id}">${esc(C().full(ref))}</a>` : "a member"} · ${esc(rel(r.createdAt))}${b ? ` · for <a href="#/requirements/${b.id}">${esc(b.title)}</a>` : ""}</small></span><span class="meta">${ref ? trustMini(ref) : ""}${badge(REF_STATUS[r.status], r.status === "ACCEPTED" ? "teal" : r.status === "NEW" ? "amber" : "navy")}</span></div><ni-quote size="sm">${esc(r.context)}</ni-quote>${r.note ? `<small class="dim">${esc(r.note)}</small>` : ""}${existing ? `<small class="dim">Already in the network: ${personLink(existing, null)}</small>` : ""}${r.status === "NEW" || r.status === "CONTACTED" ? `<div class="row wrap" style="margin-top:10px">${btn(existing ? "Link and accept" : "Accept into network", `data-act="refAccept" data-id="${r.id}"`, "primary sm")}${btn("Book screening", `data-act="refScreen" data-id="${r.id}"`, "glass sm")}${btn("Not now", `data-act="refDecline" data-id="${r.id}"`, "ghost sm")}</div>` : ""}</div></section>`; }).join("")}</div>` : empty("No referrals yet", "Members refer people from their portal and name them in screenings."))}`;
    return { title: "Referrals & pitches", crumbs: [["Referrals & pitches"]], html: raw(html) };
  }

  // ----- join (registration) -----
  function join(): View {
    const invited = S().people.filter((p: Person) => p.memberSince).length;
    const html = `<div class="join"><div class="join-hero"><div class="eyebrow">Invitation only</div><h1>Known. Not just matched.</h1><p>A referral network of people who know people. You join by invitation, have one real conversation, and from then on you are on the radar for work that suits you, and you can put your name behind people you trust. <b>Free for members, always.</b></p><ul class="join-points"><li><b>Free to join, free to stay.</b> Members are never charged. Companies and agencies pay us when a hire works out.</li>
      <li><b>One conversation, 30 minutes.</b> Talk it through out loud or type it. Your story, expertise, availability, work rights and how you work.</li><li><b>Anonymous until you say yes.</b> Clients see a capability card, never your name.</li><li><b>Trust, built by people.</b> Every person who vouches for you adds to your trust score.</li><li><b>Refer and be referred.</b> Pitch for opportunities, or refer someone you would stand behind.</li>
      <li><b>You are in control.</b> Say whether you want to be on the radar, and change your mind whenever.</li></ul><small class="dim">${invited} members · free to join · invitation only</small></div>
      <section class="card join-form"><div class="body"><h3>Register</h3><p class="dim">Takes a minute. Your screening comes next.</p><form data-action="register" class="stack"><div class="grid-2">${field("First name", input("firstName", "required"), undefined, true)}${field("Last name", input("lastName", "required"), undefined, true)}</div>${field("Email", input("email", 'type="email" required'), undefined, true)}${field("What you are known for", input("headline", 'placeholder="One line"'))}${field("LinkedIn profile", input("linkedinUrl", 'placeholder="https://linkedin.com/in/…"'), "Optional. We can import recommendations from here.")}${field("Who invited you?", select("referrerId", opt(Object.fromEntries(S().people.filter((p: Person) => p.memberSince).map((p: Person) => [p.id, C().full(p)])), "", "— choose —")), "Only members can invite. If you were not invited, ask the person who told you about us.", true)}${check("consent", "I understand my profile is anonymous to clients until I consent to an introduction", true)}<button class="btn primary" type="submit">Register and start screening</button></form></div></section></div>`;
    return { title: "Join the network", crumbs: [["Join the network"]], html: raw(html) };
  }

  // ----- actions -----
  const actions: Record<string, (el: HTMLElement) => Promise<void> | void> = {
    vouch(el) {
      const p = C().person(el.dataset.id!)!; const others = S().people.filter((x: Person) => x.id !== p.id);
      C().openDrawer(`Vouch for ${C().full(p)}`, "Putting your name behind someone. Say what you have seen, and rate how they work if you have observed it.", raw(`${field("Who is vouching", select("voucher", `<optgroup label="Network owners">${S().users.map((u: any) => `<option value="USER:${u.id}" ${u.id === S().me.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</optgroup><optgroup label="Network members">${others.map((x: Person) => `<option value="PERSON:${x.id}">${esc(C().full(x))}</option>`).join("")}</optgroup><optgroup label="External"><option value="EXTERNAL:">LinkedIn recommendation or reference (paste below)</option></optgroup>`), undefined, true)}${field("External name and source", input("voucherName", 'placeholder="e.g. Former CIO, Tier-1 bank · LinkedIn recommendation"'), "Only for external recommendations")}${field("Context", input("context", 'required placeholder="Where you saw them work"'), undefined, true)}${field("What you saw", textarea("statement", 'rows="3" placeholder="In a sentence or two. Specifics beat adjectives."'))}${check("wouldRecommend", "I would recommend them", true)}<div class="field"><span>How they work (only what you observed)</span><div class="attr-grid">${C().fit.ATTRIBUTES.map((a: any) => `<label class="attr"><span>${esc(a.label)}</span><select name="attr:${a.key}"><option value="">not observed</option>${[1, 2, 3, 4, 5].map((i) => `<option value="${i}">${i} · ${i <= 2 ? esc(a.low) : i >= 4 ? esc(a.high) : "in between"}</option>`).join("")}</select></label>`).join("")}</div></div>`), async (fd: FormData) => {
        const [kind, id] = String(fd.get("voucher")).split(":"); const attrs: Record<string, number> = {}; for (const a of C().fit.ATTRIBUTES) { const v = Number(fd.get(`attr:${a.key}`) || 0); if (v) attrs[a.key] = v; }
        const v: Vouch = { id: C().uid(), personId: p.id, voucherId: id || C().uid(), voucherKind: kind as Vouch["voucherKind"], voucherName: String(fd.get("voucherName") || "") || null, source: kind === "EXTERNAL" ? "LinkedIn recommendation" : null, context: String(fd.get("context") || ""), statement: String(fd.get("statement") || "") || null, wouldRecommend: fd.get("wouldRecommend") === "on", attributes: Object.keys(attrs).length ? attrs : null, createdAt: C().nowISO() };
        await C().commit("vouches", v, { action: "vouch.create", entityType: "Person", entityId: p.id, detail: `${C().full(p)} vouched for by ${kind === "EXTERNAL" ? v.voucherName ?? "external" : C().userName(v.voucherId)}` }); C().closeDrawer(); C().toast("Vouch recorded. Trust updated."); C().render();
      }, { submitLabel: "Vouch" });
    },
    async startScreening(el) { const p = C().person(el.dataset.id!)!; if (p.screeningStatus === "REGISTERED" || p.screeningStatus === "NONE" || !p.screeningStatus) await C().commit("people", { ...p, screeningStatus: me().role === "MEMBER" ? p.screeningStatus : "INVITED" }); scr = null; location.hash = `#/screening/${p.id}?restart=1`; },
    bookScreening(el) {
      const p = C().person(el.dataset.id!)!; const def = new Date(Date.now() + 2 * 86400e3); def.setHours(10, 0, 0, 0);
      C().openDrawer("Book a screening call", "A real 30-minute conversation. Outlook, Calendly or a manual slot.", raw(`${field("When", input("startAt", 'type="datetime-local"', def.toISOString().slice(0, 16)))}${field("Provider", select("provider", opt({ MANUAL: "Manual — phone or in person", MICROSOFT_GRAPH: "Outlook / Teams", CALENDLY: "Calendly link" }, "MANUAL")))}`), async (fd: FormData) => {
        const start = new Date(String(fd.get("startAt"))); await C().commit("scheduled", { id: C().uid(), personId: p.id, ownerId: S().me.id, provider: fd.get("provider"), startAt: start.toISOString(), endAt: new Date(start.getTime() + 30 * 60e3).toISOString(), meetingType: "SCREENING", status: "SCHEDULED" });
        await C().commit("people", { ...p, screeningStatus: "BOOKED", nextAction: "Screening call", nextActionDate: start.toISOString() }, { action: "conversation.schedule", entityType: "Person", entityId: p.id, detail: `Screening call · ${C().full(p)}` }); C().closeDrawer(); C().toast("Screening call booked"); C().render();
      }, { submitLabel: "Book" });
    },
    async secUp(el) { const i = Number(el.dataset.i); const sc = [...script()]; [sc[i - 1], sc[i]] = [sc[i], sc[i - 1]]; await C().saveScript(sc); C().render(); },
    async secDown(el) { const i = Number(el.dataset.i); const sc = [...script()]; [sc[i + 1], sc[i]] = [sc[i], sc[i + 1]]; await C().saveScript(sc); C().render(); },
    async secDel(el) { const i = Number(el.dataset.i); if (!confirm("Remove this section and its questions?")) return; const sc = script().filter((_: any, x: number) => x !== i); await C().saveScript(sc); C().logAudit("screening.config", "Settings", null, "section removed"); C().render(); },
    async secAdd() { const sc = [...script(), { key: `s${Date.now()}`, title: "New section", minutes: 3, intent: "What this section is for", questions: [{ key: `q${Date.now()}`, prompt: "Your question?", kind: "long" }] }]; await C().saveScript(sc); C().toast("Section added"); C().render(); },
    async qAdd(el) { const i = Number(el.dataset.i); const sc = script().map((x: any, n: number) => (n === i ? { ...x, questions: [...x.questions, { key: `q${Date.now()}`, prompt: "Your question?", kind: "long" }] } : x)); await C().saveScript(sc); C().render(); },
    async qUp(el) { const i = Number(el.dataset.i), qi = Number(el.dataset.q); const sc = script().map((x: any, n: number) => { if (n !== i) return x; const qq = [...x.questions]; [qq[qi - 1], qq[qi]] = [qq[qi], qq[qi - 1]]; return { ...x, questions: qq }; }); await C().saveScript(sc); C().render(); },
    async qDel(el) { const i = Number(el.dataset.i), qi = Number(el.dataset.q); const sc = script().map((x: any, n: number) => (n === i ? { ...x, questions: x.questions.filter((_: any, m: number) => m !== qi) } : x)); await C().saveScript(sc); C().render(); },
    async scriptReset() { if (!confirm("Reset the screening conversation to the default script?")) return; await C().saveScript(JSON.parse(JSON.stringify(C().screening.SCREENING_SCRIPT))); C().logAudit("screening.config", "Settings", null, "reset to default"); C().toast("Reset to the default script"); C().render(); },
    scrStartVoice() { if (!scr) return; scr.voice = true; scr.started = true; scr.startedAt = Date.now(); C().render(); },
    scrStartTyped() { if (!scr) return; scr.voice = false; scr.started = true; scr.startedAt = Date.now(); C().render(); },
    scrVoiceToggle() { if (!scr) return; scr.voice = !scr.voice; stopListening(); stopSpeaking(); C().render(); },
    scrMute() { if (!scr) return; scr.muted = !scr.muted; if (scr.muted) stopSpeaking(); C().render(); },
    scrLeave() { stopListening(); stopSpeaking(); const st = scr; C().toast("Saved. Pick up where you left off whenever."); location.hash = st?.mode === "member" ? "#/member" : `#/people/${st?.personId}`; },
    scrAddPerson() { const rows = document.getElementById("people-rows"); if (rows) rows.insertAdjacentHTML("beforeend", `<div class="grid-3f"><input name="pn" placeholder="Full name"><input name="pc" placeholder="What you have seen them do, and how you know them"><input name="pe" placeholder="Email (optional)"></div>`); },
    scrBack() { if (scr && scr.step > 0) { stopListening(); stopSpeaking(); scr.step--; C().render(); } },
    async scrSkip() { if (!scr) return; stopListening(); stopSpeaking(); const qs = allQuestions(); if (scr.step >= qs.length - 1) { await finishScreening(); return; } scr.step++; C().render(); },
    pitch(el) {
      const b = S().briefs.find((x: StoredBrief) => x.id === el.dataset.id)!; const p = memberPerson()!;
      C().openDrawer("Put yourself forward", "The client never sees your name. They see what you can do, and they come to Amana Network to ask for you.", raw(`<div class="how-read">${chip(b.roles[0] ?? "Requirement")}${chip(b.locations.join(" / ") || "flexible")}${chip(b.engagementRoute ? L().ROUTE_LABELS[b.engagementRoute] : "route tbc")}${b.workRights ? chip(b.workRights) : ""}</div>${field("Why you, in your own words", textarea("note", 'rows="4" required placeholder="What you have done that is closest to this, and why now."'), "This is the line the client reads on your anonymous card.", true)}${field("The closest piece of work you have done", textarea("relevantWork", 'rows="3" placeholder="Situation, what you did, what happened."'), "Shown to the client as evidence, still without your name.")}<div class="grid-2">${field("What you want here", select("route", opt(L().ROUTE_LABELS, b.engagementRoute ?? p.engagementPreferences[0] ?? "CONTRACT")), "Permanent, contract, fractional…")}${field("When you could start", input("availableFrom", 'placeholder="e.g. 4 weeks, or from January"', p.noticePeriod ?? ""))}${field("Rate or salary you want", input("rate", 'placeholder="e.g. £1,200/day or £150k"', p.rateExpectation ?? p.salaryExpectation ?? ""), "Shown to the client as a band, never the exact number.")}</div>`), async (fd: FormData) => {
        const now = C().nowISO(); const note = String(fd.get("note") || "");
        if (note.trim().length < 5) { C().toast("Say a little about why you", "amber"); return; }
        await C().commit("pitches", { id: C().uid(), briefId: b.id, personId: p.id, note, relevantWork: String(fd.get("relevantWork") || "") || null, route: String(fd.get("route") || "") || null, availableFrom: String(fd.get("availableFrom") || "") || null, rate: String(fd.get("rate") || "") || null, status: "SUBMITTED", createdAt: now, updatedAt: now } as Pitch, { action: "pitch.create", entityType: "Brief", entityId: b.id, detail: `${C().full(p)} put themselves forward` }); C().closeDrawer(); C().toast("Sent. Amana Network will come back to you."); C().render();
      }, { wide: true, submitLabel: "Put me forward" });
    },
    referFor(el) { location.hash = `#/member?tab=refer&for=${el.dataset.id}`; setTimeout(() => { const sel = document.querySelector<HTMLSelectElement>("form[data-action=refer] select[name=briefId]"); if (sel) sel.value = el.dataset.id!; }, 50); },
    async refAccept(el) {
      const r = S().referrals.find((x: Referral) => x.id === el.dataset.id)!; const now = C().nowISO(); const ref = C().person(r.referrerPersonId);
      let person = r.referredPersonId ? C().person(r.referredPersonId) : S().people.find((p: Person) => C().full(p).toLowerCase() === r.name.toLowerCase());
      if (!person) { const [firstName, ...rest] = r.name.split(" "); person = { id: C().uid(), firstName, lastName: rest.join(" ") || "—", email: r.email ?? null, headline: null, targetLocations: [], capabilities: [], sectors: [], engagementPreferences: [], availabilityStatus: "NEEDS_REFRESH", availabilityConfidence: 30, relocationInterest: false, amanaBench: false, usedByAmana: false, screeningStatus: "INVITED", memberSince: now, nextAction: "Screening call", nextActionDate: new Date(Date.now() + 3 * 86400e3).toISOString(), createdAt: now, updatedAt: now } as Person; await C().commit("people", person, { action: "person.create", entityType: "Person", entityId: person.id, detail: `${r.name} via referral` }); await C().commit("relationships", { id: C().uid(), personId: person.id, networkOwnerId: S().me.id, sourceType: "INTRODUCTION", relationshipType: "INTRODUCED", introducedById: r.referrerPersonId, workedTogether: false, relationshipNotes: `Referred by ${ref ? C().full(ref) : "a member"}: ${r.context}`, lastContactDate: now } as Relationship); }
      await C().commit("referrals", { ...r, referredPersonId: person.id, status: "ACCEPTED", updatedAt: now }, { action: "referral.accept", entityType: "Person", entityId: person.id, detail: r.name });
      C().toast(`${r.name} is in the network. Screening next.`); C().render();
    },
    async refScreen(el) { const r = S().referrals.find((x: Referral) => x.id === el.dataset.id)!; await actions.refAccept(el); const p = S().people.find((x: Person) => x.id === S().referrals.find((y: Referral) => y.id === r.id)?.referredPersonId); if (p) { const e = document.createElement("i"); e.dataset.id = p.id; actions.bookScreening(e); } },
    async refDecline(el) { const r = S().referrals.find((x: Referral) => x.id === el.dataset.id)!; await C().commit("referrals", { ...r, status: "DECLINED", updatedAt: C().nowISO() }); C().toast("Noted"); C().render(); },
    async pitchShortlist(el) {
      const x = S().pitches.find((y: Pitch) => y.id === el.dataset.id)!; const b = S().briefs.find((y: StoredBrief) => y.id === x.briefId)!; const p = C().person(x.personId)!; const now = C().nowISO();
      const res = C().demand.matchBrief(b, [C().toBriefPerson(p)], 1)[0]; const ex = S().shortlist.find((s: ShortlistItem) => s.briefId === b.id && s.personId === p.id);
      await C().commit("shortlist", { id: ex?.id ?? C().uid(), briefId: b.id, personId: p.id, fitScore: res?.match.fitScore ?? 50, fitExplanation: res?.match.fitExplanation ?? "Pitched by the member.", dimensions: res?.match.dimensions ?? [], uncertainty: res?.match.uncertainty ?? [], checks: res?.checks ?? [], tier: res?.tier ?? "conversation", decision: "SHORTLISTED", note: `Pitched: ${x.note}`, clientNote: ex?.clientNote ?? null, createdAt: ex?.createdAt ?? now, updatedAt: now } as ShortlistItem);
      await C().commit("pitches", { ...x, status: "SHORTLISTED", updatedAt: now }, { action: "pitch.shortlist", entityType: "Brief", entityId: b.id, detail: C().full(p) }); C().toast("Added to the shortlist"); C().render();
    },
    async pitchDecline(el) { const x = S().pitches.find((y: Pitch) => y.id === el.dataset.id)!; await C().commit("pitches", { ...x, status: "DECLINED", updatedAt: C().nowISO() }); C().toast("Noted"); C().render(); },
  };

  // ----- forms -----
  const forms: Record<string, (fd: FormData, form: HTMLFormElement) => Promise<void> | void> = {
    async scrNext(fd, form) {
      if (!scr) return; const qs = allQuestions(); const cur = qs[scr.step]; const a = readAnswer(form);
      if (cur.required && (Array.isArray(a) ? !a.length : !a)) { C().toast("This one matters. Give it a go.", "amber"); return; }
      stopListening(); stopSpeaking();
    scr.answers[cur.key] = a; if (scr.step >= qs.length - 1) { await finishScreening(); return; } scr.step++; C().render();
    },
    async refer(fd) {
      const p = memberPerson() ?? S().people.find((x: Person) => x.memberSince)!; const now = C().nowISO();
      const r: Referral = { id: C().uid(), referrerPersonId: p.id, referredPersonId: S().people.find((x: Person) => C().full(x).toLowerCase() === String(fd.get("name")).trim().toLowerCase())?.id ?? null, name: String(fd.get("name") || "").trim(), email: String(fd.get("email") || "") || null, context: String(fd.get("context") || ""), note: [String(fd.get("note") || ""), fd.get("tell") === "on" ? "May be told who referred them." : "Do not reveal the referrer."].filter(Boolean).join(" "), briefId: String(fd.get("briefId") || "") || null, status: "NEW", createdAt: now, updatedAt: now };
      if (!r.name) return; await C().commit("referrals", r, { action: "referral.create", entityType: "Person", entityId: p.id, detail: `${C().full(p)} referred ${r.name}` }); C().toast(`Thank you. ${r.name} is with us to review.`); location.hash = "#/member?tab=refer"; C().render();
    },
    async secEdit(fd, form) { const i = Number(form.dataset.i); const sc = script().map((x: any, n: number) => (n === i ? { ...x, title: String(fd.get("title") || x.title), minutes: Number(fd.get("minutes") || x.minutes), intent: String(fd.get("intent") || x.intent) } : x)); await C().saveScript(sc); C().logAudit("screening.config", "Settings", null, `section: ${fd.get("title")}`); C().toast("Saved"); C().render(); },
    async qEdit(fd, form) { const i = Number(form.dataset.i), qi = Number(form.dataset.q); const sc = script().map((x: any, n: number) => (n === i ? { ...x, questions: x.questions.map((q: any, m: number) => (m === qi ? { ...q, prompt: String(fd.get("prompt") || q.prompt), help: String(fd.get("help") || "") || undefined, kind: String(fd.get("kind") || q.kind), required: fd.get("required") === "on" } : q)) } : x)); await C().saveScript(sc); C().logAudit("screening.config", "Settings", null, `question: ${fd.get("prompt")}`); C().toast("Saved"); C().render(); },
    async consent(fd, form) { const p = C().person(form.dataset.id!)!; await C().commit("people", { ...p, referralConsent: String(fd.get("referralConsent")) as Person["referralConsent"], updatedAt: C().nowISO() }, { action: "consent.update", entityType: "Person", entityId: p.id, detail: String(fd.get("referralConsent")) }); C().toast("Saved"); C().render(); },
    async register(fd) {
      const now = C().nowISO(); const referrer = C().person(String(fd.get("referrerId") || ""));
      if (!referrer) { C().toast("Choose who invited you", "amber"); return; }
      const p: Person = { id: C().uid(), firstName: String(fd.get("firstName") || "").trim(), lastName: String(fd.get("lastName") || "").trim(), email: String(fd.get("email") || "") || null, headline: String(fd.get("headline") || "") || null, linkedinUrl: String(fd.get("linkedinUrl") || "") || null, targetLocations: [], capabilities: [], sectors: [], engagementPreferences: [], availabilityStatus: "NEEDS_REFRESH", availabilityConfidence: 30, relocationInterest: false, amanaBench: false, usedByAmana: false, screeningStatus: "REGISTERED", referralConsent: "ask", memberSince: now, nextAction: "Screening call", nextActionDate: new Date(Date.now() + 3 * 86400e3).toISOString(), createdAt: now, updatedAt: now } as Person;
      if (!p.firstName || !p.lastName) return;
      await C().commit("people", p, { action: "member.register", entityType: "Person", entityId: p.id, detail: `${C().full(p)} registered via ${C().full(referrer)}` });
      await C().commit("relationships", { id: C().uid(), personId: p.id, networkOwnerId: S().me.id, sourceType: "INBOUND", relationshipType: "INTRODUCED", introducedById: referrer.id, workedTogether: false, relationshipNotes: `Registered through ${C().full(referrer)}'s invitation.`, lastContactDate: now } as Relationship);
      C().setViewAs({ role: "MEMBER", personId: p.id }); scr = null; C().toast(`Welcome, ${p.firstName}. ${S().me.name} has been alerted. Your screening starts now.`); location.hash = `#/screening/${p.id}?restart=1`;
    },
  };

  return { screening, member, referrals, join, scriptEditor, trustCard, fitCard, vouchList, trustMini, chainOf, screenLabel, actions, forms };
}
