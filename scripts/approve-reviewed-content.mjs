import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "data", "vocabulary.json");
const contentDir = path.join(root, "data", "content-courses");
const manifestPath = path.join(root, "data", "content-approval-manifest.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const args = process.argv.slice(2);
const approveAll = args.includes("--all");
const approvePdfAudit = args.includes("--pdf-audit");
const levels = new Set(args.filter((value, index) => args[index - 1] === "--level").map((value) => value.toUpperCase()));
if (!approveAll && !approvePdfAudit && levels.size === 0) throw new Error("请使用 --all、--pdf-audit，或使用 --level A1 / --level A2。");
const pdfAudit = approvePdfAudit
  ? JSON.parse(fs.readFileSync(path.join(root, "data", "pdf-vocabulary-additions.json"), "utf8"))
  : null;
const pdfAuditIds = new Set([
  ...Object.entries(pdfAudit?.courses ?? {}).flatMap(([courseId, course]) =>
    course.entries.map((entry) => `pdf-${courseId}-${String(entry.position).padStart(3, "0")}`),
  ),
  ...(pdfAudit?.corrections ?? []).map((entry) => entry.entryId),
]);

const previousManifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { entries: {} };
const nextManifest = { version: 1, updatedAt: new Date().toISOString(), levels: [], entries: { ...previousManifest.entries } };
const entriesById = new Map(data.entries.map((entry) => [entry.id, entry]));
let approved = 0;

function contentHash(sourceEntry, generated) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      word: sourceEntry.word,
      pos: sourceEntry.pos,
      zh: sourceEntry.zh,
      acceptedAnswers: sourceEntry.acceptedAnswers,
      exampleFr: generated.exampleFr,
      exampleZh: generated.exampleZh,
      usageNote: generated.usageNote,
    }))
    .digest("hex");
}

for (const course of data.courses) {
  if (!approveAll && !approvePdfAudit && !levels.has(course.level)) continue;
  const filePath = path.join(contentDir, `${course.id}.json`);
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const generated of payload.entries ?? []) {
    const sourceEntry = entriesById.get(generated.entryId);
    if (!sourceEntry || sourceEntry.contentStatus === "quarantined") continue;
    if (approvePdfAudit && !pdfAuditIds.has(generated.entryId)) continue;
    const hash = contentHash(sourceEntry, generated);
    const prior = previousManifest.entries?.[generated.entryId];
    const review = prior?.contentHash === hash
      ? prior
      : {
          status: "approved",
          reviewerType: "human",
          reviewedAt: new Date().toISOString(),
          note: approvePdfAudit ? pdfAudit.reviewNote : "用户确认 A1/A2 例句、翻译和用法均已人工审核",
          contentHash: hash,
        };
    generated.status = "approved";
    generated.risk = "low";
    generated.review = review;
    if (generated.source?.kind === "codex") {
      generated.source.label = approvePdfAudit ? "PDF 首页词汇表补录（Codex 校对）" : "Codex 生成（人工审核）";
    }
    nextManifest.entries[generated.entryId] = review;
    approved += 1;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

nextManifest.levels = [...new Set(Object.keys(nextManifest.entries).map((id) => entriesById.get(id)?.level).filter(Boolean))].sort();
nextManifest.approvedEntries = Object.keys(nextManifest.entries).length;
fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ approved, manifestEntries: nextManifest.approvedEntries, levels: nextManifest.levels }, null, 2));
