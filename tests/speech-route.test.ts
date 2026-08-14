// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireApiSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);

import { GET } from "@/app/api/speech/route";

const savedEnvironment = {
  key: process.env.AZURE_SPEECH_KEY,
  region: process.env.AZURE_SPEECH_REGION,
  voice: process.env.AZURE_SPEECH_VOICE,
};

function request(path: string, headers?: HeadersInit) {
  return new Request(`https://example.test${path}`, { headers });
}

describe("speech route", () => {
  beforeEach(() => {
    auth.requireApiSession.mockResolvedValue(true);
    process.env.AZURE_SPEECH_KEY = "test-speech-key";
    process.env.AZURE_SPEECH_REGION = "canadacentral";
    process.env.AZURE_SPEECH_VOICE = "fr-FR-DeniseNeural";
  });

  afterEach(() => {
    auth.requireApiSession.mockReset();
    vi.unstubAllGlobals();
    for (const [name, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[`AZURE_SPEECH_${name.toUpperCase()}`];
      else process.env[`AZURE_SPEECH_${name.toUpperCase()}`] = value;
    }
  });

  it("requires an authenticated session", async () => {
    auth.requireApiSession.mockResolvedValue(false);
    const response = await GET(request("/api/speech?kind=sample&rate=0.9"));
    expect(response.status).toBe(401);
  });

  it("rejects arbitrary or malformed speech parameters", async () => {
    const response = await GET(request("/api/speech?kind=text&rate=1&text=secret"));
    expect(response.status).toBe(400);
  });

  it("proxies audio without exposing the provider key and supports conditional caching", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("/api/speech?kind=sample&rate=0.9"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("audio/mpeg");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://canadacentral.tts.speech.microsoft.com/cognitiveservices/v1");
    expect((options.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"]).toBe("test-speech-key");
    expect(String(options.body)).toContain("fr-FR");
    expect(String(options.body)).toContain("Bonjour");
    expect(String(options.body)).not.toContain("test-speech-key");

    const cached = await GET(request("/api/speech?kind=sample&rate=0.9", { "if-none-match": response.headers.get("etag")! }));
    expect(cached.status).toBe(304);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a configuration error without calling Azure", async () => {
    delete process.env.AZURE_SPEECH_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("/api/speech?kind=sample&rate=0.9"));
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
