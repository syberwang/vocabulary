import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const root = process.cwd();
const outputPath = path.join(root, "data", "openai-batch-output.jsonl");
if (!fs.existsSync(outputPath)) throw new Error("Place the downloaded Batch API output at data/openai-batch-output.jsonl.");
const dataPath = path.join(root, "data", "vocabulary.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const Content = z.object({ entry_id: z.string(), example_fr: z.string().min(4).max(240), example_zh: z.string().min(2).max(160), usage_note: z.string().min(2).max(160), risk: z.enum(["low", "medium", "high"]) });
const byId = new Map(data.entries.map((entry) => [entry.id, entry]));
const warnings = [];
const seenExamples = new Map();
let merged = 0;

for (const line of fs.readFileSync(outputPath, "utf8").split(/\r?\n/).filter(Boolean)) {
  const row = JSON.parse(line);
  if (row.error || row.response?.status_code !== 200) { warnings.push(`${row.custom_id}: request failed`); continue; }
  const body = row.response.body;
  const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) { warnings.push(`${row.custom_id}: missing output text`); continue; }
  const parsed = Content.safeParse(JSON.parse(text));
  if (!parsed.success || parsed.data.entry_id !== row.custom_id) { warnings.push(`${row.custom_id}: schema/id mismatch`); continue; }
  const entry = byId.get(row.custom_id);
  if (!entry) { warnings.push(`${row.custom_id}: unknown entry`); continue; }
  const content = parsed.data;
  const normalizedExample = content.example_fr.normalize("NFKC").toLocaleLowerCase("fr-FR").replaceAll(/\s+/g, " ").trim();
  const target = entry.word.split(/[ (/[{]/)[0].normalize("NFKC").toLocaleLowerCase("fr-FR");
  if (!normalizedExample.includes(target)) warnings.push(`${row.custom_id}: target form not found; manual review required`);
  const duplicateOf = seenExamples.get(normalizedExample);
  if (duplicateOf) warnings.push(`${row.custom_id}: duplicate example also used by ${duplicateOf}`);
  else seenExamples.set(normalizedExample, row.custom_id);
  Object.assign(entry, { exampleFr: content.example_fr, exampleZh: content.example_zh, usageNote: content.usage_note, contentStatus: content.risk === "low" ? "draft" : "needs_review", contentVersion: entry.contentVersion + 1 });
  merged += 1;
}

data.metadata.generatedAt = new Date().toISOString();
data.metadata.aiMerged = merged;
data.metadata.aiWarnings = warnings.length;
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf8");
fs.writeFileSync(path.join(root, "data", "openai-review-warnings.txt"), warnings.join("\n"), "utf8");
console.log(`Merged ${merged} outputs; ${warnings.length} warnings require review. No AI item is auto-approved.`);
