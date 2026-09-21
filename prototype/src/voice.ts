/**
 * Voice for the screening conversation: the question is spoken aloud, the answer is captured
 * by speech recognition, and the person sees the transcript and can edit it before moving on.
 *
 * Uses the browser's built-in SpeechRecognition and SpeechSynthesis. Both are optional: where
 * they are missing the screening stays a normal typed form. Nothing is uploaded anywhere.
 */

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type W = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export const speechSupported = () => typeof window !== "undefined" && !!((window as W).SpeechRecognition || (window as W).webkitSpeechRecognition);
export const speakSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

let rec: Recognition | null = null;
let stopTimer: number | null = null;

/** Read a question aloud. Resolves when it finishes, or immediately if speech is unavailable or muted. */
export function speak(text: string, muted: boolean): Promise<void> {
  if (muted || !speakSupported()) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02; u.pitch = 1; u.lang = "en-GB";
      const voices = window.speechSynthesis.getVoices();
      const pick = voices.find((v) => /en-GB/i.test(v.lang) && /female|Serena|Kate|Sonia|Libby/i.test(v.name)) ?? voices.find((v) => /en-GB/i.test(v.lang)) ?? voices.find((v) => /en[-_]/i.test(v.lang));
      if (pick) u.voice = pick;
      u.onend = () => resolve(); u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
      setTimeout(resolve, Math.min(14000, 1200 + text.length * 70)); // never block the flow
    } catch { resolve(); }
  });
}

export function stopSpeaking() { try { if (speakSupported()) window.speechSynthesis.cancel(); } catch { /* ignore */ } }

export type ListenHandlers = { onText: (finalText: string, interim: string) => void; onEnd: (reason: "silence" | "stopped" | "error", message?: string) => void };

/**
 * Listen until the person stops talking for `silenceMs`, or until stopListening() is called.
 * Interim results stream so the transcript appears as they speak.
 */
export function listen(h: ListenHandlers, silenceMs = 2600): boolean {
  const Ctor = (window as W).SpeechRecognition || (window as W).webkitSpeechRecognition;
  if (!Ctor) return false;
  stopListening();
  let finalText = "";
  const r = new Ctor();
  rec = r;
  r.lang = "en-GB"; r.continuous = true; r.interimResults = true;
  const arm = () => { if (stopTimer) clearTimeout(stopTimer); stopTimer = window.setTimeout(() => { try { r.stop(); } catch { /* ignore */ } }, silenceMs); };
  r.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; if (res.isFinal) finalText += (finalText ? " " : "") + res[0].transcript.trim(); else interim += res[0].transcript; }
    h.onText(finalText, interim.trim());
    arm();
  };
  r.onerror = (e) => { if (stopTimer) clearTimeout(stopTimer); rec = null; h.onEnd(e.error === "no-speech" ? "silence" : "error", e.error === "not-allowed" ? "Microphone permission was declined. You can type instead." : e.error === "no-speech" ? "I did not catch that." : "Voice is not available right now. You can type instead."); };
  r.onend = () => { if (stopTimer) clearTimeout(stopTimer); const was = rec; rec = null; if (was) h.onEnd("silence"); };
  try { r.start(); arm(); return true; } catch { rec = null; return false; }
}

export function stopListening() {
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  const r = rec; rec = null;
  if (r) { try { r.stop(); } catch { /* ignore */ } }
}

export const listening = () => rec !== null;

/**
 * Read a spoken answer for a question whose control is not free text.
 * Returns the option key the person picked, or null.
 */
export function matchChoice(said: string, options: [string, string][]): string | null {
  const t = said.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  let best: { key: string; score: number } | null = null;
  for (const [key, label] of options) {
    const l = label.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    let score = 0;
    if (t === l) score = 100;
    else if (t.includes(l) || l.includes(t)) score = 70;
    else { const words = l.split(" ").filter((w) => w.length > 3); const hits = words.filter((w) => t.includes(w)).length; score = words.length ? (hits / words.length) * 60 : 0; }
    if (score > 35 && (!best || score > best.score)) best = { key, score };
  }
  return best?.key ?? null;
}

/** "four", "4 out of 5", "high" → 4. Returns null when nothing numeric was said. */
export function matchScale(said: string): number | null {
  const t = said.toLowerCase();
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const digit = /\b([1-5])\b/.exec(t);
  if (digit) return Number(digit[1]);
  for (const [w, n] of Object.entries(words)) if (new RegExp(`\\b${w}\\b`).test(t)) return n;
  if (/\b(very high|strongly|definitely|always)\b/.test(t)) return 5;
  if (/\b(high|mostly|usually|yes)\b/.test(t)) return 4;
  if (/\b(middle|middling|depends|sometimes|in between|average)\b/.test(t)) return 3;
  if (/\b(low|rarely|not really)\b/.test(t)) return 2;
  if (/\b(very low|never|not at all|no)\b/.test(t)) return 1;
  return null;
}

/** Split a spoken list ("Sarah Okonkwo and Ben Hughes") into names. */
export function splitSpokenList(said: string): string[] {
  return said.split(/,| and | then |;/i).map((s) => s.trim()).filter((s) => s.length > 1);
}
