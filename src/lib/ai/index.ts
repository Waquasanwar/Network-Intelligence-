import type { AIProvider } from "./types";
import { HeuristicAIProvider } from "./heuristic";
import { AnthropicAIProvider } from "./anthropic";

let cached: AIProvider | null = null;

/** Provider selection lives in one place so the rest of the app never imports a vendor. */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const kind = (process.env.AI_PROVIDER || "heuristic").toLowerCase();
  if (kind === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    cached = new AnthropicAIProvider(process.env.ANTHROPIC_API_KEY);
  } else {
    cached = new HeuristicAIProvider();
  }
  return cached;
}

export * from "./types";
