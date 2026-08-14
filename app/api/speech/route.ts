import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { entryById } from "@/lib/vocabulary";
import {
  buildSpeechSsml,
  DEFAULT_SPEECH_VOICE,
  parseSpeechKind,
  parseSpeechRate,
  speechCacheKey,
  speechText,
} from "@/lib/speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inflight = new Map<string, Promise<ArrayBuffer>>();

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function configuredSpeech() {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  const voice = process.env.AZURE_SPEECH_VOICE?.trim() || DEFAULT_SPEECH_VOICE;
  if (!key || !region || !/^[a-z0-9-]+$/i.test(region) || !/^[A-Za-z]{2}-[A-Za-z]{2}-[A-Za-z0-9:._-]+$/.test(voice)) return null;
  return { key, region, voice };
}

async function synthesize(text: string, voice: string, rate: 0.75 | 0.9, key: string, region: string, cacheKey: string) {
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const request = fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/ssml+xml",
      "Ocp-Apim-Subscription-Key": key,
      "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      "User-Agent": "french-vocabulary-pwa",
    },
    body: buildSpeechSsml(text, voice, rate),
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Azure Speech returned ${response.status}`);
    return response.arrayBuffer();
  });

  inflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inflight.delete(cacheKey);
  }
}

export async function GET(request: Request) {
  if (!(await requireApiSession())) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const kind = parseSpeechKind(url.searchParams.get("kind"));
  const rate = parseSpeechRate(url.searchParams.get("rate"));
  const entryId = url.searchParams.get("entryId") ?? undefined;
  if (!kind || rate === null || (kind !== "sample" && !entryId) || (kind === "sample" && entryId)) {
    return json({ error: "Invalid speech parameters" }, 400);
  }

  const entry = entryId ? entryById.get(entryId) : undefined;
  const text = speechText(entry, kind);
  if (!text) return json({ error: "Vocabulary entry not found" }, 404);

  const configuration = configuredSpeech();
  if (!configuration) return json({ error: "Speech service is not configured" }, 503);

  const cacheKey = speechCacheKey(text, configuration.voice, rate);
  const etag = `"${cacheKey}"`;
  const headers = {
    "Cache-Control": "private, max-age=31536000, immutable",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  try {
    const audio = await synthesize(text, configuration.voice, rate, configuration.key, configuration.region, cacheKey);
    return new Response(audio, { headers: { ...headers, "Content-Type": "audio/mpeg" } });
  } catch {
    return json({ error: "Speech service is temporarily unavailable" }, 502);
  }
}
