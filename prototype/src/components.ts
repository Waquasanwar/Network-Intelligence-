/**
 * Web components for Network Intelligence.
 *
 * The design thesis: a person's words carry the judgement, the system carries the structure.
 * One sans does the talking, at different weights and sizes; the mono voice is kept for the small
 * uppercase labels and reference codes the system produces. Figures are the sans with tabular
 * numerals — a display face on a number reads as decoration rather than data.
 *
 * All are native Custom Elements with shadow DOM, so their styling cannot leak or be leaked
 * into, and they work anywhere in the app without a framework.
 */

const sheet = (css: string) => { const s = new CSSStyleSheet(); s.replaceSync(css); return s; };

/** Tokens every component inherits from the page, so light and dark follow the host. */
const BASE = `
  :host { --ink: var(--c-ink, #131714); --ink-2: var(--c-ink-2, #5c635c); --ink-3: var(--c-ink-3, #8e948d);
    --rule: var(--c-rule, rgba(19,23,20,0.12)); --paper: var(--c-paper, #fff); --sunk: var(--c-sunk, #f3f4f1);
    --trust: var(--c-trust, #186b4e); --trust-b: var(--c-trust-b, #2f9e6f); --alert: var(--c-alert, #9a6212); --alert-b: var(--c-alert-b, #d08a1f); --stop: var(--c-stop, #a3352b);
    --accent: var(--c-accent, #186b4e); --accent-b: var(--c-accent-b, #2f9e6f);
    --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace; --sans: "Inter Tight", ui-sans-serif, system-ui, sans-serif; --serif: var(--sans);
    display: inline-block; }
  * { box-sizing: border-box; }
`;

// ---------- <ni-chain>: the signature. Who stands behind this person, as a chain. ----------
class Chain extends HTMLElement {
  static observedAttributes = ["people", "count", "score", "anon", "compact"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const anon = this.hasAttribute("anon");
    const compact = this.hasAttribute("compact");
    const names = (this.getAttribute("people") ?? "").split("|").map((s) => s.trim()).filter(Boolean);
    const count = Number(this.getAttribute("count") ?? names.length);
    const score = this.getAttribute("score");
    const shown = names.slice(0, compact ? 3 : 5);
    const extra = count - shown.length;
    const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { vertical-align: middle; }
      .c { display: inline-flex; align-items: center; gap: 0; }
      .n { position: relative; width: ${compact ? 20 : 24}px; height: ${compact ? 20 : 24}px; border-radius: 50%; display: grid; place-items: center;
        font: 600 ${compact ? 8.5 : 9.5}px/1 var(--mono); letter-spacing: 0.02em; color: var(--paper); background: var(--trust);
        box-shadow: 0 0 0 2px var(--paper); margin-right: -6px; }
      .n:nth-child(2) { background: color-mix(in srgb, var(--trust) 86%, var(--ink)); }
      .n:nth-child(3) { background: color-mix(in srgb, var(--trust) 72%, var(--ink)); }
      .n:nth-child(4) { background: color-mix(in srgb, var(--trust) 58%, var(--ink)); }
      .n:nth-child(5) { background: color-mix(in srgb, var(--trust) 44%, var(--ink)); }
      .n.anon { background: var(--ink-3); color: var(--paper); font-size: ${compact ? 9 : 10}px; }
      .more { margin-left: 10px; font: 500 ${compact ? 11 : 11.5}px/1 var(--mono); color: var(--ink-3); }
      .score { margin-left: 10px; padding: 2px 7px; border-radius: 999px; background: color-mix(in srgb, var(--trust) 12%, transparent);
        color: var(--trust); font: 600 ${compact ? 11 : 12}px/1.4 var(--mono); }
      .none { font: 400 ${compact ? 11.5 : 12.5}px/1 var(--sans); color: var(--ink-3); font-style: italic; }
    `)];
    if (!count) { this.#root.innerHTML = `<span class="none">nobody yet</span>`; return; }
    this.#root.innerHTML = `<span class="c" title="${anon ? `${count} people vouch for this person` : `Vouched for by ${names.join(", ")}`}">
      ${shown.map((n) => `<span class="n ${anon ? "anon" : ""}">${anon ? "✓" : initials(n)}</span>`).join("")}
      ${extra > 0 ? `<span class="more">+${extra}</span>` : ""}
      ${score ? `<span class="score">${score}</span>` : ""}
    </span>`;
  }
}

// ---------- <ni-trust>: the dial ----------
class Trust extends HTMLElement {
  static observedAttributes = ["score", "band", "size"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const score = Number(this.getAttribute("score") ?? 0);
    const size = Number(this.getAttribute("size") ?? 72);
    const band = this.getAttribute("band") ?? "";
    const tone = score >= 60 ? "var(--trust-b)" : score >= 35 ? "var(--alert-b)" : "var(--ink-3)";
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      .d { position: relative; width: ${size}px; height: ${size}px; }
      svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      /* The track is a lighter step of the same colour, so the dial reads as one object. */
      .t { fill: none; stroke: color-mix(in srgb, ${tone} 16%, transparent); stroke-width: 4.5; }
      .v { fill: none; stroke: ${tone}; stroke-width: 4.5; stroke-linecap: round; transition: stroke-dasharray 760ms cubic-bezier(0.22,1,0.36,1); }
      .f { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; line-height: 1; }
      b { font: 600 ${Math.round(size * 0.34)}px/1 var(--sans); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; color: var(--ink); }
      small { display: block; margin-top: 4px; font: 500 ${Math.max(8.5, size * 0.105)}px/1 var(--mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-3); }
      @media (prefers-reduced-motion: reduce) { .v { transition: none; } }
    `)];
    this.#root.innerHTML = `<div class="d"><svg viewBox="0 0 40 40"><circle class="t" cx="20" cy="20" r="18"/><circle class="v" cx="20" cy="20" r="18" pathLength="100" stroke-dasharray="${score} 100"/></svg><div class="f"><b>${score}</b>${band ? `<small>${band}</small>` : ""}</div></div>`;
  }
}

