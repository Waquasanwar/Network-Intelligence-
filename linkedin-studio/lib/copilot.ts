/**
 * The copilot behind ⌘K. Two brains:
 *  - local: instant answers to common questions from your own data, no API key needed
 *  - Claude (when ANTHROPIC_API_KEY is set): tool use over the same data for anything else
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { signals, type Signal } from "./agent";
import { draftAudience, rankLeads, type Icp, type Person } from "./people";
import { groupBy, weekdayOf } from "./scoring";
import type { DailyMetric, Post } from "./types";

export interface CopilotItem { label: string; sub?: string; href: string }
export interface CopilotAnswer {
  text: string;
  items?: CopilotItem[];
  actions?: { label: string; href: string }[];
  source: "local" | "ai";
}
export interface CopilotData { posts: Post[]; daily: DailyMetric[]; people: Person[]; icp: Icp }

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const days = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function quoted(q: string): string | null {
  return q.match(/[“"]([^”"]{12,})[”"]/)?.[1] ?? q.match(/:\s*(.{40,})$/s)?.[1] ?? null;
}

/** Fast answers for the questions people ask most. Returns null when it doesn't know. */
export function localAnswer(question: string, d: CopilotData): CopilotAnswer | null {
  const q = question.toLowerCase();
  const published = d.posts.filter((p) => p.status === "Published");
  const ranked = published.filter((p) => p.rank != null).sort((a, b) => a.rank! - b.rank!);

  if (has(q, "who should see", "who would care", "who will care", "who cares", "who is this for", "audience for")) {
    const text = quoted(question);
    if (!text) return { source: "local", text: "Paste the draft after a colon, e.g. “who should see: <your draft>”, or open the editor, where ‘Who will care’ updates as you type.", actions: [{ label: "Open the editor", href: "/write" }] };
    if (!d.people.length) return { source: "local", text: "Import your network first.", actions: [{ label: "Import", href: "/network" }] };
    const r = draftAudience(text, d.people, 8);
    return {
      source: "local",
      text: `${r.matches} people in your network match this. Strongest groups: ${r.segments.slice(0, 3).map((s) => s.function).join(", ") || "none clear"}.`,
      items: r.top.map((t) => ({ label: t.person.name, sub: `${t.person.position} · ${t.why.join(" · ")}`, href: t.person.url ?? "/network" })),
    };
  }
  if (has(q, "lead", "who should i message", "who to message", "who to contact", "prospect")) {
    const leads = rankLeads(d.people, d.icp, 8);
    if (!leads.length) return { source: "local", text: "No leads yet. Import your network and set your target profile.", actions: [{ label: "Go to network", href: "/network" }] };
    return { source: "local", text: `Your top ${leads.length} leads right now:`, items: leads.map((l) => ({ label: `${l.person.name} · ${l.score}`, sub: l.action, href: l.person.url ?? "/network" })), actions: [{ label: "All leads", href: "/network" }, { label: "Export CSV", href: "/api/network/export?type=leads" }] };
  }
  if (has(q, "best day", "when should i post", "when to post", "what day")) {
    const g = groupBy(published, (p) => weekdayOf(p.publishedAt));
    if (g.length < 2) return { source: "local", text: "Not enough posts with numbers yet to pick a day." };
    return { source: "local", text: `${g[0].key} (average score ${g[0].avgScore}). Worst: ${g[g.length - 1].key} (${g[g.length - 1].avgScore}).`, items: g.map((x) => ({ label: x.key, sub: `${x.count} posts · avg ${x.avgScore}`, href: "/" })) };
  }
  if (has(q, "best post", "top post", "what worked", "winners")) {
    if (!ranked.length) return { source: "local", text: "No ranked posts yet. Import your analytics.", actions: [{ label: "Import", href: "/metrics" }] };
    return { source: "local", text: "Your top posts by score:", items: ranked.slice(0, 5).map((p) => ({ label: `#${p.rank} ${p.title}`, sub: `score ${p.performanceScore} · ${(p.metrics.impressions ?? 0).toLocaleString("en-GB")} impressions`, href: `/posts/${p.id}` })) };
  }
  if (has(q, "how am i doing", "this week", "how's it going", "hows it going", "summary", "overview", "reach")) {
    const a = sum(d.daily.filter((x) => x.day > days(7)).map((x) => x.impressions));
    const b = sum(d.daily.filter((x) => x.day > days(14) && x.day <= days(7)).map((x) => x.impressions));
    const s = signals({ ...d });
    return {
      source: "local",
      text: a ? `${a.toLocaleString("en-GB")} impressions in the last 7 days${b ? ` (${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}% on the week before)` : ""}.${s[0] ? ` Top priority: ${s[0].title.toLowerCase()}.` : ""}` : "No recent daily numbers. Import an analytics export to see your reach.",
      items: s.slice(0, 4).map((x) => ({ label: x.title, sub: x.detail, href: x.action?.href ?? "/" })),
    };
  }
  if (has(q, "what should i do", "what next", "priorit", "focus", "today")) {
    const s = signals({ ...d });
    return { source: "local", text: s.length ? "Here’s what matters most right now:" : "Nothing urgent. Write something.", items: s.slice(0, 5).map((x) => ({ label: x.title, sub: x.detail, href: x.action?.href ?? "/" })) };
  }
  return null;
}

// ── Claude with tools ────────────────────────────────────────────────

