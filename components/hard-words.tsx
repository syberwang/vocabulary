"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookmarkX, Dumbbell } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { mapDbEntry } from "@/lib/content-mappers";
import { hardEntryIds, isAutomaticallyHard } from "@/lib/local-store";
import { entries, entryById } from "@/lib/vocabulary";
import type { VocabularyEntry } from "@/lib/types";

export function HardWords() {
  const { state, toggleHard } = useApp();
  const [remoteEntries, setRemoteEntries] = useState<VocabularyEntry[]>([]);
  const ids = hardEntryIds(state);
  useEffect(() => {
    fetch("/api/reviews/queue?scope=hard&limit=200", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("hard words load failed")))
      .then((rows: Parameters<typeof mapDbEntry>[0][]) => setRemoteEntries(rows.map((row) => mapDbEntry(row))))
      .catch(() => undefined);
  }, [ids.length]);
  const entryMap = new Map([...entries, ...remoteEntries].map((entry) => [entry.id, entry]));
  const words = ids.map((id) => entryMap.get(id) ?? entryById.get(id)).filter(Boolean);
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
