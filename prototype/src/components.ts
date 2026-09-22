/**
 * Web components for Network Intelligence.
 *
 * The design thesis: a person's words carry the judgement, the system carries the structure.
 * So anything a human said is set in the serif voice, and anything the system computed is set
 * in the mono voice. These custom elements are the vocabulary for that.
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
    --mono: "Geist Mono", ui-monospace, monospace; --sans: "Instrument Sans", ui-sans-serif, system-ui, sans-serif; --serif: "Instrument Serif", Georgia, serif;
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
      .t { fill: none; stroke: var(--rule); stroke-width: 3; }
      .v { fill: none; stroke: ${tone}; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 700ms cubic-bezier(0.2,0.8,0.2,1); }
      .f { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; line-height: 1; }
      b { font: 500 ${Math.round(size * 0.32)}px/1 var(--mono); letter-spacing: -0.03em; color: var(--ink); }
      small { display: block; margin-top: 3px; font: 500 ${Math.max(8.5, size * 0.11)}px/1 var(--mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-3); }
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
    const px = size === "xl" ? 46 : size === "lg" ? 26 : size === "sm" ? 16 : 19;
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { display: block; }
      blockquote { margin: 0; font: italic 400 ${px}px/${size === "xl" ? 1.1 : 1.4} var(--serif); letter-spacing: ${size === "xl" ? "-0.02em" : "-0.005em"}; color: var(--ink); text-wrap: pretty; }
      .a { margin-top: ${size === "xl" ? 20 : 10}px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px;
        font: 500 ${size === "xl" ? 12 : 11}px/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.09em; color: var(--ink-3); }
      .a b { color: var(--ink-2); font-weight: 600; }
      .a .ctx { text-transform: none; letter-spacing: 0; font-family: var(--sans); font-size: ${size === "xl" ? 13 : 12}px; color: var(--ink-3); }
    `)];
    const by = this.getAttribute("by"); const ctx = this.getAttribute("context"); const when = this.getAttribute("when");
    this.#root.innerHTML = `<blockquote><slot></slot></blockquote>${by || ctx ? `<div class="a">${by ? `<b>${by}</b>` : ""}${ctx ? `<span class="ctx">${ctx}</span>` : ""}${when ? `<span>${when}</span>` : ""}</div>` : ""}`;
  }
}

// ---------- <ni-figure>: a number in the ledger ----------
class Figure extends HTMLElement {
  static observedAttributes = ["label", "value", "note", "tone"];
  #root = this.attachShadow({ mode: "open" });
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const tone = this.getAttribute("tone");
    this.#root.adoptedStyleSheets = [sheet(`${BASE}
      :host { display: block; }
      .l { font: 500 10.5px/1 var(--mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-3); }
      .v { margin-top: 9px; font: 400 30px/1 var(--mono); letter-spacing: -0.035em; color: ${tone === "trust" ? "var(--trust)" : tone === "alert" ? "var(--alert)" : "var(--ink)"}; font-variant-numeric: tabular-nums; }
      .n { margin-top: 6px; font: 400 12px/1.4 var(--sans); color: var(--ink-3); }
    `)];
    this.#root.innerHTML = `<div class="l">${this.getAttribute("label") ?? ""}</div><div class="v">${this.getAttribute("value") ?? ""}</div>${this.getAttribute("note") ? `<div class="n">${this.getAttribute("note")}</div>` : ""}`;
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

export function defineComponents() {
  if (customElements.get("ni-chain")) return;
  customElements.define("ni-chain", Chain);
  customElements.define("ni-trust", Trust);
  customElements.define("ni-quote", Quote);
  customElements.define("ni-figure", Figure);
  customElements.define("ni-tag", Tag);
  customElements.define("ni-meter", Meter);
  customElements.define("ni-orb", Orb);
  customElements.define("ni-rule", Rule);
  customElements.define("ni-icon", Icon);
}
