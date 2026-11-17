"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Dictate into the draft with the browser's speech recognition. Hidden where unsupported. */
export function Dictate({ onText }: { onText: (t: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef<any>(null);
  useEffect(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language || "en-GB";
    r.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
      if (t.trim()) onText(t.trim());
    };
    r.onend = () => setOn(false);
    rec.current = r;
    return () => r.abort();
  }, [onText]);
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`btn small ${on ? "recording" : ""}`}
      aria-pressed={on}
      onClick={() => {
        if (on) rec.current?.stop();
        else { rec.current?.start(); setOn(true); }
      }}
    >
      <span className="mic-dot" aria-hidden /> {on ? "Listening… tap to stop" : "Dictate"}
    </button>
  );
}
