import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-french_cards_session" : "french_cards_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

function credentialVersion() {
  const passwordHash = process.env.APP_PASSWORD_HASH;
  if (!passwordHash) throw new Error("APP_PASSWORD_HASH is not configured");
  return createHash("sha256").update(passwordHash).digest("hex");
}

function sameVersion(value: unknown) {
  if (typeof value !== "string") return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(credentialVersion());
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSessionToken(username: string) {
  return new SignJWT({ username, credentialVersion: credentialVersion() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("owner")
    .setIssuer("french-cards")
    .setAudience("french-cards-browser")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionKey());
}

export async function verifySessionToken(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
      subject: "owner",
      issuer: "french-cards",
      audience: "french-cards-browser",
    });
    return typeof payload.username === "string" && sameVersion(payload.credentialVersion) ? { username: payload.username } : null;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireApiSession() {
  return Boolean(await getSession());
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
