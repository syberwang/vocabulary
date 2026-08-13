import fs from "node:fs";
import path from "node:path";
import { loadContentEnv } from "./load-content-env.mjs";

loadContentEnv();

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "vocabulary.json"), "utf8"));
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    entry_id: { type: "string", minLength: 1, maxLength: 80 },
    example_fr: { type: "string", minLength: 4, maxLength: 240 },
    example_zh: { type: "string", minLength: 2, maxLength: 160 },
    usage_note: { type: "string", minLength: 2, maxLength: 160 },
    risk: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["entry_id", "example_fr", "example_zh", "usage_note", "risk"],
};

const requests = data.entries.filter((entry) => entry.contentStatus !== "quarantined").map((entry) => ({
  custom_id: entry.id,
  method: "POST",
  url: "/v1/responses",
  body: {
    model,
    input: [
      { role: "system", content: "你是严谨的法语教师。为中国 A1-A2 学习者生成自然、简短、无歧义的教学内容。不要改变给定词义；例句优先使用给定词形，必要变位时保持可识别。中文简洁准确。" },
      { role: "user", content: JSON.stringify({ entry_id: entry.id, level: entry.level, word: entry.word, part_of_speech: entry.pos, translation_zh: entry.zh, course: entry.courseCode }) },
    ],
    text: { format: { type: "json_schema", name: "vocabulary_content", strict: true, schema } },
  },
}));

fs.writeFileSync(path.join(root, "data", "openai-batch-input.jsonl"), requests.map(JSON.stringify).join("\n") + "\n", "utf8");
console.log(`Prepared ${requests.length} Batch API requests for ${model}. Upload this JSONL with purpose=batch, then create a /v1/responses batch.`);
