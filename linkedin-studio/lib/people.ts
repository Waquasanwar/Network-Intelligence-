/**
 * People intelligence on your own network data: classification, lead scoring against your ideal
 * customer profile, and "who will care about this draft". Pure functions, no I/O, nothing leaves the app.
 */

export const SENIORITIES = ["Founder / Owner", "C-suite", "VP", "Director / Head", "Manager / Lead", "Senior IC", "IC", "Student / Early", "Unknown"] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const FUNCTIONS = [
  "Founder / GM", "Engineering", "Product", "Design", "Data / AI", "Sales", "Marketing", "Customer Success",
  "Finance", "People / Talent", "Operations", "Legal", "Consulting", "Investing", "Education", "Healthcare", "Other",
] as const;
export type Func = (typeof FUNCTIONS)[number];

export interface Person {
  id: string;
  name: string;
  url: string | null;
  email: string | null;
  company: string;
  position: string;
  connectedOn: string | null;
  seniority: Seniority;
  function: Func;
  engagedCount: number;
  lastEngaged: string | null;
  engagedOn: string;
  watch: boolean;
  leadStatus: string | null;
  notes: string;
}

const has = (t: string, words: string[]) => words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, "i").test(t));

export function classifySeniority(title: string): Seniority {
  const t = title.toLowerCase();
  if (!t.trim()) return "Unknown";
  if (has(t, ["founder", "co-founder", "cofounder", "owner", "proprietor"])) return "Founder / Owner";
  if (has(t, ["ceo", "cto", "cfo", "coo", "cmo", "cro", "cpo", "ciso", "cio", "chief", "president", "managing partner", "managing director"])) return "C-suite";
  if (has(t, ["vp", "svp", "evp", "vice president"])) return "VP";
  if (has(t, ["director", "head", "partner", "principal"])) return "Director / Head";
  if (has(t, ["manager", "lead", "leader", "supervisor", "team lead"])) return "Manager / Lead";
  if (has(t, ["senior", "sr", "staff", "expert", "architect", "specialist"])) return "Senior IC";
  if (has(t, ["student", "intern", "graduate", "trainee", "apprentice", "junior", "jr"])) return "Student / Early";
  return "IC";
}

const FN_WORDS: [Func, string[]][] = [
  ["Investing", ["investor", "investors", "venture", "ventures", "vc", "angel", "private equity", "investment", "investments", "fund", "funds", "capital"]],
  ["People / Talent", ["recruiter", "recruiting", "talent", "hr", "human resources", "people", "hiring", "headhunter", "resourcing"]],
  ["Data / AI", ["data", "ai", "machine learning", "ml", "analytics", "analyst", "scientist", "bi"]],
  ["Engineering", ["engineer", "engineering", "developer", "software", "devops", "sre", "cto", "technical", "it", "security", "cloud", "architect"]],
  ["Product", ["product", "pm", "cpo"]],
  ["Design", ["design", "designer", "ux", "ui", "creative"]],
  ["Sales", ["sales", "account executive", "ae", "sdr", "bdr", "business development", "partnerships", "revenue", "cro", "commercial"]],
  ["Marketing", ["marketing", "growth", "brand", "content", "seo", "communications", "pr", "cmo", "social media"]],
  ["Customer Success", ["customer success", "customer", "support", "client", "account manager"]],
  ["Finance", ["finance", "financial", "cfo", "accountant", "accounting", "controller", "treasury", "fp&a", "audit"]],
  ["Operations", ["operations", "ops", "coo", "supply chain", "logistics", "procurement", "programme", "program", "project"]],
  ["Legal", ["legal", "lawyer", "counsel", "solicitor", "attorney", "compliance", "paralegal"]],
  ["Consulting", ["consultant", "consulting", "advisor", "adviser", "advisory"]],
  ["Education", ["teacher", "professor", "lecturer", "education", "university", "school", "coach", "trainer"]],
  ["Healthcare", ["doctor", "nurse", "clinical", "physician", "health", "medical", "pharma"]],
  ["Founder / GM", ["founder", "ceo", "owner", "general manager", "managing director", "president", "entrepreneur"]],
];

export function classifyFunction(title: string): Func {
  const t = title.toLowerCase();
  if (!t.trim()) return "Other";
  for (const [f, words] of FN_WORDS) if (has(t, words)) return f;
  return "Other";
}

