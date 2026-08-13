import { afterEach, describe, expect, it } from "vitest";
import { clientAddress, loginLimitIdentities, LOGIN_RATE_LIMIT_POLICIES } from "@/lib/auth/rate-limit";

const previousSecret = process.env.SESSION_SECRET;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previousSecret;
});

describe("login rate-limit identities", () => {
  it("prefers the reverse proxy's real client address", () => {
    const request = new Request("https://example.test/api/auth/login", {
      headers: { "x-real-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.4" },
    });
    expect(clientAddress(request)).toBe("203.0.113.8");
  });

  it("stores only HMAC identities for both IP and account scopes", () => {
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
    const request = new Request("https://example.test/api/auth/login", { headers: { "x-real-ip": "203.0.113.8" } });
    const identities = loginLimitIdentities(request, "Helix");
    expect(identities.map((identity) => identity.scope).sort()).toEqual(["account", "ip"]);
    expect(identities.every((identity) => /^[a-f0-9]{64}$/.test(identity.keyHash))).toBe(true);
    expect(JSON.stringify(identities)).not.toContain("203.0.113.8");
    expect(JSON.stringify(identities)).not.toContain("Helix");
  });

  it("uses separate IP and account thresholds", () => {
    expect(LOGIN_RATE_LIMIT_POLICIES).toEqual([
      { scope: "ip", maximumAttempts: 5, windowSeconds: 900, lockSeconds: 900 },
      { scope: "account", maximumAttempts: 12, windowSeconds: 1800, lockSeconds: 1800 },
    ]);
  });
});
