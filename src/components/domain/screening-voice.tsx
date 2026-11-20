"use client";
import { useEffect, useRef, useState } from "react";
import { Volume2, Square, Mic } from "lucide-react";

/**
 * Talk the screening through. "Hear the question" reads it aloud: the natural voice when the
 * platform has one and the member has agreed to it (the server decides, see /api/voice/speak),
 * otherwise the device's own voice. Answers are spoken with the phone's or computer's own
 * dictation (the microphone on the keyboard), so nothing of ours ever hears them.
 */
export function ScreeningVoice({ question, autoPlay = false }: { question: string; autoPlay?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audio.current?.pause(); audio.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const device = () => {
    if (!("speechSynthesis" in window)) { setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(question);
    u.lang = "en-GB"; u.rate = 0.98; u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const play = async () => {
    if (speaking) { stop(); return; }
    setSpeaking(true);
    try {
      const r = await fetch("/api/voice/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: question }) });
      if (!r.ok) throw new Error("fallback");
      const url = URL.createObjectURL(await r.blob());
      const a = new Audio(url); audio.current = a;
      a.onended = () => { URL.revokeObjectURL(url); setSpeaking(false); };
      await a.play();
    } catch { device(); }
  };

  // Start (if asked to) when a question arrives, and stop speaking when it changes or the page closes.
  useEffect(() => {
    if (autoPlay) void play();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2" data-screening-voice>
      <button type="button" onClick={play} aria-pressed={speaking} className="chip !h-9">
        {speaking ? <Square className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        {speaking ? "Stop" : "Hear the question"}
      </button>
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-faint"><Mic className="h-3.5 w-3.5" aria-hidden="true" />Rather talk? Tap the microphone on your keyboard and say your answer.</span>
    </div>
  );
}
