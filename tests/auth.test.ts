import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { safeEqualText, verifyPassword } from "@/lib/auth/password";

describe("single-user password authentication", () => {
  it("verifies a scrypt password hash", async () => {
    const salt = "0123456789abcdef0123456789abcdef";
    const password = "une-phrase-secrete-2026";
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    const encoded = `scrypt:${salt}:${hash}`;
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", encoded)).resolves.toBe(false);
  });

  it("rejects malformed hashes and compares usernames safely", async () => {
    await expect(verifyPassword("anything", "invalid")).resolves.toBe(false);
    expect(safeEqualText("owner", "owner")).toBe(true);
    expect(safeEqualText("owner", "another-owner")).toBe(false);
  });
});