// ── ideal customer profile and lead scoring ──────────────────────────

export interface Icp {
  functions: string[];
  seniorities: string[];
  titleKeywords: string[];
  companyKeywords: string[];
  excludeKeywords: string[];
}
export const EMPTY_ICP: Icp = { functions: [], seniorities: [], titleKeywords: [], companyKeywords: [], excludeKeywords: [] };

export interface Lead {
  person: Person;
  fit: number;
  warmth: number;
  score: number;
  reasons: string[];
  action: string;
}

const DAY = 864e5;

export function scoreLead(p: Person, icp: Icp, now = Date.now()): Lead {
  const reasons: string[] = [];
  const text = `${p.position} ${p.company}`.toLowerCase();
  let fit = 0;
  if (icp.excludeKeywords.some((k) => k && text.includes(k.toLowerCase()))) {
    return { person: p, fit: 0, warmth: 0, score: 0, reasons: ["Excluded by your profile"], action: "Skip" };
  }
  const anyIcp = icp.functions.length + icp.seniorities.length + icp.titleKeywords.length + icp.companyKeywords.length > 0;
  if (icp.functions.includes(p.function)) { fit += 35; reasons.push(`${p.function} is a target function`); }
  if (icp.seniorities.includes(p.seniority)) { fit += 30; reasons.push(`${p.seniority} is a target level`); }
  const tk = icp.titleKeywords.find((k) => k && p.position.toLowerCase().includes(k.toLowerCase()));
  if (tk) { fit += 25; reasons.push(`Title mentions “${tk}”`); }
  const ck = icp.companyKeywords.find((k) => k && p.company.toLowerCase().includes(k.toLowerCase()));
  if (ck) { fit += 10; reasons.push(`Company matches “${ck}”`); }
  if (!anyIcp) fit = { "Founder / Owner": 60, "C-suite": 60, VP: 50, "Director / Head": 45, "Manager / Lead": 30, "Senior IC": 20, IC: 15, "Student / Early": 5, Unknown: 10 }[p.seniority];

  let warmth = Math.min(60, p.engagedCount * 20);
  if (p.engagedCount) reasons.push(`Engaged with ${p.engagedCount} of your post${p.engagedCount === 1 ? "" : "s"}`);
  if (p.lastEngaged && now - new Date(p.lastEngaged).getTime() < 30 * DAY) { warmth += 20; reasons.push("Engaged in the last 30 days"); }
  if (p.connectedOn && now - new Date(p.connectedOn).getTime() < 90 * DAY) { warmth += 10; reasons.push("Connected in the last 90 days"); }
  if (p.watch) { warmth += 10; reasons.push("On your watchlist"); }
  warmth = Math.min(100, warmth);
  fit = Math.min(100, fit);
  const score = Math.round(0.6 * fit + 0.4 * warmth);

  let action = "Keep in view";
  if (fit >= 50 && warmth >= 40) action = p.engagedOn ? `Message them. Open with “${p.engagedOn.split(" | ")[0].slice(0, 60)}”` : "Message them now";
  else if (fit >= 50) action = "Warm up: comment on their posts, then tag them in a relevant post";
  else if (warmth >= 40) action = "Thank them for engaging and ask who else should see your work";
  return { person: p, fit, warmth, score, reasons, action };
}

export function rankLeads(people: Person[], icp: Icp, limit = 50): Lead[] {
  return people
    .map((p) => scoreLead(p, icp))
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score || b.warmth - a.warmth)
    .slice(0, limit);
}

// ── who will care about this draft ───────────────────────────────────

