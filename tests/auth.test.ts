// @vitest-environment node
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { safeEqualText, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

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

  it("invalidates existing sessions when the password hash changes", async () => {
    const previousSecret = process.env.SESSION_SECRET;
    const previousHash = process.env.APP_PASSWORD_HASH;
    try {
      process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
      process.env.APP_PASSWORD_HASH = "scrypt:first-password-version";
      const token = await createSessionToken("Helix");
      await expect(verifySessionToken(token)).resolves.toEqual({ username: "Helix" });
      process.env.APP_PASSWORD_HASH = "scrypt:second-password-version";
      await expect(verifySessionToken(token)).resolves.toBeNull();
    } finally {
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
      if (previousHash === undefined) delete process.env.APP_PASSWORD_HASH;
      else process.env.APP_PASSWORD_HASH = previousHash;
    }
  });
});
