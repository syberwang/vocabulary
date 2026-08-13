import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqualText, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const Login = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(500),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

export async function POST(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  if (attempts.size > 10_000) {
    for (const [attemptKey, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(attemptKey);
    }
    if (attempts.size > 10_000) attempts.clear();
  }
  const previous = attempts.get(key);
  const record = !previous || previous.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : previous;
  if (record.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "登录尝试过多，请稍后再试。" }, { status: 429 });
  }

  const parsed = Login.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请输入账号和密码。" }, { status: 400 });
  const expectedUsername = process.env.APP_USERNAME;
  const passwordHash = process.env.APP_PASSWORD_HASH;
  if (!expectedUsername || !passwordHash || !process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "服务器登录配置尚未完成。" }, { status: 503 });
  }

  const usernameMatches = safeEqualText(parsed.data.username, expectedUsername);
  const passwordMatches = await verifyPassword(parsed.data.password, passwordHash);
  if (!usernameMatches || !passwordMatches) {
    record.count += 1;
    attempts.set(key, record);
    return NextResponse.json({ error: "账号或密码错误。" }, { status: 401 });
  }

  attempts.delete(key);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(expectedUsername), sessionCookieOptions);
  return response;
}