const TOPIC_FUNCS: [string[], Func[]][] = [
  [["hiring", "hire", "recruit", "talent", "interview", "candidate", "cv", "resume", "team"], ["People / Talent", "Founder / GM"]],
  [["sales", "pipeline", "quota", "deal", "prospect", "closing", "revenue", "buyer"], ["Sales", "Founder / GM"]],
  [["marketing", "brand", "content", "audience", "linkedin", "growth", "seo", "campaign"], ["Marketing", "Founder / GM"]],
  [["ai", "llm", "model", "data", "analytics", "automation", "machine"], ["Data / AI", "Engineering", "Product"]],
  [["code", "engineering", "developer", "software", "architecture", "deploy", "bug"], ["Engineering", "Product"]],
  [["product", "roadmap", "feature", "users", "launch", "customer"], ["Product", "Customer Success", "Design"]],
  [["fundraising", "raise", "investor", "vc", "valuation", "seed", "series"], ["Investing", "Founder / GM", "Finance"]],
  [["finance", "cash", "budget", "margin", "pricing", "profit", "cfo"], ["Finance", "Founder / GM"]],
  [["leadership", "manager", "management", "culture", "feedback", "promotion", "career"], ["People / Talent", "Founder / GM", "Operations"]],
  [["design", "ux", "ui", "brand"], ["Design", "Product"]],
  [["legal", "contract", "compliance", "regulation", "gdpr"], ["Legal", "Finance"]],
  [["operations", "process", "supply", "logistics", "efficiency"], ["Operations"]],
];

const STOP = new Set("about after again also because been before being between both could does doing during each even every from have having here into just like more most much must never only other over same should some such than that their them then there these they this those through very what when where which while with would your yours will that's it's dont don't i'm you're we're".split(" "));

export function draftKeywords(text: string, max = 12): string[] {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-z][a-z'&-]{3,}/g) ?? []) if (!STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
}

export function draftAudience(text: string, people: Person[], limit = 12) {
  const t = text.toLowerCase();
  const funcs = new Map<Func, number>();
  for (const [words, fs] of TOPIC_FUNCS) {
    const hits = words.filter((w) => has(t, [w])).length;
    if (hits) for (const f of fs) funcs.set(f, (funcs.get(f) ?? 0) + hits);
  }
  const keywords = draftKeywords(text);
  const leadershipy = has(t, ["leadership", "leader", "manager", "managers", "executive", "founder", "ceo"]);
  const scored = people
    .map((p) => {
      const why: string[] = [];
      let s = 0;
      const fw = funcs.get(p.function);
      if (fw) { s += 3 + fw; why.push(p.function); }
      const kw = keywords.filter((k) => `${p.position} ${p.company}`.toLowerCase().includes(k));
      if (kw.length) { s += 2 * kw.length; why.push(`mentions ${kw.slice(0, 2).join(", ")}`); }
      if (leadershipy && ["Founder / Owner", "C-suite", "VP", "Director / Head"].includes(p.seniority)) { s += 2; why.push(p.seniority); }
      if (p.engagedCount) { s += 1; why.push("has engaged before"); }
      return { person: p, score: s, why };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const segments = [...funcs.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => ({ function: f, people: people.filter((p) => p.function === f).length }));
  return { segments, keywords, matches: scored.length, top: scored.slice(0, limit) };
}

// ── network stats ────────────────────────────────────────────────────

export function countBy<T>(xs: T[], key: (x: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const x of xs) {
    const k = key(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => ({ key: k, count: n })).sort((a, b) => b.count - a.count);
}

export function networkStats(people: Person[], now = Date.now()) {
  const months: { x: string; y: number }[] = [];
  const d = new Date(now);
  for (let i = 23; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
    months.push({ x: `${m}-01`, y: 0 });
  }
  const idx = new Map(months.map((m, i) => [m.x.slice(0, 7), i]));
  for (const p of people) {
    const i = p.connectedOn ? idx.get(p.connectedOn.slice(0, 7)) : undefined;
    if (i != null) months[i].y++;
  }
  const last90 = people.filter((p) => p.connectedOn && now - new Date(p.connectedOn).getTime() < 90 * DAY).length;
  return {
    total: people.length,
    withEmail: people.filter((p) => p.email).length,
    engaged: people.filter((p) => p.engagedCount > 0).length,
    last90,
    seniority: countBy(people, (p) => p.seniority),
    functions: countBy(people, (p) => p.function),
    companies: countBy(people, (p) => p.company || null).slice(0, 12),
    perMonth: months,
  };
}

/** Find connections whose full name appears in text pasted from a post's comments or reactions. */
export function matchEngagers(pasted: string, people: Person[]): Person[] {
  const t = ` ${pasted.toLowerCase().replace(/\s+/g, " ")} `;
  return people.filter((p) => p.name.split(" ").length >= 2 && t.includes(` ${p.name.toLowerCase()} `) || (p.url && t.includes(p.url.replace("https://www.", ""))));
}
