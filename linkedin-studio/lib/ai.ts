/** The writing assistant. Learns your voice from your own best and worst posts. */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Post, SwipeItem } from "./types";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const SYSTEM = `You are a sharp LinkedIn editor working for one person. Your job is to make their posts better in their own voice, not to make them sound like generic LinkedIn content.

House rules:
- Keep their voice. Study the examples of their best posts and match their rhythm, vocabulary and level of formality.
- No clichés: no "I'm thrilled to announce", "Here's the thing", "Let that sink in", "Agree?", rocket emojis or engagement bait.
- Specific beats general. Push for concrete numbers, names, moments and opinions.
- Respect the reader's time. Short lines, one idea per paragraph, a first line that earns the "see more" tap.
- Be honest. If a draft is weak, say so plainly and say why.`;

function postSummary(p: Post): string {
  const m = p.metrics;
  const bits = [
    p.performanceScore != null ? `score ${p.performanceScore}/100` : null,
    m.impressions != null ? `${m.impressions} impressions` : null,
    p.engagementRate != null ? `${p.engagementRate}% engagement` : null,
    m.comments != null ? `${m.comments} comments` : null,
    p.pillar,
    p.format,
  ].filter(Boolean);
  return `[${bits.join(" · ")}]\n${p.text.trim()}`;
}

/** Context block built from your history. Stable between calls, so it's cached. */
export function buildContext(posts: Post[], swipe: SwipeItem[] = [], audienceNote = ""): string {
  const ranked = posts.filter((p) => p.performanceScore != null && p.text.trim()).sort((a, b) => b.performanceScore! - a.performanceScore!);
  const best = ranked.slice(0, 6);
  const worst = ranked.length > 8 ? ranked.slice(-3) : [];
  const saved = swipe.filter((s) => (s.rating ?? 0) >= 4 && s.text.trim()).slice(0, 5);

  const parts: string[] = [];
  if (best.length) parts.push(`<their_best_posts>\n${best.map(postSummary).join("\n\n---\n\n")}\n</their_best_posts>`);
  if (worst.length) parts.push(`<their_weakest_posts>\n${worst.map(postSummary).join("\n\n---\n\n")}\n</their_weakest_posts>`);
  if (saved.length)
    parts.push(
      `<posts_they_admire_by_others>\n${saved
        .map((s) => `By ${s.author || "someone"}${s.whyItWorks ? ` (why they saved it: ${s.whyItWorks})` : ""}\n${s.text.trim()}`)
        .join("\n\n---\n\n")}\n</posts_they_admire_by_others>`,
    );
  if (audienceNote) parts.push(`<their_audience_and_goals>\n${audienceNote}\nJudge relevance to these people and say who in this audience the draft speaks to.\n</their_audience_and_goals>`);
  if (!parts.length) parts.push("<note>They have no published posts with metrics yet. Judge on craft alone.</note>");
  return parts.join("\n\n");
}

async function structured<T extends z.ZodType>(schema: T, context: string, task: string, effort: "low" | "medium" | "high" = "medium") {
  const res = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system: [
      { type: "text", text: SYSTEM },
      { type: "text", text: context, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: task }],
  });
  if (res.stop_reason === "refusal") throw new Error("The assistant declined this request.");
  if (!res.parsed_output) throw new Error("The assistant returned an unexpected response. Try again.");
  return res.parsed_output as z.infer<T>;
}

export const CritiqueSchema = z.object({
  score: z.number().describe("0-100: how well this will likely perform for THIS author, relative to their own history"),
  hook: z.number().describe("1-5"),
  clarity: z.number().describe("1-5"),
  value: z.number().describe("1-5: how useful or interesting to their audience"),
  voice: z.number().describe("1-5: how much it sounds like their best posts"),
  verdict: z.string().describe("One or two plain sentences: the overall call"),
  strengths: z.array(z.string()).describe("Up to 3"),
  fixes: z.array(z.object({ issue: z.string(), suggestion: z.string() })).describe("Up to 5, most important first"),
  suggestedHookType: z.string().describe("Story, Contrarian, Question, Number / list, Bold claim, Confession, How-to or Data point"),
  suggestedPillar: z.string().describe("A short content-pillar label"),
});
export type Critique = z.infer<typeof CritiqueSchema>;

export function critique(draft: string, context: string) {
  return structured(
    CritiqueSchema,
    context,
    `Review this draft LinkedIn post. Score it against what has worked for this author before.\n\n<draft>\n${draft}\n</draft>`,
    "high",
  );
}

export const HooksSchema = z.object({
  hooks: z.array(z.object({ text: z.string(), type: z.string(), why: z.string() })).describe("Exactly 5 alternative opening lines"),
});

export function hooks(draft: string, context: string) {
  return structured(
    HooksSchema,
    context,
    `Write 5 alternative opening lines for this post. Each must be under 120 characters, in the author's voice, and use a different hook type. Don't promise anything the post doesn't deliver.\n\n<draft>\n${draft}\n</draft>`,
  );
}

export const RewriteSchema = z.object({ text: z.string(), changes: z.array(z.string()).describe("Up to 4 short notes on what changed") });

export function rewrite(draft: string, instruction: string, context: string) {
  return structured(
    RewriteSchema,
    context,
    `Rewrite this LinkedIn post. Instruction: ${instruction || "Tighten it and sharpen the hook. Keep the substance and the voice."}\nStay under 3,000 characters. Return only the post text in \`text\`.\n\n<draft>\n${draft}\n</draft>`,
  );
}

export const IdeasSchema = z.object({
  ideas: z
    .array(z.object({ title: z.string(), angle: z.string(), hook: z.string(), pillar: z.string(), why: z.string() }))
    .describe("Exactly 6 post ideas"),
});

export function ideas(topic: string, context: string) {
  return structured(
    IdeasSchema,
    context,
    `Suggest 6 LinkedIn post ideas for this author.${topic ? ` Focus: ${topic}.` : ""} Lean on the themes, formats and hook styles that performed best for them, and include one or two that stretch into something new. For each, give a draft first line and say which past result makes you think it will work.`,
  );
}
