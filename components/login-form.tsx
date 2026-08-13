"use client";

import { useState } from "react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    setLoading(false);
    if (!response.ok) return setMessage(payload?.error ?? "登录失败，请重试。");
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    window.location.href = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  }

  return (
    <form className="panel" style={{ width: "min(100%, 420px)" }} onSubmit={submit}>
      <label htmlFor="username" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>账号</label>
      <input id="username" className="answer-input" required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
      <label htmlFor="password" style={{ display: "block", margin: "14px 0 8px", fontWeight: 700 }}>密码</label>
      <input id="password" className="answer-input" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
      <button className="primary-button" style={{ width: "100%", marginTop: 16 }} disabled={loading}>{loading ? "登录中…" : "登录"}</button>
      {message && <p role="alert" style={{ margin: "12px 0 0", color: "var(--danger)", fontSize: 13, lineHeight: 1.6 }}>{message}</p>}
    </form>
  );
}
