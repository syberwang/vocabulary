"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const client = createSupabaseBrowserClient();
    if (!client) return setMessage("尚未配置 Supabase。请先填写环境变量。");
    setLoading(true);
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    setMessage(error ? "该邮箱尚未受邀，或登录邮件发送失败。" : "登录链接已发送，请检查邮箱。");
  }

  return (
    <form className="panel" style={{ width: "min(100%, 420px)" }} onSubmit={submit}>
      <label htmlFor="email" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>受邀邮箱</label>
      <input id="email" className="answer-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" />
      <button className="primary-button" style={{ width: "100%", marginTop: 12 }} disabled={loading}>{loading ? "发送中…" : "发送登录链接"}</button>
      {message && <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>{message}</p>}
    </form>
  );
}
