"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";

export function useSpeech() {
  const { state } = useApp();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const frenchVoices = useMemo(
    () => voices.filter((voice) => voice.lang.toLowerCase().startsWith("fr")),
    [voices],
  );

  function speak(text: string) {
    if (!supported || !text || frenchVoices.length === 0) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = state.speechRate;
    utterance.voice = frenchVoices.find((voice) => voice.voiceURI === state.voiceUri)
      ?? frenchVoices.find((voice) => voice.lang.toLowerCase() === "fr-fr")
      ?? frenchVoices[0];
    window.speechSynthesis.speak(utterance);
    return true;
  }

  return { supported, voices: frenchVoices, hasFrenchVoice: frenchVoices.length > 0, speak };
}
