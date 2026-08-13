import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("production data and cache boundaries", () => {
  it("ships a single-user PostgreSQL schema without Supabase auth tables", () => {
    const migration = fs.readFileSync(path.join(root, "postgres/migrations/0001_initial.sql"), "utf8");
    expect(migration).toContain("create table app_settings");
    expect(migration).not.toContain("auth.users");
    expect(migration).not.toContain("user_id");
    expect(migration).not.toContain("row level security");
  });

  it("ships atomic learning RPCs", () => {
    const migration = fs.readFileSync(path.join(root, "postgres/migrations/0002_atomic_learning_operations.sql"), "utf8");
    expect(migration).toContain("assign_daily_course_transaction");
    expect(migration).toContain("submit_review_attempt_transaction");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("p_expected_reps");
    expect(migration).toContain("p_expected_last_review");
  });

  it("uses a signed HttpOnly single-user session", () => {
    const session = fs.readFileSync(path.join(root, "lib/auth/session.ts"), "utf8");
    const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
    expect(session).toContain("httpOnly: true");
    expect(session).toContain("sameSite: \"lax\"");
    expect(packageJson).not.toContain("@supabase/");
  });

  it("does not precache authenticated application pages", () => {
    const worker = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
    expect(worker).not.toMatch(/APP_SHELL/);
    expect(worker).not.toMatch(/PRECACHE\s*=\s*\[[^\]]*"\/courses"/s);
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain('url.pathname.startsWith("/auth/")');
  });
});