// ---------- <ni-quote>: a human sentence, in the serif voice ----------
class Quote extends HTMLElement {
  static observedAttributes = ["by", "context", "size", "when"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const size = this.getAttribute("size") ?? "md";
    const px = size === "xl" ? 40 : size === "lg" ? 23 : size === "sm" ? 14.5 : 17;
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { display: block; }
      blockquote { margin: 0; font: ${size === "xl" ? 600 : 450} ${px}px/${size === "xl" ? 1.12 : 1.45} var(--sans); letter-spacing: ${size === "xl" ? "-0.035em" : "-0.011em"}; color: var(--ink); text-wrap: pretty; }
      .a { margin-top: ${size === "xl" ? 20 : 10}px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px;
        font: 500 ${size === "xl" ? 12 : 11}px/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.09em; color: var(--ink-3); }
      .a b { color: var(--ink-2); font-weight: 600; }
      .a .ctx { text-transform: none; letter-spacing: 0; font-family: var(--sans); font-size: ${size === "xl" ? 13 : 12}px; color: var(--ink-3); }
    `)];
    const by = this.getAttribute("by"); const ctx = this.getAttribute("context"); const when = this.getAttribute("when");
    this.#root.innerHTML = `<blockquote><slot></slot></blockquote>${by || ctx ? `<div class="a">${by ? `<b>${by}</b>` : ""}${ctx ? `<span class="ctx">${ctx}</span>` : ""}${when ? `<span>${when}</span>` : ""}</div>` : ""}`;
  }
}

// ---------- <ni-tag>: status, in the mono voice ----------
class Tag extends HTMLElement {
  static observedAttributes = ["tone", "solid", "icon"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const tone = this.getAttribute("tone") ?? "neutral";
    const c = { trust: "var(--trust)", alert: "var(--alert)", stop: "var(--stop)", neutral: "var(--ink-2)" }[tone] ?? "var(--ink-2)";
    const solid = this.hasAttribute("solid");
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { vertical-align: middle; }
      span { display: inline-flex; align-items: center; gap: 5px; padding: ${solid ? "3px 8px" : "0"}; border-radius: 999px;
        background: ${solid ? `color-mix(in srgb, ${c} 11%, transparent)` : "transparent"};
        font: 500 11px/1.5 var(--mono); text-transform: uppercase; letter-spacing: 0.07em; color: ${c}; white-space: nowrap; }
      i { width: 5px; height: 5px; border-radius: 50%; background: ${c}; display: ${solid || this.hasAttribute("icon") ? "none" : "block"}; }
      ni-icon, ::slotted(ni-icon) { color: ${c}; }
    `)];
    const ic = this.getAttribute("icon");
    this.#root.innerHTML = `<span>${ic ? `<ni-icon name="${ic}" size="12"></ni-icon>` : "<i></i>"}<slot></slot></span>`;
  }
}

