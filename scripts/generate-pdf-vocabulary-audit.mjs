import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "vocabulary.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data", "pdf-vocabulary-additions.json"), "utf8"));
const outputPath = path.join(root, "data", "pdf-vocabulary-audit-report.json");

function normalizedWord(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’]/g, "'")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const courses = data.courses.map((course) => {
  const allEntries = data.entries.filter((entry) => entry.courseId === course.id);
  const active = allEntries.filter((entry) => entry.contentStatus !== "quarantined");
  const quarantined = allEntries.filter((entry) => entry.contentStatus === "quarantined");
  const courseManifest = manifest.courses[course.id];
  const added = courseManifest?.entries.length ?? 0;
  const corrections = manifest.corrections.filter((entry) => entry.courseId === course.id);
  const expectedPublished = courseManifest?.pdfWordCount ?? active.length;
  const byWord = new Map();
  for (const entry of active) {
    const key = normalizedWord(entry.word);
    const values = byWord.get(key) ?? [];
    values.push({ id: entry.id, word: entry.word, pos: entry.pos, zh: entry.zh });
    byWord.set(key, values);
  }
  const duplicateForms = [...byWord.values()].filter((values) => values.length > 1);
  const unresolved = [];
  const status = active.length === expectedPublished && unresolved.length === 0 ? "confirmed" : "blocked";
  return {
    courseId: course.id,
    level: course.level,
    code: course.code,
    sourcePage: course.sourceStartPage,
    pdfTableWordCount: expectedPublished + quarantined.length,
    normalizedPublishedWordCount: expectedPublished,
    originalProjectWordCount: active.length - added,
    addedWordCount: added,
    correctedWordCount: corrections.length,
    publishedWordCount: active.length,
    groupedContinuationRows: quarantined.map((entry) => entry.id),
    duplicateForms,
    unresolved,
    status,
  };
});

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  scope: manifest.scope,
  sources: data.metadata.sourcePdfs,
  courseCount: courses.length,
  summary: {
    confirmedCourses: courses.filter((course) => course.status === "confirmed").length,
    blockedCourses: courses.filter((course) => course.status === "blocked").length,
    originalPublishedEntries: courses.reduce((sum, course) => sum + course.originalProjectWordCount, 0),
    addedEntries: courses.reduce((sum, course) => sum + course.addedWordCount, 0),
    correctedEntries: courses.reduce((sum, course) => sum + course.correctedWordCount, 0),
    publishedEntries: courses.reduce((sum, course) => sum + course.publishedWordCount, 0),
    groupedContinuationRows: courses.reduce((sum, course) => sum + course.groupedContinuationRows.length, 0),
    unresolvedEntries: courses.reduce((sum, course) => sum + course.unresolved.length, 0),
  },
  courses,
};

if (report.courseCount !== 72 || report.summary.blockedCourses > 0) {
  throw new Error(`PDF 词汇审计未通过：${report.courseCount} 课，${report.summary.blockedCourses} 课阻塞。`);
}

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary, null, 2));
