import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "data", "vocabulary.json");
const contentDir = path.join(root, "data", "content-courses");
const reportPath = path.join(root, "data", "content-validation-report.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const byId = new Map(data.entries.map((entry) => [entry.id, entry]));
const issues = [];
const seenEntries = new Set();
let merged = 0;
let changed = 0;

function targetForms(entry) {
  return [...(entry.acceptedAnswers ?? []), entry.word]
    .flatMap((value) => String(value).split(/\s+\/\s+/))
    .map((value) => value.replace(/[’]/g, "'").replace(/\[[^\]]+\]/g, "").trim())
    .filter((value) => value && !/[()]/.test(value));
}

function containsTarget(entry, sentence) {
  const normalized = sentence.normalize("NFKC").toLocaleLowerCase("fr-FR").replace(/[’]/g, "'");
  return targetForms(entry).some((value) =>
    normalized.includes(value.normalize("NFKC").toLocaleLowerCase("fr-FR").replace(/[’]/g, "'")),
  );
}

const files = fs.existsSync(contentDir)
  ? fs.readdirSync(contentDir).filter((name) => name.endsWith(".json")).sort()
  : [];

for (const course of data.courses) {
  if (!files.includes(`${course.id}.json`)) issues.push({ courseId: course.id, issue: "missing_course_file" });
}

for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(contentDir, file), "utf8"));
  const expectedCourseId = path.basename(file, ".json");
  if (payload.courseId !== expectedCourseId) issues.push({ file, issue: "course_id_mismatch" });

  for (const generated of payload.entries ?? []) {
    if (seenEntries.has(generated.entryId)) {
      issues.push({ entryId: generated.entryId, issue: "duplicate_generated_entry" });
      continue;
    }
    seenEntries.add(generated.entryId);
    const entry = byId.get(generated.entryId);
    if (!entry) {
      issues.push({ entryId: generated.entryId, issue: "unknown_entry" });
      continue;
    }
    if (entry.courseId !== payload.courseId) {
      issues.push({ entryId: entry.id, issue: "wrong_course" });
      continue;
    }
    if (!generated.exampleFr || !generated.exampleZh || !generated.usageNote) {
      issues.push({ entryId: entry.id, issue: "missing_field" });
      continue;
    }
    if (generated.exampleFr.length > 240 || generated.exampleZh.length > 160 || generated.usageNote.length > 160) {
      issues.push({ entryId: entry.id, issue: "length_limit" });
      continue;
    }
    if (generated.source?.kind !== "manual" && !containsTarget(entry, generated.exampleFr)) {
      issues.push({ entryId: entry.id, issue: "target_not_found", exampleFr: generated.exampleFr });
      continue;
    }

    const next = {
      exampleFr: generated.exampleFr,
      exampleZh: generated.exampleZh,
      usageNote: generated.usageNote,
      exampleSource: generated.source,
      contentRisk: generated.risk,
      contentReview: generated.review,
      contentStatus: generated.status === "approved" ? "approved" : "needs_review",
    };
    const isChanged = Object.entries(next).some(([key, value]) => JSON.stringify(entry[key]) !== JSON.stringify(value));
    Object.assign(entry, next);
    if (isChanged) {
      entry.contentVersion = Math.max(2, Number(entry.contentVersion ?? 1) + 1);
      changed += 1;
    }
    merged += 1;
  }
}

const active = data.entries.filter((entry) => entry.contentStatus !== "quarantined");
for (const entry of active) {
  if (!seenEntries.has(entry.id)) issues.push({ entryId: entry.id, issue: "active_entry_not_generated" });
  if (entry.usageNote.includes("导入占位") || entry.exampleFr.includes("Dans cette leçon, on apprend")) {
    issues.push({ entryId: entry.id, issue: "placeholder_remaining" });
  }
}

const placeholders = issues.filter((issue) => issue.issue === "placeholder_remaining").length;
data.metadata.generatedAt = new Date().toISOString();
data.metadata.courseContentFiles = files.length;
data.metadata.codexMerged = merged;
data.metadata.placeholderCount = placeholders;
delete data.metadata.codexDraftExamples;
data.metadata.codexGeneratedExamples = active.filter((entry) => entry.exampleSource?.kind === "codex").length;
data.metadata.manualExamples = active.filter((entry) => entry.exampleSource?.kind === "manual").length;
data.metadata.humanReviewedExamples = active.filter((entry) => entry.contentReview?.reviewerType === "human").length;
data.metadata.approvedExamples = active.filter((entry) => entry.contentStatus === "approved").length;
data.metadata.needsReview = active.filter((entry) => entry.contentStatus === "needs_review").length;
data.metadata.quarantined = data.entries.filter((entry) => entry.contentStatus === "quarantined").length;
data.metadata.validationIssues = issues.length;

const report = {
  generatedAt: new Date().toISOString(),
  merged,
  changed,
  courseFiles: files.length,
  activeEntries: active.length,
  placeholders,
  issues,
};
fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ merged, changed, courseFiles: files.length, activeEntries: active.length, placeholders, issues: issues.length }, null, 2));