// ---------- <ni-meter>: the fit scale, self against observed ----------
class Meter extends HTMLElement {
  static observedAttributes = ["self", "peers", "low", "high", "label", "peercount", "wanted"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const self = this.getAttribute("self"); const peers = this.getAttribute("peers");
    const pc = Number(this.getAttribute("peercount") ?? 0); const wanted = this.hasAttribute("wanted");
    const pos = (v: string) => `${((Number(v) - 1) / 4) * 100}%`;
    const combined = peers !== null && self !== null ? (pc >= 2 ? Number(peers) * 0.7 + Number(self) * 0.3 : (Number(peers) + Number(self)) / 2) : Number(peers ?? self ?? 0);
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { display: block; }
      .r { display: grid; grid-template-columns: 150px 1fr 66px; gap: 14px; align-items: center; padding: ${wanted ? "7px 9px" : "7px 0"}; border-radius: 9px;
        background: ${wanted ? "color-mix(in srgb, var(--trust) 7%, transparent)" : "transparent"}; margin: ${wanted ? "0 -9px" : "0"}; }
      .lab { font: 450 13px/1.3 var(--sans); color: var(--ink); }
      .lab em { display: block; font: 500 9.5px/1.4 var(--mono); font-style: normal; text-transform: uppercase; letter-spacing: 0.08em; color: var(--trust); margin-top: 2px; }
      .scale { display: grid; grid-template-columns: auto 1fr auto; gap: 9px; align-items: center; }
      .end { font: 400 10.5px/1.3 var(--sans); color: var(--ink-3); max-width: 84px; }
      .track { position: relative; height: 3px; border-radius: 999px; background: var(--rule); }
      .track i { position: absolute; top: 50%; width: 11px; height: 11px; border-radius: 50%; transform: translate(-50%, -50%); }
      .track i.s { background: var(--paper); box-shadow: 0 0 0 2px var(--ink-3); }
      .track i.p { background: var(--trust-b); box-shadow: 0 0 0 2px var(--paper); }
      .out { text-align: right; font: 400 13px/1.2 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; }
      .out small { display: block; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-3); margin-top: 2px; }
      @media (max-width: 900px) { .r { grid-template-columns: 1fr; gap: 5px; } .out { text-align: left; } }
    `)];
    this.#root.innerHTML = `<div class="r">
      <div class="lab">${this.getAttribute("label") ?? ""}${wanted ? "<em>asked for</em>" : ""}</div>
      <div class="scale"><span class="end">${this.getAttribute("low") ?? ""}</span>
        <div class="track">${self !== null ? `<i class="s" style="left:${pos(self)}" title="Self-assessed ${self} of 5"></i>` : ""}${peers !== null ? `<i class="p" style="left:${pos(peers)}" title="Observed by ${pc}: ${peers} of 5"></i>` : ""}</div>
        <span class="end">${this.getAttribute("high") ?? ""}</span></div>
      <div class="out">${combined ? `${Math.round(combined * 10) / 10}` : "—"}<small>${pc ? `${pc} saw it` : self !== null ? "self" : "not asked"}</small></div>
    </div>`;
  }
}

// ---------- <ni-orb>: the voice interviewer ----------
class Orb extends HTMLElement {
  static observedAttributes = ["state"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const state = this.getAttribute("state") ?? "idle";
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      .o { position: relative; width: 88px; height: 88px; border-radius: 50%; display: grid; place-items: center; }
      .core { position: absolute; inset: 14px; border-radius: 50%; background: conic-gradient(from 210deg, var(--trust-b), var(--trust), color-mix(in srgb, var(--trust-b) 50%, var(--paper)), var(--trust-b)); filter: blur(1px); }
      .veil { position: absolute; inset: 14px; border-radius: 50%; background: radial-gradient(circle at 34% 30%, rgba(255,255,255,0.75), transparent 62%); }
      .ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--trust) 34%, transparent); }
      .o.speaking .core { animation: breathe 2.6s ease-in-out infinite; }
      .o.listening .ring { animation: ripple 1.9s ease-out infinite; }
      .o.idle .core { opacity: 0.45; filter: blur(2px) saturate(0.7); }
      @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.09); } }
      @keyframes ripple { 0% { transform: scale(0.94); opacity: 0.9; } 100% { transform: scale(1.3); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .core, .ring { animation: none !important; } }
    `)];
    this.#root.innerHTML = `<div class="o ${state}"><div class="core"></div><div class="veil"></div><div class="ring"></div></div>`;
  }
}

