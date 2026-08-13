"use client";

import Link from "next/link";
import { BookmarkX, Dumbbell } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { hardEntryIds, isAutomaticallyHard } from "@/lib/local-store";
import { entryById } from "@/lib/vocabulary";

export function HardWords() {
  const { state, toggleHard } = useApp();
  const ids = hardEntryIds(state);
  const words = ids.map((id) => entryById.get(id)).filter(Boolean);
  return (
    <section className="page-section">
      <h1 className="page-title">强化记忆本</h1>
      <p className="page-subtitle">自动收录高错误率词汇，也可以在任意卡片上手动收藏。</p>
      {words.length ? (
        <>
          <Link className="primary-button" href="/review/session?scope=hard&mode=mixed" style={{ width: "100%", marginBottom: 18 }}><Dumbbell size={18} /> 开始强化练习（最多 10 词）</Link>
          <div className="course-list">
            {words.map((entry) => entry && (
              <article className="course-card" key={entry.id}>
                <span className="course-number" style={{ fontSize: 18 }}>fr</span>
                <span className="course-info"><strong lang="fr">{entry.word} <small>{entry.pos}</small></strong><span>{entry.zh}</span><span>{state.manualHardEntryIds.includes(entry.id) ? "手动标记" : isAutomaticallyHard(state, entry.id) ? "系统识别为易错" : "强化词汇"}</span></span>
                {state.manualHardEntryIds.includes(entry.id) && <button className="icon-button" onClick={() => toggleHard(entry.id)} aria-label={`取消 ${entry.word} 的强化标记`}><BookmarkX size={18} /></button>}
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state"><span className="empty-icon"><Dumbbell size={28} /></span><h1>强化本还是空的</h1><p>答错率较高的词会自动出现；也可以点击卡片右上角的书签手动加入。</p><Link className="primary-button" href="/review">去复习</Link></div>
      )}
    </section>
  );
}
