"use client";

import { useEffect, useState } from "react";
import { Save, Search, Send } from "lucide-react";

type AdminEntry = Record<string, unknown> & { id: string; word: string; part_of_speech: string; translation_zh: string; example_fr: string; example_zh: string; usage_note: string; accepted_answers: string[]; content_status: "draft" | "approved" | "needs_review" | "quarantined"; raw_values: { word?: string; pos?: string; zh?: string }; source_page: number };

export function AdminContent() {
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [selected, setSelected] = useState<AdminEntry | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("needs_review");
  const [message, setMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  async function load() {
    const response = await fetch(`/api/admin/entries?status=${status}&q=${encodeURIComponent(query)}`);
    if (!response.ok) return setMessage(response.status === 403 ? "当前账号没有管理员权限。" : "内容载入失败。");
    const rows = await response.json() as AdminEntry[];
    setEntries(rows); setSelected(rows[0] ?? null); setMessage("");
  }
  useEffect(() => { load(); }, [status]);

  async function save() {
    if (!selected) return;
    const response = await fetch("/api/admin/entries", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...selected, note: "管理员后台校订" }) });
    setMessage(response.ok ? "已保存修订并写入历史。" : "保存失败，请检查必填字段。");
    if (response.ok) setSelected(await response.json());
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail }) });
    setMessage(response.ok ? "邀请邮件已发送。" : "邀请发送失败。");
    if (response.ok) setInviteEmail("");
  }

  function update(field: keyof AdminEntry, value: unknown) { setSelected((current) => current ? { ...current, [field]: value } : current); }

  return (
    <section className="page-section">
      <h1 className="page-title">内容后台</h1><p className="page-subtitle">校订词条、审批例句并查看原始来源。每次保存都会留下修订记录。</p>
      <form className="panel" onSubmit={invite} style={{ display: "flex", gap: 8, marginBottom: 12 }}><input className="answer-input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="邀请邮箱" required /><button className="primary-button"><Send size={16} /> 邀请</button></form>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}><input className="answer-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索法语或中文" /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="needs_review">待审核</option><option value="draft">草稿</option><option value="approved">已批准</option><option value="quarantined">已隔离</option><option value="all">全部</option></select><button className="icon-button" onClick={load} aria-label="搜索"><Search size={18} /></button></div>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <div className="panel" style={{ maxHeight: 300, overflow: "auto" }}>{entries.map((entry) => <button key={entry.id} onClick={() => setSelected(entry)} style={{ display: "block", width: "100%", minHeight: 44, border: 0, borderBottom: "1px solid var(--line)", background: selected?.id === entry.id ? "var(--green-soft)" : "transparent", textAlign: "left", padding: "8px 10px", cursor: "pointer" }}><b lang="fr">{entry.word}</b> · {entry.translation_zh}</button>)}</div>
        {selected && <div className="panel settings-list">
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>原文：{selected.raw_values?.word ?? "空"} / {selected.raw_values?.pos ?? "空"} / {selected.raw_values?.zh ?? "空"} · PDF 第 {selected.source_page} 页</p>
          {([['word','法语'],['part_of_speech','词性'],['translation_zh','中文释义'],['example_fr','法语例句'],['example_zh','例句翻译'],['usage_note','用法提示']] as const).map(([field,label]) => <label key={field}><span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>{label}</span><textarea className="answer-input" style={{ padding: 12, minHeight: field.includes("example") || field === "usage_note" ? 74 : 50, textAlign: "left" }} value={String(selected[field])} onChange={(e) => update(field, e.target.value)} /></label>)}
          <label><span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>可接受答案（每行一个）</span><textarea className="answer-input" style={{ padding: 12, minHeight: 80, textAlign: "left" }} value={selected.accepted_answers.join("\n")} onChange={(e) => update("accepted_answers", e.target.value.split(/\r?\n/).filter(Boolean))} /></label>
          <select className="answer-input" value={selected.content_status} onChange={(e) => update("content_status", e.target.value)}><option value="needs_review">待审核</option><option value="draft">草稿</option><option value="approved">已批准</option><option value="quarantined">隔离</option></select>
          <button className="primary-button" onClick={save}><Save size={17} /> 保存修订</button>
        </div>}
      </div>
      {message && <p className="feedback good">{message}</p>}
    </section>
  );
}
