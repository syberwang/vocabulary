"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bookmark, BookmarkCheck, Volume2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useSpeech } from "@/hooks/use-speech";
import { gradeFrenchAnswer } from "@/lib/grading";
import { dueEntryIds, hardEntryIds } from "@/lib/local-store";
import type { RatingValue, ReviewMode } from "@/lib/types";
import { entries, entriesForCourse } from "@/lib/vocabulary";

const accents = ["é", "è", "ê", "ë", "à", "â", "ç", "ù", "û", "ô", "î", "ï", "œ", "æ"];
const modes: ReviewMode[] = ["zh_to_fr", "fr_to_zh", "audio_to_fr"];

export function ReviewSession() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, hydrated, submitAttempt, toggleHard, canRecordProgress } = useApp();
  const { speak, voices } = useSpeech();
  const scope = params.get("scope") ?? "due";
  const courseId = params.get("courseId") ?? undefined;
  const requestedMode = params.get("mode") ?? "mixed";
  const sourceQueue = useMemo(() => {
    if (scope === "course" && courseId) return entriesForCourse(courseId);
    const ids = scope === "hard" ? hardEntryIds(state).slice(0, 10) : dueEntryIds(state);
    const wanted = new Set(ids);
    return entries.filter((entry) => wanted.has(entry.id));
  }, [courseId, scope, state]);
  const [sessionIds, setSessionIds] = useState<string[] | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [suggested, setSuggested] = useState<RatingValue>("good");
  const inputRef = useRef<HTMLInputElement>(null);
  const hardSuccesses = useRef(new Map<string, number>());
  const hardPrimarySeen = useRef(new Set<string>());

  useEffect(() => {
    if (!hydrated || sessionIds !== null) return;
    const ids = sourceQueue.map((entry) => entry.id);
    setSessionIds(ids);
    setSessionTotal(ids.length);
  }, [hydrated, sessionIds, sourceQueue]);

  const entryId = scope === "hard" ? sessionIds?.[0] : sessionIds?.[index];
  const entry = entryId ? entries.find((candidate) => candidate.id === entryId) : undefined;
  const mixedModes = voices.length ? modes : modes.filter((candidate) => candidate !== "audio_to_fr");
  const mode: ReviewMode = requestedMode === "mixed" ? mixedModes[attemptNumber % mixedModes.length] : (requestedMode as ReviewMode);

  if (!hydrated || sessionIds === null) {
    return <section className="empty-state" style={{ minHeight: "100dvh" }}><p>正在准备复习…</p></section>;
  }

  if (!entry) {
    return (
      <section className="empty-state" style={{ minHeight: "100dvh" }}>
        <span className="empty-icon">✓</span><h1>这一组完成了</h1><p>今天的记忆又稳固了一点。可以继续其他复习，或回首页查看进度。</p>
        <button className="primary-button" onClick={() => router.push(scope === "hard" ? "/hard" : "/review")}>{scope === "hard" ? "返回强化本" : "返回复习"}</button>
      </section>
    );
  }

  const activeEntry = entry;
  const bookmarked = state.manualHardEntryIds.includes(entry.id);
  const spelling = mode !== "fr_to_zh";

  function reveal() {
    if (spelling) {
      const result = gradeFrenchAnswer(answer, activeEntry.acceptedAnswers);
      setSuggested(result.rating);
    }
    setRevealed(true);
  }

  function rate(rating: RatingValue) {
    const isHardSession = scope === "hard";
    const isPrimary = !isHardSession || !hardPrimarySeen.current.has(activeEntry.id);
    if (isHardSession) hardPrimarySeen.current.add(activeEntry.id);
    submitAttempt({
      entryId: activeEntry.id,
      courseId: activeEntry.courseId,
      rating,
      mode,
      answer: spelling ? answer : undefined,
      expected: activeEntry.word,
      isPrimary,
      scheduled: scope === "due" || (isHardSession && isPrimary),
    });
    if (isHardSession) {
      const previous = hardSuccesses.current.get(activeEntry.id) ?? 0;
      const consecutive = rating === "good" || rating === "easy" ? previous + 1 : 0;
      hardSuccesses.current.set(activeEntry.id, consecutive);
      setSessionIds((current) => {
        if (!current?.length) return current;
        return consecutive >= 2 ? current.slice(1) : [...current.slice(1), current[0]];
      });
    } else {
      setIndex((current) => current + 1);
    }
    setAttemptNumber((current) => current + 1);
    setAnswer("");
    setRevealed(false);
    setSuggested("good");
  }

  function insertAccent(character: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? answer.length;
    const end = input?.selectionEnd ?? answer.length;
    setAnswer(answer.slice(0, start) + character + answer.slice(end));
    requestAnimationFrame(() => input?.focus());
  }

  const prompt = mode === "zh_to_fr" ? entry.zh : mode === "fr_to_zh" ? entry.word : "点击播放，拼写你听到的法语";
  return (
    <section className="session">
      <header className="session-header">
        <button className="icon-button" onClick={() => router.push(scope === "hard" ? "/hard" : "/review")} aria-label="退出复习"><ArrowLeft size={21} /></button>
        <div className="session-progress"><strong>{scope === "hard" ? "强化记忆" : scope === "course" ? "课程复习" : "到期复习"}</strong><span>{scope === "hard" ? `已巩固 ${sessionTotal - sessionIds.length} / ${sessionTotal}` : `${index + 1} / ${sessionIds.length}`} · {mode === "zh_to_fr" ? "中 → 法" : mode === "fr_to_zh" ? "法 → 中" : "听音拼写"}</span></div>
        <button className="icon-button" onClick={() => toggleHard(entry.id)} aria-label={bookmarked ? "取消强化标记" : "加入强化本"}>{bookmarked ? <BookmarkCheck size={21} color="var(--coral)" /> : <Bookmark size={21} />}</button>
      </header>
      <div className="session-body">
        <article className="word-card">
          <span className="card-label">{mode === "zh_to_fr" ? "看中文，拼法语" : mode === "fr_to_zh" ? "看法语，想中文" : "听发音，拼法语"}</span>
          {mode === "audio_to_fr" && !revealed ? (
            <>
              <button className="audio-button" style={{ alignSelf: "center", width: 88, height: 88, borderRadius: 28, justifyContent: "center" }} onClick={() => speak(entry.word)} disabled={!voices.length} aria-label="播放法语单词"><Volume2 size={34} /></button>
              {!voices.length && <p className="example-zh" style={{ marginTop: 16 }}>设备未发现法语音色，请在系统语言或辅助功能中安装法语语音。</p>}
            </>
          ) : (
            <h1 className={mode === "fr_to_zh" ? "french-word" : "translation"} lang={mode === "fr_to_zh" ? "fr" : undefined}>{prompt}</h1>
          )}
          {spelling && (
            <div style={{ width: "100%", marginTop: 28 }}>
              <input ref={inputRef} className="answer-input" value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !revealed && answer.trim() && reveal()} placeholder="输入法语…" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={revealed || (mode === "audio_to_fr" && !voices.length)} aria-label="法语答案" />
              <div className="accent-bar" aria-label="法语特殊字符">{accents.map((accent) => <button key={accent} onClick={() => insertAccent(accent)} disabled={revealed || (mode === "audio_to_fr" && !voices.length)}>{accent}</button>)}</div>
            </div>
          )}
          {revealed && (
            <div className={`feedback ${spelling ? suggested : "good"}`} style={{ width: "100%" }}>
              <strong lang="fr">{entry.word} <small>{entry.pos}</small></strong>
              <p>{entry.zh}</p>
              <p lang="fr" style={{ marginTop: 9, fontFamily: "Georgia, serif", fontStyle: "italic" }}>{entry.exampleFr}</p>
              <p style={{ marginTop: 3 }}>{entry.exampleZh}</p>
            </div>
          )}
        </article>
      </div>
      <div className="session-actions">
        {!revealed ? <button className="primary-button" onClick={reveal} disabled={spelling && !answer.trim()}>揭晓答案</button> : (
          <div className="rating-grid">
            <button className="rating-button rating-again" onClick={() => rate("again")} disabled={!canRecordProgress}>重来<small>Again</small></button>
            <button className="rating-button rating-hard" onClick={() => rate("hard")} disabled={!canRecordProgress}>困难<small>Hard</small></button>
            <button className="rating-button rating-good" onClick={() => rate("good")} disabled={!canRecordProgress}>记得<small>Good</small></button>
            <button className="rating-button rating-easy" onClick={() => rate("easy")} disabled={!canRecordProgress}>简单<small>Easy</small></button>
          </div>
        )}
      </div>
    </section>
  );
}
