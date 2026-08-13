create table auth_login_limits (
  scope text not null check (scope in ('ip', 'account')),
  key_hash text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash)
);

create index auth_login_limits_updated_idx on auth_login_limits(updated_at);

comment on table auth_login_limits is
  '持久化登录限流状态。key_hash 为使用 SESSION_SECRET 生成的 HMAC，不保存原始 IP 或用户名。';
