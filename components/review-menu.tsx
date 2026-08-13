"use client";

import Link from "next/link";
import { ArrowRight, AudioLines, Languages, Shuffle, SpellCheck2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { dueEntryIds } from "@/lib/local-store";

const options = [
  { mode: "zh_to_fr", icon: SpellCheck2, title: "中文 → 法语", copy: "根据中文释义拼写法语" },
  { mode: "fr_to_zh", icon: Languages, title: "法语 → 中文", copy: "看到法语，回忆中文后自评" },
  { mode: "audio_to_fr", icon: AudioLines, title: "听音拼写", copy: "只听发音，准确拼出单词" },
  { mode: "mixed", icon: Shuffle, title: "混合复习", copy: "三种题型轮换，覆盖薄弱方向" },
] as const;

export function ReviewMenu() {
  const { state } = useApp();
  const due = dueEntryIds(state).length;
  return (
    <section className="page-section">
      <h1 className="page-title">复习</h1>
      <p className="page-subtitle">今天有 {due} 个到期词汇。提前自由复习不会推迟原到期日。</p>
      <div className="review-grid">
        {options.map(({ mode, icon: Icon, title, copy }) => (
          <Link key={mode} className="review-option" href={`/review/session?scope=due&mode=${mode}`}>
            <span className="option-icon"><Icon size={23} /></span><div><strong>{title}</strong><p>{copy}</p></div><ArrowRight size={18} />
          </Link>
        ))}
      </div>
      {!due && <div className="panel" style={{ marginTop: 18 }}><strong>今日到期任务已完成</strong><p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 12 }}>你仍可从“课程”进入已学课程自由复习。</p></div>}
    </section>
  );
}