// ---------- <ni-rule>: a labelled section rule, the structural device ----------
class Rule extends HTMLElement {
  static observedAttributes = ["label", "note", "index"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { display: block; }
      .r { display: flex; align-items: baseline; gap: 12px; padding-bottom: 9px; border-bottom: 1px solid var(--rule); }
      .i { font: 500 10.5px/1 var(--mono); color: var(--ink-3); letter-spacing: 0.06em; }
      b { font: 550 13.5px/1.2 var(--sans); letter-spacing: -0.01em; color: var(--ink); }
      .n { font: 400 12.5px/1.4 var(--sans); color: var(--ink-3); margin-left: auto; text-align: right; max-width: 52ch; }
      ::slotted(*) { margin-left: auto; }
      @media (max-width: 760px) { .n { display: none; } }
    `)];
    const idx = this.getAttribute("index");
    this.#root.innerHTML = `<div class="r">${idx ? `<span class="i">${idx}</span>` : ""}<b>${this.getAttribute("label") ?? ""}</b>${this.getAttribute("note") ? `<span class="n">${this.getAttribute("note")}</span>` : ""}<slot></slot></div>`;
  }
}


// ---------- <ni-icon>: one stroke-based set, used everywhere ----------
const ICONS: Record<string, string> = {
  vouch: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  worked: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  evidence: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  conversation: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  screening: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  fresh: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  referral: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><path d="M17 8h5M19.5 5.5v5"/>',
  caution: '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  trust: '<path d="M12 2.5 4 6v6c0 5 3.4 8.7 8 9.5 4.6-.8 8-4.5 8-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2"/>',
  brief: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="17.5" cy="16.5" r="3"/><path d="m20 19 2 2"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5"/><path d="M12 6v12"/>',
  check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
  cross: '<path d="M6 6l12 12M18 6 6 18"/>',
  ask: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01"/>',
  near: '<path d="M4 12h16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};

class Icon extends HTMLElement {
  static observedAttributes = ["name", "size", "tone"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const size = Number(this.getAttribute("size") ?? 16);
    const tone = this.getAttribute("tone");
    const c = { trust: "var(--trust)", alert: "var(--alert)", stop: "var(--stop)", mute: "var(--ink-3)" }[tone ?? ""] ?? "currentColor";
    this.#root.adoptedStyleSheets = [sheet(`${BASE} :host { line-height: 0; vertical-align: middle; } svg { width: ${size}px; height: ${size}px; display: block; color: ${c}; }`)];
    this.#root.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[this.getAttribute("name") ?? ""] ?? ""}</svg>`;
  }
}

