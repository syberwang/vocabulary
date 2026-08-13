import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined,
});
try {
  await pool.query(fs.readFileSync(path.join(process.cwd(), "postgres", "seed.sql"), "utf8"));
  const result = await pool.query("select (select count(*) from courses) as courses, (select count(*) from vocabulary_entries) as entries");
  console.log(`seeded ${result.rows[0].courses} courses and ${result.rows[0].entries} entries`);
} finally {
  await pool.end();
}
