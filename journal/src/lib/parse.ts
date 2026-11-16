// Quick-capture parser. Turns one line of shorthand into a structured entry, then layers on
// rule-based enrichment (type, category, source, sentiment, tags) for anything not stated.
//
//   d: go with vendor B #tooling +Migration @Sarah !2 due:fri
//
// Explicit markers always win over inferred values. Inferred values are reported separately so
// the UI can show them as suggestions the user can override.

import { STAGES, WAITING_ON, type Category, type EntryType, type Priority, type Sentiment, type Source, type Direction, type Stage, type WaitingOn } from "./schema";

export interface Parsed {
  title: string;
  body?: string;
  type?: EntryType;
  tags: string[];
  people: string[];
  projects: string[];
  priority?: Priority;
  due?: string;
  followUp?: string;
  direction?: Direction;
  sentiment?: Sentiment;
  category?: Category;
  source?: Source;
  waitingOn?: WaitingOn;
  stage?: Stage;
  reference?: string;
  amount?: number;
  /** Which fields were inferred from wording rather than typed explicitly. */
  inferred: Array<"type" | "category" | "source" | "sentiment" | "tags" | "direction" | "waitingOn">;
}

const TYPE_PREFIXES: Record<string, EntryType> = {
  n: "Note", note: "Note",
  d: "Decision", dec: "Decision", decision: "Decision", decided: "Decision",
  r: "Request", req: "Request", request: "Request", ask: "Request",
  pr: "Purchase Request", purchase: "Purchase Request", buy: "Purchase Request", po: "Purchase Request",
  sr: "Service Request", service: "Service Request", ticket: "Service Request",
  c: "Comment / Feedback", fb: "Comment / Feedback", comment: "Comment / Feedback", feedback: "Comment / Feedback",
  i: "Idea", idea: "Idea",
  m: "Meeting", mtg: "Meeting", meeting: "Meeting",
  b: "Blocker / Risk", blocker: "Blocker / Risk", risk: "Blocker / Risk", blocked: "Blocker / Risk",
  w: "Win", win: "Win",
  q: "Question", question: "Question",
  l: "Learning", til: "Learning", learning: "Learning", learned: "Learning",
};