const SYSTEM = `You are the copilot inside LinkedIn Studio, a personal app for writing, ranking and tracking one person's LinkedIn posts and working their network.
Answer from their data using the tools. Be brief and specific: name posts, people and numbers. Plain sentences, no headings.
When you write or rewrite a post, put the post text inside <draft>...</draft> so the app can open it in the editor.
Never invent numbers or people; if the data doesn't have it, say so and say how to get it (import an export, log engagers, set a target profile).`;

export async function aiAnswer(question: string, history: { role: "user" | "assistant"; content: string }[], d: CopilotData): Promise<CopilotAnswer> {
  const brief = (p: Post) => ({ id: p.id, title: p.title, status: p.status, publishedAt: p.publishedAt, score: p.performanceScore, rank: p.rank, impressions: p.metrics.impressions, engagementRate: p.engagementRate, comments: p.metrics.comments, pillar: p.pillar, hookType: p.hookType, format: p.format });
  const tools = [
    betaZodTool({
      name: "get_overview",
      description: "Counts, reach this week vs last, and the prioritised signals (what needs attention now).",
      inputSchema: z.object({}),
      run: async () => {
        const a = sum(d.daily.filter((x) => x.day > days(7)).map((x) => x.impressions));
        const b = sum(d.daily.filter((x) => x.day > days(14) && x.day <= days(7)).map((x) => x.impressions));
        return JSON.stringify({ posts: d.posts.length, published: d.posts.filter((p) => p.status === "Published").length, network: d.people.length, impressions7d: a, impressionsPrev7d: b, signals: signals({ ...d }).map((s: Signal) => ({ title: s.title, detail: s.detail })) });
      },
    }),
    betaZodTool({
      name: "list_posts",
      description: "Posts with their scores and metrics. Sort by rank (best first), recent, or impressions.",
      inputSchema: z.object({ sort: z.enum(["rank", "recent", "impressions"]).optional(), status: z.string().optional(), limit: z.number().int().max(50).optional() }),
      run: async ({ sort = "rank", status, limit = 15 }) => {
        let ps = d.posts.filter((p) => (status ? p.status === status : p.status !== "Archived"));
        ps = [...ps].sort((a, b) => (sort === "rank" ? (a.rank ?? 1e9) - (b.rank ?? 1e9) : sort === "impressions" ? (b.metrics.impressions ?? 0) - (a.metrics.impressions ?? 0) : (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)));
        return JSON.stringify(ps.slice(0, limit).map(brief));
      },
    }),
    betaZodTool({
      name: "get_post_text",
      description: "Full text and ratings of one post, found by id or by words in its title.",
      inputSchema: z.object({ query: z.string() }),
      run: async ({ query }) => {
        const p = d.posts.find((x) => x.id === query) ?? d.posts.find((x) => x.title.toLowerCase().includes(query.toLowerCase()));
        return p ? JSON.stringify({ ...brief(p), text: p.text, ratings: p.ratings, aiNotes: p.aiNotes }) : "No matching post.";
      },
    }),
    betaZodTool({
      name: "search_network",
      description: "Find people in their LinkedIn network by words in name, title or company, and/or by function or seniority.",
      inputSchema: z.object({ query: z.string().optional(), function: z.string().optional(), seniority: z.string().optional(), limit: z.number().int().max(40).optional() }),
      run: async ({ query, function: fn, seniority, limit = 15 }) => {
        const ql = query?.toLowerCase();
        const r = d.people.filter((p) => (!ql || `${p.name} ${p.position} ${p.company}`.toLowerCase().includes(ql)) && (!fn || p.function === fn) && (!seniority || p.seniority === seniority));
        return JSON.stringify({ total: r.length, people: r.slice(0, limit).map((p) => ({ name: p.name, position: p.position, company: p.company, seniority: p.seniority, function: p.function, engaged: p.engagedCount, url: p.url })) });
      },
    }),
    betaZodTool({
      name: "top_leads",
      description: "Their best leads scored against their target profile, with reasons and a suggested next step.",
      inputSchema: z.object({ limit: z.number().int().max(30).optional() }),
      run: async ({ limit = 10 }) => JSON.stringify({ profile: d.icp, leads: rankLeads(d.people, d.icp, limit).map((l) => ({ name: l.person.name, position: l.person.position, company: l.person.company, score: l.score, action: l.action, reasons: l.reasons })) }),
    }),
    betaZodTool({
      name: "draft_audience",
      description: "Who in their network a piece of draft text speaks to.",
      inputSchema: z.object({ text: z.string() }),
      run: async ({ text }) => {
        const r = draftAudience(text, d.people, 10);
        return JSON.stringify({ matches: r.matches, segments: r.segments, top: r.top.map((t) => ({ name: t.person.name, position: t.person.position, why: t.why })) });
      },
    }),
  ];

  const runner = new Anthropic().beta.messages.toolRunner({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    max_iterations: 8,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM,
    tools,
    messages: [...history.slice(-8).map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: question }],
  });
  const msg = await runner.runUntilDone();
  if (msg.stop_reason === "refusal") return { source: "ai", text: "I can’t help with that one." };
  const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  const draft = text.match(/<draft>([\s\S]*?)<\/draft>/)?.[1]?.trim();
  return {
    source: "ai",
    text: text.replace(/<draft>[\s\S]*?<\/draft>/, draft ? "\n\n(Draft ready below.)" : "").trim(),
    actions: draft ? [{ label: "Open draft in editor", href: `/write?text=${encodeURIComponent(draft)}` }] : undefined,
  };
}