// ---------- <ni-stat>: the dashboard widget. Label, figure, movement, and the shape of it. ----------
/**
 * A stat tile the way a stat tile should be: the label in the small mono voice, the figure large
 * in the sans with tabular numerals, an optional signed delta against a named period, and a
 * twelve-point sparkline built from real dates. The sparkline is de-emphasised; only the last
 * point wears the accent, because that is the value the figure is showing.
 */
class Stat extends HTMLElement {
  static observedAttributes = ["label", "value", "note", "delta", "delta-label", "tone", "spark", "href", "good", "ghost"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const tone = this.getAttribute("tone") ?? "";
    const c = tone === "trust" ? "var(--trust-b)" : tone === "alert" ? "var(--alert-b)" : tone === "stop" ? "var(--stop)" : "var(--accent-b)";
    const delta = Number(this.getAttribute("delta") ?? "");
    const hasDelta = Number.isFinite(delta) && delta !== 0;
    // Up is good unless the tile says otherwise: "needs a check" going up is not a win.
    const upIsGood = (this.getAttribute("good") ?? "up") === "up";
    const good = hasDelta ? (delta > 0) === upIsGood : true;
    const points = (this.getAttribute("spark") ?? "").split(",").map(Number).filter((n) => Number.isFinite(n));
    const W = 96, H = 26, PAD = 3;
    const min = points.length ? Math.min(...points) : 0, max = points.length ? Math.max(...points) : 0, span = max - min;
    const px = (i: number) => (points.length < 2 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1));
    const py = (v: number) => (span === 0 ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2));
    const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
    const area = points.length > 1 ? `${d} L${px(points.length - 1).toFixed(1)} ${H} L${px(0).toFixed(1)} ${H} Z` : "";
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { display: block; }
      .w { display: grid; gap: 7px; align-content: start; padding: 13px 14px 12px; border-radius: 16px; background: var(--paper); border: 1px solid var(--rule); transition: transform 180ms cubic-bezier(0.34,1.4,0.64,1), border-color 180ms, box-shadow 180ms; height: 100%; }
      /* On a gradient the tile is glass, and its own text turns white — the page's ink tokens are for paper. */
      :host([ghost]) .w { background: rgba(6,10,9,0.26); border-color: rgba(255,255,255,0.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      :host([ghost]) .v { color: #fff; } :host([ghost]) .l { color: rgba(255,255,255,0.72); } :host([ghost]) .n { color: rgba(255,255,255,0.6); }
      :host([ghost]) .dot-ring { fill: rgba(255,255,255,0.25); }
      :host([ghost]) .d { color: #fff; background: rgba(255,255,255,0.16); }
      :host([href]) .w { cursor: pointer; }
      :host([href]) .w:hover { transform: translateY(-2px); border-color: color-mix(in srgb, ${c} 45%, var(--rule)); box-shadow: 0 10px 24px -16px ${c}; }
      .l { font: 500 10px/1.2 var(--mono); text-transform: uppercase; letter-spacing: 0.09em; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .v { font: 600 25px/1 var(--sans); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; color: var(--ink); }
      .n { font: 400 11.5px/1.35 var(--sans); color: var(--ink-3); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .spark { width: 100%; height: 24px; }
      .d { display: inline-flex; align-items: center; gap: 3px; font: 500 11px/1 var(--mono); padding: 4px 8px; flex: none; border-radius: 999px; white-space: nowrap;
        color: ${good ? "var(--trust)" : "var(--alert)"}; background: color-mix(in srgb, ${good ? "var(--trust-b)" : "var(--alert-b)"} 13%, transparent); }
      svg { display: block; overflow: visible; }
      :host([ghost]) .line { stroke: rgba(255,255,255,0.75); } :host([ghost]) .fill { fill: #fff; } :host([ghost]) .dot { fill: #fff; }
      .line { fill: none; stroke: ${c}; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; opacity: 0.55; }
      .fill { fill: ${c}; opacity: 0.09; }
      .dot { fill: ${c}; }
      .dot-ring { fill: var(--paper); }
    `)];
    const spark = points.length > 1
      ? `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="fill" d="${area}"/><path class="line" d="${d}"/></svg>`
      : "";
    const note = this.getAttribute("note");
    const inner = `<div class="l">${this.getAttribute("label") ?? ""}</div>
      <div class="row"><span class="v">${this.getAttribute("value") ?? ""}</span>${hasDelta ? `<span class="d" title="${this.getAttribute("delta-label") ?? ""}">${delta > 0 ? "+" : "−"}${Math.abs(delta)}</span>` : ""}</div>
      ${spark}
      ${note ? `<div class="n">${note}</div>` : ""}`;
    const href = this.getAttribute("href");
    this.#root.innerHTML = href ? `<a class="w" href="${href}" style="text-decoration:none">${inner}</a>` : `<div class="w">${inner}</div>`;
  }
}

// ---------- <ni-bar>: a proportion, as touching segments with the surface doing the separating ----------
/**
 * Segments given as "label:value:tone|label:value:tone". Each segment is a share of the whole,
 * separated by a 2px gap in the surface colour rather than a stroke, and labelled underneath —
 * inside only where the text genuinely fits.
 */
class Bar extends HTMLElement {
  static observedAttributes = ["segments", "unit", "height", "hidevalues"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const segs = (this.getAttribute("segments") ?? "").split("|").filter(Boolean).map((s) => { const [label, value, tone] = s.split(":"); return { label, value: Number(value) || 0, tone: tone ?? "" }; });
    const total = segs.reduce((a, b) => a + b.value, 0) || 1;
    const col = (t: string) => (t === "trust" ? "var(--trust-b)" : t === "alert" ? "var(--alert-b)" : t === "stop" ? "var(--stop)" : t === "mute" ? "var(--ink-3)" : "var(--accent-b)");
    const h = Number(this.getAttribute("height") ?? 10);
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { display: block; }
      .track { display: flex; gap: 2px; height: ${h}px; }
      .seg { border-radius: 3px; min-width: 3px; transition: flex-grow 420ms cubic-bezier(0.22,1,0.36,1); }
      .seg:first-child { border-top-left-radius: ${h / 2}px; border-bottom-left-radius: ${h / 2}px; }
      .seg:last-child { border-top-right-radius: ${h / 2}px; border-bottom-right-radius: ${h / 2}px; }
      .keys { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 10px; }
      .key { display: inline-flex; align-items: center; gap: 6px; font: 400 11.5px/1.3 var(--sans); color: var(--ink-2); }
      .key i { width: 7px; height: 7px; border-radius: 2px; flex: none; }
      .key b { font: 500 11.5px/1.3 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; }
    `)];
    const unit = this.getAttribute("unit") ?? "";
    this.#root.innerHTML = `<div class="track">${segs.map((x) => `<div class="seg" style="flex: ${Math.max(x.value, 0.001)} 1 0; background: ${col(x.tone)}"></div>`).join("")}</div>
      <div class="keys">${segs.map((x) => `<span class="key"><i style="background: ${col(x.tone)}"></i>${x.label}${this.hasAttribute("hidevalues") ? "" : ` <b>${x.value}${unit}</b>`}</span>`).join("")}</div>`;
  }
}

export function defineComponents() {
  if (customElements.get("ni-chain")) return;
  customElements.define("ni-chain", Chain);
  customElements.define("ni-trust", Trust);
  customElements.define("ni-quote", Quote);
  customElements.define("ni-tag", Tag);
  customElements.define("ni-meter", Meter);
  customElements.define("ni-orb", Orb);
  customElements.define("ni-rule", Rule);
  customElements.define("ni-icon", Icon);
  customElements.define("ni-stat", Stat);
  customElements.define("ni-bar", Bar);
}
