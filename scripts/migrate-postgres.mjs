import crypto from "node:crypto";
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
const migrationsDirectory = path.join(process.cwd(), "postgres", "migrations");
const files = fs.readdirSync(migrationsDirectory).filter((file) => file.endsWith(".sql")).sort();

try {
  await pool.query(`create table if not exists schema_migrations (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`);
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(migrationsDirectory, filename), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    const existing = await pool.query("select checksum from schema_migrations where filename = $1", [filename]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${filename}`);
      console.log(`skip ${filename}`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (filename, checksum) values ($1, $2)", [filename, checksum]);
      await client.query("commit");
      console.log(`applied ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
