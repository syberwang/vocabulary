// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildSpeechSsml,
  escapeXml,
  parseSpeechKind,
  parseSpeechRate,
  rateToSsml,
  speechText,
} from "@/lib/speech";
import type { VocabularyEntry } from "@/lib/types";

const entry = (contentStatus: VocabularyEntry["contentStatus"] = "approved") => ({
  id: "entry-1",
  sourceRow: 1,
  courseId: "a1-u1l1",
  level: "A1",
  unit: 1,
  lesson: 1,
  courseCode: "U1L1",
  word: "l'été & l'œil",
  pos: "n.m.",
  zh: "测试",
  acceptedAnswers: ["l'été"],
  exampleFr: "C'est <important>.",
  exampleZh: "这是测试。",
  usageNote: "",
  sourcePage: 1,
  sourceMethod: "test",
  raw: { word: "l'été", pos: "n.m.", zh: "测试" },
  contentStatus,
  contentVersion: 1,
} satisfies VocabularyEntry);

describe("speech helpers", () => {
  it("parses only supported speech kinds and rates", () => {
    expect(parseSpeechKind("word")).toBe("word");
    expect(parseSpeechKind("example")).toBe("example");
    expect(parseSpeechKind("other")).toBeNull();
    expect(parseSpeechRate(null)).toBe(0.9);
    expect(parseSpeechRate("0.75")).toBe(0.75);
    expect(parseSpeechRate("1")).toBeNull();
  });

  it("selects approved entry text and rejects non-approved entries", () => {
    expect(speechText(entry(), "word")).toBe("l'été & l'œil");
    expect(speechText(entry(), "example")).toBe("C'est <important>.");
    expect(speechText(entry("needs_review"), "word")).toBeNull();
    expect(speechText(undefined, "sample")).toContain("Bonjour");
  });

  it("escapes SSML content and maps rates", () => {
    expect(escapeXml(`<a>&"'`)).toBe("&lt;a&gt;&amp;&quot;&apos;");
    expect(rateToSsml(0.75)).toBe("-25%");
    expect(rateToSsml(0.9)).toBe("-10%");
    const ssml = buildSpeechSsml("C'est <important> & bon", "fr-FR-DeniseNeural", 0.9);
    expect(ssml).toContain('xml:lang="fr-FR"');
    expect(ssml).toContain('rate="-10%"');
    expect(ssml).toContain("C&apos;est &lt;important&gt; &amp; bon");
  });
});
