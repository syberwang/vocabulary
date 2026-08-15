import { createHash } from "node:crypto";
import type { VocabularyEntry } from "@/lib/types";

export const SPEECH_KINDS = ["word", "example", "sample"] as const;
export type SpeechKind = (typeof SPEECH_KINDS)[number];
export const SPEECH_RATES = [0.75, 0.9] as const;
export type SpeechRate = (typeof SPEECH_RATES)[number];

export const DEFAULT_SPEECH_VOICE = "fr-FR-DeniseNeural";
export const SPEECH_LOCALE = "fr-FR";
export const SPEECH_SAMPLE_TEXT = "Bonjour, bienvenue dans votre cours de français.";

export function parseSpeechRate(value: string | null): SpeechRate | null {
  if (value === null || value === "0.9") return 0.9;
  if (value === "0.75") return 0.75;
  return null;
}

export function parseSpeechKind(value: string | null): SpeechKind | null {
  if (value && SPEECH_KINDS.includes(value as SpeechKind)) return value as SpeechKind;
  return null;
}

export function speechText(entry: VocabularyEntry | undefined, kind: SpeechKind) {
  if (kind === "sample") return SPEECH_SAMPLE_TEXT;
  if (!entry || entry.contentStatus !== "approved") return null;
  return kind === "word" ? entry.word : entry.exampleFr;
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function rateToSsml(rate: SpeechRate) {
  return `${Math.round((rate - 1) * 100)}%`;
}

export function buildSpeechSsml(text: string, voice: string, rate: SpeechRate) {
  return `<speak version="1.0" xml:lang="${SPEECH_LOCALE}"><voice name="${escapeXml(voice)}" xml:lang="${SPEECH_LOCALE}"><prosody rate="${rateToSsml(rate)}">${escapeXml(text)}</prosody></voice></speak>`;
}

export function speechCacheKey(text: string, voice: string, rate: SpeechRate) {
  return createHash("sha256").update(`${SPEECH_LOCALE}\0${voice}\0${rate}\0${text}`).digest("hex");
}
