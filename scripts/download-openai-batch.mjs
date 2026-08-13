import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { loadContentEnv } from "./load-content-env.mjs";

loadContentEnv();

const root = process.cwd();
const jobPath = path.join(root, "data", "openai-batch-job.json");
const outputPath = path.join(root, "data", "openai-batch-output.jsonl");

if (!process.env.OPENAI_API_KEY) {
  throw new Error("缺少 OPENAI_API_KEY。请在本机 .env.content.local 中填写，且不要部署该文件。");
}
if (!fs.existsSync(jobPath)) {
  throw new Error("未找到 Batch 任务信息，请先运行 npm run content:submit。");
}

const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const batch = await client.batches.retrieve(job.batchId);

if (batch.status !== "completed" || !batch.output_file_id) {
  console.log(`Batch ${batch.id} 当前状态：${batch.status}`);
  if (batch.errors?.data?.length) console.log(JSON.stringify(batch.errors.data, null, 2));
  process.exitCode = 2;
} else {
  const response = await client.files.content(batch.output_file_id);
  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  fs.writeFileSync(jobPath, `${JSON.stringify({ ...job, status: batch.status, outputFileId: batch.output_file_id, completedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
  console.log(`输出已下载：${path.relative(root, outputPath)}`);
  console.log("下一步运行 npm run content:merge；脚本会严格校验并把高风险项标记为 needs_review。 ");
}