const PRIORITY_TOKENS: Record<string, Priority> = {
  "1": "P1 Urgent", urgent: "P1 Urgent", p1: "P1 Urgent",
  "2": "P2 High", high: "P2 High", p2: "P2 High",
  "3": "P3 Normal", normal: "P3 Normal", p3: "P3 Normal",
  "4": "P4 Low", low: "P4 Low", p4: "P4 Low",
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Resolve a date word relative to `today` (YYYY-MM-DD). Returns undefined if not a date. */
export function resolveDate(word: string, today: string): string | undefined {
  const w = word.toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
  if (w === "today" || w === "tod") return today;
  if (w === "tomorrow" || w === "tom" || w === "tmr") return addDays(today, 1);
  if (w === "nextweek" || w === "nw") return addDays(today, 7);
  const rel = w.match(/^(\d+)([dw])$/);
  if (rel) return addDays(today, Number(rel[1]) * (rel[2] === "w" ? 7 : 1));
  const dm = w.match(/^(\d{1,2})\/(\d{1,2})$/); // day/month, UK style
  if (dm) {
    const year = Number(today.slice(0, 4));
    const candidate = `${year}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    return candidate < today ? `${year + 1}${candidate.slice(4)}` : candidate;
  }
  const idx = WEEKDAYS.findIndex((d) => w.startsWith(d));
  if (idx >= 0 && w.length <= 9) {
    const todayIdx = new Date(`${today}T12:00:00Z`).getUTCDay();
    let diff = (idx - todayIdx + 7) % 7;
    if (diff === 0) diff = 7; // "fri" on a Friday means next Friday
    return addDays(today, diff);
  }
  return undefined;
}

// --- Rule-based enrichment ------------------------------------------------------------------

const TYPE_RULES: Array<[RegExp, EntryType]> = [
  [/\b(purchase request|purchase order|raise (a )?po|need to (buy|order|purchase)|quote for|licen[cs]es?|subscription renewal)\b/i, "Purchase Request"],
  [/\b(service request|service desk|helpdesk|it ticket|access request|raised a ticket|new starter accounts?)\b/i, "Service Request"],
  [/^(we )?(decided|agreed|going with|go with|chose|approved|signed off)\b|\bdecision\b/i, "Decision"],
  [/^(can you|could you|please|pls)\b|^(i |we )?(asked|chased)\b|\b(asked (me|us|for|if|to)|requested|wants? (me|us) to|needs? (me|us) to|chase|asked to)\b/i, "Request"],
  [/\b(blocked|blocker|risk|at risk|stuck|waiting on|dependency|delayed|slipping)\b/i, "Blocker / Risk"],
  [/\b(won|shipped|launched|closed the|signed|delivered|hit (the )?target|great result|praised|kudos)\b/i, "Win"],
  [/\b(said|feedback|commented|thinks|felt|complained|mentioned)\b/i, "Comment / Feedback"],
  [/^(idea|what if|maybe we|we could|could we)\b/i, "Idea"],
  [/\b(learned|learnt|til|turns out|lesson)\b/i, "Learning"],
  [/^(1:1|1-1|standup|sync|call with|meeting with|catch[- ]?up)\b/i, "Meeting"],
  [/\?\s*$/, "Question"],
];

const CATEGORY_RULES: Array<[RegExp, Category]> = [
  [/\b(budget|cost|invoice|spend|pricing|price|forecast|p&l|revenue|margin|cash|payment|finance)\b/i, "Finance"],
  [/\b(hire|hiring|interview|candidate|headcount|1:1|1-1|performance|team|onboard(ing)? (a|the|new) (hire|starter)|morale|promotion)\b/i, "People & Team"],
  [/\b(client|customer|prospect|deal|pipeline|proposal|pitch|renewal|account)\b/i, "Sales & Clients"],
  [/\b(strategy|roadmap|vision|okr|okrs|priorit(y|ies)|direction|plan for)\b/i, "Strategy"],
  [/\b(feature|product|release|spec|ux|design|user research)\b/i, "Product"],
  [/\b(deliver(y|able)?|deadline|milestone|sprint|launch|go[- ]live|timeline|project plan)\b/i, "Delivery"],
  [/\b(process|tooling|vendor|system|workflow|ops|operations|migration|policy)\b/i, "Operations"],
  [/\b(learn(ed|t|ing)?|course|book|mentor|coaching|career|skill)\b/i, "Personal growth"],
  [/\b(expense|admin|booking|travel|timesheet|paperwork|form)\b/i, "Admin"],
];

const SOURCE_RULES: Array<[RegExp, Source]> = [
  [/\b(email|e-mail|inbox|mailed)\b/i, "Email"],
  [/\b(slack|teams|dm|chat|whatsapp)\b/i, "Chat (Slack/Teams)"],
  [/\b(call|phoned|rang|zoom)\b/i, "Call"],
  [/\b(meeting|standup|sync|1:1|1-1|workshop|offsite)\b/i, "Meeting"],
  [/\b(doc|deck|spreadsheet|report|paper)\b/i, "Document"],
];

const POSITIVE = /\b(great|good|happy|pleased|love|loved|win|won|excellent|thanks|thank you|kudos|smooth|praised|excited|nailed)\b|:\)|🙂|😀|🎉/i;
const NEGATIVE = /\b(bad|frustrat\w*|annoy\w*|angry|upset|worried|concern\w*|slow|late|missed|problem|issue|complain\w*|disappoint\w*|blocked|stuck|risk)\b|:\(|🙁|😞/i;

const TAG_RULES: Array<[RegExp, string]> = [
  [/\b(budget|cost|spend)\b/i, "budget"],
  [/\b(hire|hiring|interview|candidate|headcount)\b/i, "hiring"],
  [/\b(client|customer)\b/i, "client"],
  [/\b(risk|at risk|blocker)\b/i, "risk"],
  [/\b(process|workflow)\b/i, "process"],
  [/\b(tool|tooling|vendor|software|system)\b/i, "tooling"],
  [/\b(follow up|follow-up|chase|get back to)\b/i, "follow-up"],
];

export function enrich(text: string): Pick<Parsed, "type" | "category" | "source" | "sentiment" | "tags"> {
  const type = TYPE_RULES.find(([re]) => re.test(text))?.[1];
  const category = CATEGORY_RULES.find(([re]) => re.test(text))?.[1];
  const source = SOURCE_RULES.find(([re]) => re.test(text))?.[1];
  const pos = POSITIVE.test(text);
  const neg = NEGATIVE.test(text);
  const sentiment: Sentiment | undefined = pos && !neg ? "Positive" : neg && !pos ? "Negative" : undefined;
  const tags = TAG_RULES.filter(([re]) => re.test(text)).map(([, t]) => t);
  return { type, category, source, sentiment, tags };
}

const WAITING_RULES: Array<[RegExp, WaitingOn]> = [
  [/\b(procurement|purchasing|buyer|purchase order|\bpo\b)\b/i, "Procurement"],
  [/\b(finance|accounts payable|budget holder)\b/i, "Finance"],
  [/\b(legal|contract review|counsel)\b/i, "Legal"],
  [/\b(it team|service desk|helpdesk)\b/i, "IT"],
  [/\b(my (manager|boss|director|line manager)|leadership|exec(utive)?s?|director|cfo|ceo|coo|vp)\b/i, "Management"],
  [/\b(vendor|supplier)\b/i, "Vendor"],
];

// --- Parser ---------------------------------------------------------------------------------

function nameFrom(raw: string): string {
  return raw.replace(/^["']|["']$/g, "").replace(/_/g, " ").trim();
}

export function parseCapture(input: string, today: string): Parsed {
  const [firstLine, ...rest] = input.replace(/\r/g, "").split("\n");
  const body = rest.join("\n").trim() || undefined;
  let text = firstLine.trim();

  const out: Parsed = { title: "", tags: [], people: [], projects: [], inferred: [] };

  // Type prefix: "d: ...", "decision - ...", or a "/decision" token anywhere.
  const prefix = text.match(/^([a-z0-9]+)\s*[:>]\s*/i);
  if (prefix && TYPE_PREFIXES[prefix[1].toLowerCase()]) {
    out.type = TYPE_PREFIXES[prefix[1].toLowerCase()];
    text = text.slice(prefix[0].length);
  }
  text = text.replace(/(^|\s)\/([a-z]+)\b/gi, (m, sp, word) => {
    const t = TYPE_PREFIXES[word.toLowerCase()];
    if (t && !out.type) {
      out.type = t;
      return sp;
    }
    return m;
  });

  // Dates: due:fri, by:tomorrow, fu:3d / follow:mon
  text = text.replace(/(^|\s)(due|by|fu|follow|followup|follow-up):(\S+)/gi, (m, sp, key, val) => {
    const date = resolveDate(val, today);
    if (!date) return m;
    if (/^(due|by)$/i.test(key)) out.due = date;
    else out.followUp = date;
    return sp;
  });

  // Priority: !1 .. !4, !urgent, !high, !low
  text = text.replace(/(^|\s)!(\w+)\b/g, (m, sp, val) => {
    const p = PRIORITY_TOKENS[val.toLowerCase()];
    if (!p) return m;
    out.priority = p;
    return sp;
  });

  // Direction: << incoming (to me), >> outgoing (from me), ^^ upward (to management)
  text = text.replace(/(^|\s)(<<|>>|\^\^)(?=\s|$)/g, (_m, sp, arrow) => {
    out.direction = arrow === "<<" ? "Incoming (to me)" : arrow === ">>" ? "Outgoing (from me)" : "Upward (to management)";
    if (arrow === "^^") out.waitingOn = "Management";
    return sp;
  });

  // wait:procurement, stage:approved
  text = text.replace(/(^|\s)(wait|waiting|stage):([\w-]+)/gi, (m, sp, key, val) => {
    const v = val.toLowerCase().replace(/-/g, " ");
    if (/^wait/i.test(key)) {
      const hit = WAITING_ON.find((w) => w.toLowerCase().startsWith(v)) ?? (v === "mgmt" ? "Management" : undefined);
      if (!hit) return m;
      out.waitingOn = hit;
    } else {
      const hit = STAGES.find((st) => st.toLowerCase().startsWith(v));
      if (!hit) return m;
      out.stage = hit;
    }
    return sp;
  });

  // Amounts (£14,400 / $3.2k / €900) and references (PR-1234, PO 5678, SR-99, REQ123) stay in the title.
  const money = text.match(/[£$€]\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m)?\b/i);
  if (money) {
    const n = parseFloat(money[1].replace(/,/g, "")) * (money[2]?.toLowerCase() === "k" ? 1e3 : money[2]?.toLowerCase() === "m" ? 1e6 : 1);
    if (!Number.isNaN(n)) out.amount = n;
  }
  const ref = text.match(/\b(PR|PO|SR|REQ|RITM|INC|TKT)[-\s#]?(\d{3,})\b/i);
  if (ref) out.reference = `${ref[1].toUpperCase()}-${ref[2]}`;

  // Tags are removed from the title.
  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_m, sp, tag) => {
    const t = tag.toLowerCase();
    if (!out.tags.includes(t)) out.tags.push(t);
    return sp;
  });

  // People and projects mid-sentence stay readable in the title ("@Sarah_Khan" -> "Sarah Khan");
  // a trailing run of them, like "...forecast @Lena +Finance", is metadata and is dropped.
  const MENTION = String.raw`([@+])("[^"]+"|[\p{L}\p{N}][\p{L}\p{N}_.'-]*)`;
  const record = (sigil: string, raw: string) => {
    const name = nameFrom(raw).replace(/[.,;:]$/, "");
    const list = sigil === "@" ? out.people : out.projects;
    if (!list.some((n) => n.toLowerCase() === name.toLowerCase())) list.push(name);
    return name;
  };
  const trailing = text.match(new RegExp(String.raw`(?:\s+${MENTION})+\s*$`, "u"));
  const before = trailing ? text.slice(0, trailing.index).trim().split(/\s+/).pop()?.toLowerCase() : "";
  const LINKING = /^(to|with|for|from|by|and|at|on|of|cc|about|into|via|re|w\/|asked|told|thanked|met|called|emailed|pinged)$/;
  if (trailing && trailing.index! > 0) {
    const mentions = [...trailing[0].matchAll(new RegExp(MENTION, "gu"))];
    // After a linking word ("...to @Sarah +Q1"), the first mention completes the sentence.
    const keep = LINKING.test(before ?? "") ? mentions.shift() : undefined;
    for (const m of mentions) record(m[1], m[2]);
    text = text.slice(0, trailing.index) + (keep ? ` ${keep[0]}` : "");
  }
  text = text.replace(new RegExp(String.raw`(^|\s)${MENTION}`, "gu"), (_m, sp, sigil, raw) => `${sp}${record(sigil, raw)}`);

  out.title = text.replace(/\s{2,}/g, " ").trim();
  if (body) out.body = body;

  // Enrichment for anything left unstated.
  const e = enrich(`${out.title}\n${body ?? ""}`);
  if (!out.type && e.type) {
    out.type = e.type;
    out.inferred.push("type");
  }
  if (e.category) {
    out.category = e.category;
    out.inferred.push("category");
  }
  if (e.source) {
    out.source = e.source;
    out.inferred.push("source");
  }
  if (e.sentiment) {
    out.sentiment = e.sentiment;
    out.inferred.push("sentiment");
  }
  const extraTags = e.tags.filter((t) => !out.tags.includes(t));
  if (extraTags.length) {
    out.tags.push(...extraTags);
    out.inferred.push("tags");
  }
  if (!out.waitingOn) {
    const w = WAITING_RULES.find(([re]) => re.test(out.title))?.[1] ?? (out.type === "Purchase Request" ? "Procurement" : out.type === "Service Request" ? "IT" : undefined);
    if (w) {
      out.waitingOn = w;
      out.inferred.push("waitingOn");
    }
  }
  if ((out.type === "Purchase Request" || out.type === "Service Request") && !out.stage) out.stage = "Submitted";
  if (out.type === "Request" && !out.direction && out.waitingOn === "Management" && /^(i |we )?(asked|escalated|requested|raised)\b/i.test(out.title)) {
    out.direction = "Upward (to management)";
    out.inferred.push("direction");
  }
  if (out.type === "Request" && !out.direction) {
    out.direction = /^(i |we )?(asked|chased|requested|sent)\b/i.test(out.title) ? "Outgoing (from me)" : "Incoming (to me)";
    out.inferred.push("direction");
  }
  return out;
}

/** Today's date (YYYY-MM-DD) in an IANA timezone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
