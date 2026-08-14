"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import type { SpeechKind } from "@/lib/speech";

type CloudSpeechKind = Exclude<SpeechKind, "sample">;
export type SpeechPlaybackState = "idle" | "loading" | "playing" | "error";

function speechUrl(entryId: string | undefined, kind: SpeechKind, rate: number) {
  const params = new URLSearchParams({ kind, rate: rate === 0.75 ? "0.75" : "0.9" });
  if (entryId) params.set("entryId", entryId);
  return `/api/speech?${params.toString()}`;
}

export function useSpeech() {
  const { state } = useApp();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechState, setSpeechState] = useState<SpeechPlaybackState>("idle");
  const [speechError, setSpeechError] = useState<string>();
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = undefined;
  }, []);

  const frenchVoices = useMemo(
    () => voices.filter((voice) => voice.lang.toLowerCase().startsWith("fr")),
    [voices],
  );

  const playCloud = useCallback((entryId: string | undefined, kind: SpeechKind) => {
    if (typeof Audio === "undefined") {
      setSpeechState("error");
      setSpeechError("当前设备不支持音频播放。");
      return false;
    }

    audioRef.current?.pause();
    const audio = new Audio(speechUrl(entryId, kind, state.speechRate));
    audio.preload = "auto";
    audioRef.current = audio;
    setSpeechState("loading");
    setSpeechError(undefined);
    audio.addEventListener("ended", () => setSpeechState("idle"), { once: true });
    audio.addEventListener("error", () => {
      setSpeechState("error");
      setSpeechError("标准云端发音暂时不可用，请稍后重试。");
    }, { once: true });
    void audio.play()
      .then(() => setSpeechState("playing"))
      .catch(() => {
        setSpeechState("error");
        setSpeechError("标准云端发音暂时不可用，请稍后重试。");
      });
    return true;
  }, [state.speechRate]);

  const speak = useCallback((entryId: string, kind: CloudSpeechKind = "word") => playCloud(entryId, kind), [playCloud]);
  const speakSample = useCallback(() => playCloud(undefined, "sample"), [playCloud]);

  const localSpeak = useCallback((text: string) => {
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
  }, [frenchVoices, state.speechRate, state.voiceUri, supported]);

  return {
    supported,
    voices: frenchVoices,
    hasFrenchVoice: frenchVoices.length > 0,
    speak,
    speakSample,
    localSpeak,
    speechState,
    speechError,
  };
}
