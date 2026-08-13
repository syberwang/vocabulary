import { describe, expect, it } from "vitest";
import { courses, entries } from "@/lib/vocabulary";

describe("imported vocabulary", () => {
  it("contains all source rows and courses", () => {
    expect(entries).toHaveLength(1436);
    expect(courses).toHaveLength(72);
    expect(courses.filter((course) => course.level === "A1")).toHaveLength(36);
    expect(courses.filter((course) => course.level === "A2")).toHaveLength(36);
  });

  it("keeps required study fields and provenance", () => {
    expect(entries.every((entry) => entry.word && entry.pos && entry.zh && entry.courseId && entry.sourcePage)).toBe(true);
    expect(entries.every((entry) => entry.exampleFr && entry.exampleZh && entry.usageNote)).toBe(true);
    const active = entries.filter((entry) => entry.contentStatus !== "quarantined");
    expect(active).toHaveLength(1432);
    expect(active.every((entry) => entry.contentStatus === "approved")).toBe(true);
    expect(active.every((entry) => entry.exampleSource?.kind === "manual" || entry.exampleSource?.kind === "codex")).toBe(true);
    expect(active.every((entry) => entry.contentRisk === "low" && entry.contentReview?.reviewerType === "human" && entry.contentReview.contentHash)).toBe(true);
    expect(active.some((entry) => entry.usageNote.includes("导入占位"))).toBe(false);
    expect(active.some((entry) => entry.exampleFr.includes("Dans cette leçon, on apprend"))).toBe(false);
  });

  it("restores known PDF-backed corrections", () => {
    expect(entries.find((entry) => entry.sourceRow === 1006)).toMatchObject({ word: "or", pos: "n.m.", zh: "金子、黄金；珍贵或完美的东西" });
    expect(entries.find((entry) => entry.sourceRow === 664)).toMatchObject({ word: "œil / yeux", acceptedAnswers: ["œil / yeux", "œil", "yeux"] });
    expect(entries.find((entry) => entry.sourceRow === 783)?.word).toBe("grand-mère / grands-mères");
    expect(entries.find((entry) => entry.sourceRow === 785)?.word).toBe("grand-père / grands-pères");
    expect(entries.find((entry) => entry.sourceRow === 848)?.word).toBe("cheval / chevaux");
    expect(entries.find((entry) => entry.sourceRow === 190)).toMatchObject({ word: "manteau / manteaux", pos: "n.m.", contentStatus: "approved" });
    expect(entries.find((entry) => entry.sourceRow === 892)?.word).toBe("bulletin météo");
    expect(entries.find((entry) => entry.sourceRow === 1126)?.word).toBe("arriver à (+ inf.)");
    expect(entries.find((entry) => entry.sourceRow === 1211)?.word).toBe("à la carte");
    expect(entries.find((entry) => entry.sourceRow === 1221)?.word).toBe("émission en direct");
    expect(entries.find((entry) => entry.sourceRow === 1316)?.word).toBe("en ce moment");
    expect(entries.find((entry) => entry.sourceRow === 1322)?.word).toBe("beaux-arts");
    expect(entries.find((entry) => entry.sourceRow === 1422)?.word).toBe("avoir l'impression de / que");
    expect([665, 784, 786, 849].every((row) => entries.find((entry) => entry.sourceRow === row)?.contentStatus === "quarantined")).toBe(true);
  });
});
