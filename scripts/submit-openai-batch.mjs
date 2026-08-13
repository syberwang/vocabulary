import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { loadContentEnv } from "./load-content-env.mjs";

loadContentEnv();

const root = process.cwd();
const inputPath = path.join(root, "data", "openai-batch-input.jsonl");
const jobPath = path.join(root, "data", "openai-batch-job.json");

if (!process.env.OPENAI_API_KEY) {
  throw new Error("缺少 OPENAI_API_KEY。请复制 .env.content.example 为 .env.content.local 并在本机填写密钥；不要把密钥发到聊天中。");
}
if (!fs.existsSync(inputPath)) {
  throw new Error("未找到 Batch 输入文件，请先运行 npm run content:prepare。");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let record = fs.existsSync(jobPath) ? JSON.parse(fs.readFileSync(jobPath, "utf8")) : {};

if (record.batchId) {
  const existing = await client.batches.retrieve(record.batchId);
  console.log(`Batch 已存在：${existing.id}（状态：${existing.status}）`);
  process.exit(0);
}

if (!record.inputFileId) {
  const localBytes = fs.statSync(inputPath).size;
  const recentFiles = await client.files.list({ purpose: "batch", limit: 100, order: "desc" });
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  const recovered = recentFiles.data.find((file) =>
    file.filename === path.basename(inputPath) && file.bytes === localBytes && file.created_at >= oneHourAgo,
  );
  const inputFile = recovered ?? await client.files.create({
    file: fs.createReadStream(inputPath),
    purpose: "batch",
  });
  record = {
    ...record,
    inputFileId: inputFile.id,
    inputFileBytes: localBytes,
    uploadedAt: new Date(inputFile.created_at * 1000).toISOString(),
    recoveredUpload: Boolean(recovered),
    status: "input_uploaded",
  };
  fs.writeFileSync(jobPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

let batch;
try {
  batch = await client.batches.create({
    input_file_id: record.inputFileId,
    endpoint: "/v1/responses",
    completion_window: "24h",
    metadata: {
      project: "french-vocabulary-pwa",
      purpose: "a1-a2-example-generation",
    },
  });
} catch (error) {
  record = {
    ...record,
    status: "batch_create_failed",
    lastErrorCode: error?.code ?? "unknown",
    lastAttemptAt: new Date().toISOString(),
  };
  fs.writeFileSync(jobPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  throw error;
}

record = {
  ...record,
  batchId: batch.id,
  status: batch.status,
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(jobPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
console.log(`Batch 已提交：${batch.id}（状态：${batch.status}）`);
console.log(`任务信息：${path.relative(root, jobPath)}`);
