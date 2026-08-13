import fs from "node:fs";
import path from "node:path";

export function loadContentEnv() {
  const envPath = path.join(process.cwd(), ".env.content.local");
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
}
