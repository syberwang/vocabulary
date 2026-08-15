// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { courses, entries } from "@/lib/vocabulary";

const root = process.cwd();
const additions = JSON.parse(fs.readFileSync(path.join(root, "data", "pdf-vocabulary-additions.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(root, "data", "pdf-vocabulary-audit-report.json"), "utf8"));
const seedSql = fs.readFileSync(path.join(root, "postgres", "seed.sql"), "utf8");

describe("PDF vocabulary repair", () => {
  it("preserves workbook IDs and assigns deterministic PDF IDs and source rows", () => {
    const workbookEntries = entries.filter((entry) => entry.id.startsWith("entry-"));
    const pdfEntries = entries.filter((entry) => entry.id.startsWith("pdf-"));
    expect(workbookEntries).toHaveLength(1436);
    expect(pdfEntries).toHaveLength(419);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.sourceRow)).size).toBe(entries.length);

    for (const [courseId, course] of Object.entries<any>(additions.courses)) {
      const positions = course.entries.map((entry: any) => entry.position);
      expect(new Set(positions).size).toBe(positions.length);
      for (const addition of course.entries) {
        const expectedId = `pdf-${courseId}-${String(addition.position).padStart(3, "0")}`;
        const entry = entries.find((candidate) => candidate.id === expectedId);
        expect(entry).toMatchObject({ courseId, word: addition.word, pos: addition.pos, zh: addition.zh });
        expect(entry?.sourceRow).toBe(additions.sourceRowRanges.A2 + entry!.lesson * 100 + addition.position);
      }
    }
  });

  it("matches every course count to its approved entries", () => {
    for (const course of courses) {
      const approved = entries.filter((entry) => entry.courseId === course.id && entry.contentStatus === "approved");
      expect(course.wordCount).toBe(approved.length);
    }
    expect(audit.courseCount).toBe(72);
    expect(audit.summary).toMatchObject({ confirmedCourses: 72, blockedCourses: 0, addedEntries: 419, correctedEntries: 23, unresolvedEntries: 0 });
  });

  it("publishes all twelve missing U4L13 words", () => {
    const expected = [
      "professionnel(le)", "rarement", "règle", "régulier(ère)", "régulièrement", "résolution",
      "respecter", "soi", "souhaiter", "se souhaiter", "timide", "truc",
    ];
    const courseEntries = entries.filter((entry) => entry.courseId === "a2-u4l13" && entry.contentStatus === "approved");
    expect(courseEntries).toHaveLength(32);
    expect(expected.every((word) => courseEntries.some((entry) => entry.word === word))).toBe(true);
  });

  it("approves every repaired entry with a content hash", () => {
    const repairedIds = new Set([
      ...Object.entries<any>(additions.courses).flatMap(([courseId, course]) =>
        course.entries.map((entry: any) => `pdf-${courseId}-${String(entry.position).padStart(3, "0")}`),
      ),
      ...additions.corrections.map((entry: any) => entry.entryId),
    ]);
    const repaired = entries.filter((entry) => repairedIds.has(entry.id));
    expect(repaired).toHaveLength(442);
    expect(repaired.every((entry) => entry.contentStatus === "approved" && entry.contentReview?.contentHash)).toBe(true);
    expect(repaired.every((entry) => entry.exampleFr && entry.exampleZh && entry.usageNote)).toBe(true);
  });

  it("keeps the seed repeatable and reopens learned courses with unmastered approved words", () => {
    expect(seedSql.toLowerCase()).not.toMatch(/\b(delete|truncate)\b/);
    expect(seedSql).toContain("on conflict (id) do update");
    expect(seedSql).toContain("cp.mastered_entry_ids ? ve.id");
    expect(seedSql).toContain("set status='learning', completed_at=null");
  });
});
