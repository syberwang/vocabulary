import { createHmac } from "node:crypto";
import { withTransaction } from "@/lib/db";

export interface LoginRateLimitPolicy {
  scope: "ip" | "account";
  maximumAttempts: number;
  windowSeconds: number;
  lockSeconds: number;
}

export const LOGIN_RATE_LIMIT_POLICIES: LoginRateLimitPolicy[] = [
  { scope: "ip", maximumAttempts: 5, windowSeconds: 15 * 60, lockSeconds: 15 * 60 },
  { scope: "account", maximumAttempts: 12, windowSeconds: 30 * 60, lockSeconds: 30 * 60 },
];

interface LimitIdentity extends LoginRateLimitPolicy {
  keyHash: string;
}

interface LimitRow {
  scope: "ip" | "account";
  key_hash: string;
  attempt_count: number;
  window_started_at: Date;
  locked_until: Date | null;
}

function securityKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return secret;
}

function hashIdentity(scope: "ip" | "account", value: string) {
  return createHmac("sha256", securityKey()).update(`${scope}:${value}`).digest("hex");
}

export function clientAddress(request: Request) {
  return request.headers.get("x-real-ip")?.trim().slice(0, 128)
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 128)
    ?? "direct-connection";
}

export function loginLimitIdentities(request: Request, configuredUsername: string): LimitIdentity[] {
  const ip = clientAddress(request);
  return LOGIN_RATE_LIMIT_POLICIES.map((policy) => ({
    ...policy,
    keyHash: hashIdentity(policy.scope, policy.scope === "ip" ? ip : configuredUsername),
  })).sort((left, right) => `${left.scope}:${left.keyHash}`.localeCompare(`${right.scope}:${right.keyHash}`));
}

export async function consumeLoginAttempt(request: Request, configuredUsername: string) {
  const identities = loginLimitIdentities(request, configuredUsername);
  return withTransaction(async (client) => {
    for (const identity of identities) {
      await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`${identity.scope}:${identity.keyHash}`]);
    }

    const existing = await client.query<LimitRow>(
      "select scope, key_hash, attempt_count, window_started_at, locked_until from auth_login_limits where (scope, key_hash) in (($1, $2), ($3, $4))",
      [identities[0].scope, identities[0].keyHash, identities[1].scope, identities[1].keyHash],
    );
    const now = new Date();
    const activeLock = existing.rows
      .filter((row) => row.locked_until && row.locked_until.getTime() > now.getTime())
      .sort((left, right) => right.locked_until!.getTime() - left.locked_until!.getTime())[0];
    if (activeLock?.locked_until) {
      return { allowed: false as const, retryAfterSeconds: Math.max(1, Math.ceil((activeLock.locked_until.getTime() - now.getTime()) / 1000)) };
    }

    for (const identity of identities) {
      await client.query(
        `insert into auth_login_limits (scope, key_hash, attempt_count, window_started_at, locked_until, updated_at)
         values ($1, $2, 1, now(), null, now())
         on conflict (scope, key_hash) do update set
           attempt_count = case
             when auth_login_limits.window_started_at <= now() - ($3::integer * interval '1 second') then 1
             else auth_login_limits.attempt_count + 1
           end,
           window_started_at = case
             when auth_login_limits.window_started_at <= now() - ($3::integer * interval '1 second') then now()
             else auth_login_limits.window_started_at
           end,
           locked_until = case
             when auth_login_limits.window_started_at <= now() - ($3::integer * interval '1 second') then null
             when auth_login_limits.attempt_count + 1 >= $4::integer then now() + ($5::integer * interval '1 second')
             else null
           end,
           updated_at = now()`,
        [identity.scope, identity.keyHash, identity.windowSeconds, identity.maximumAttempts, identity.lockSeconds],
      );
    }
    await client.query("delete from auth_login_limits where updated_at < now() - interval '30 days'");
    return { allowed: true as const, retryAfterSeconds: 0 };
  });
}

export async function releaseSuccessfulLogin(request: Request, configuredUsername: string) {
  const identities = loginLimitIdentities(request, configuredUsername);
  await withTransaction(async (client) => {
    for (const identity of identities) {
      await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`${identity.scope}:${identity.keyHash}`]);
      await client.query(
        `update auth_login_limits set
           attempt_count = greatest(attempt_count - 1, 0),
           locked_until = case when greatest(attempt_count - 1, 0) < $3::integer then null else locked_until end,
           updated_at = now()
         where scope = $1 and key_hash = $2`,
        [identity.scope, identity.keyHash, identity.maximumAttempts],
      );
      await client.query("delete from auth_login_limits where scope = $1 and key_hash = $2 and attempt_count = 0", [identity.scope, identity.keyHash]);
    }
  });
}
