import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqualText, verifyPassword } from "@/lib/auth/password";
import { consumeLoginAttempt, releaseSuccessfulLogin } from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const Login = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(500),
});

function json(body: object, status: number, retryAfterSeconds?: number) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (retryAfterSeconds) headers.set("Retry-After", String(retryAfterSeconds));
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: Request) {
  const parsed = Login.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "请输入账号和密码。" }, 400);
  const expectedUsername = process.env.APP_USERNAME;
  const passwordHash = process.env.APP_PASSWORD_HASH;
  if (!expectedUsername || !passwordHash || !process.env.SESSION_SECRET || !process.env.DATABASE_URL) {
    return json({ error: "服务器登录配置尚未完成。" }, 503);
  }

  try {
    const limit = await consumeLoginAttempt(request, expectedUsername);
    if (!limit.allowed) {
      return json({ error: "登录尝试过多，请稍后再试。" }, 429, limit.retryAfterSeconds);
    }

    const usernameMatches = safeEqualText(parsed.data.username, expectedUsername);
    const passwordMatches = await verifyPassword(parsed.data.password, passwordHash);
    if (!usernameMatches || !passwordMatches) {
      return json({ error: "账号或密码错误。" }, 401);
    }

    await releaseSuccessfulLogin(request, expectedUsername);
    const response = json({ success: true }, 200);
    response.cookies.set(SESSION_COOKIE, await createSessionToken(expectedUsername), sessionCookieOptions);
    return response;
  } catch {
    return json({ error: "登录服务暂时不可用，请稍后重试。" }, 503);
  }
}
