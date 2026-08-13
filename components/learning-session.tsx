"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, BookmarkCheck, Headphones, Volume2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useSpeech } from "@/hooks/use-speech";
import { gradeFrenchAnswer } from "@/lib/grading";
import { currentLearningCourse, getCourseProgress, localDate } from "@/lib/local-store";
import type { RatingValue, VocabularyEntry } from "@/lib/types";
import { courseById, entriesForCourse } from "@/lib/vocabulary";

const accents = ["é", "è", "ê", "ë", "à", "â", "ç", "ù", "û", "ô", "î", "ï", "œ", "æ"];

export function LearningSession({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { state, assignCourse, submitAttempt, toggleHard, canRecordProgress } = useApp();
  const { speak, hasFrenchVoice } = useSpeech();
  const course = courseById.get(courseId);
  const allEntries = useMemo(() => entriesForCourse(courseId), [courseId]);
  const progress = getCourseProgress(state, courseId);
  const firstIncomplete = allEntries.findIndex((entry) => !progress.masteredEntryIds.includes(entry.id));
  const [index, setIndex] = useState(Math.max(0, firstIncomplete));
  const [phase, setPhase] = useState<"study" | "recall" | "feedback">("study");
  const [answer, setAnswer] = useState("");
  const [suggested, setSuggested] = useState<RatingValue>("good");
  const inputRef = useRef<HTMLInputElement>(null);
  const entry = allEntries[index];
  const today = localDate(state.timezone);
  const assigned = state.dailyAssignments[today]?.courseId ?? currentLearningCourse(state);

  useEffect(() => {
    if (!course) return;
    if (assigned && assigned !== courseId) {
      router.replace(`/learn/${assigned}`);
      return;
    }
    if (!assigned) assignCourse(courseId);
  }, [assigned, assignCourse, course, courseId, router]);

  useEffect(() => {
    if (phase === "recall") inputRef.current?.focus();
  }, [phase]);

  if (!course || !entry) {
    return <section className="empty-state"><h1>课程不存在</h1><button className="primary-button" onClick={() => router.push("/courses")}>返回课程</button></section>;
  }

  const bookmarked = state.manualHardEntryIds.includes(entry.id);
  const mastered = progress.masteredEntryIds.includes(entry.id);

  function beginRecall() {
    setAnswer("");
    setPhase("recall");
  }

  function checkAnswer() {
    const result = gradeFrenchAnswer(answer, entry.acceptedAnswers);
    setSuggested(result.rating);
    setPhase("feedback");
  }

  function rate(rating: RatingValue) {
    submitAttempt({
      entryId: entry.id,
      courseId,
      rating,
      mode: "zh_to_fr",
      answer,
      expected: entry.word,
      scheduled: true,
    });
    if (index >= allEntries.length - 1) {
      router.push("/courses?completed=1");
      return;
    }
    setIndex((current) => current + 1);
    setPhase("study");
    setAnswer("");
  }

  function insertAccent(character: string) {
    const input = inputRef.current;
    if (!input) return setAnswer((value) => value + character);
    const start = input.selectionStart ?? answer.length;
    const end = input.selectionEnd ?? answer.length;
    setAnswer(answer.slice(0, start) + character + answer.slice(end));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + 1, start + 1);
    });
  }

  return (
    <section className="session">
      <header className="session-header">
        <button className="icon-button" onClick={() => router.push("/courses")} aria-label="退出课程"><ArrowLeft size={21} /></button>
        <div className="session-progress"><strong>{course.level} · {course.code}</strong><span>{index + 1} / {allEntries.length} · 已掌握 {progress.masteredEntryIds.length}</span></div>
        <button className="icon-button" onClick={() => toggleHard(entry.id)} aria-label={bookmarked ? "取消强化标记" : "加入强化本"}>
          {bookmarked ? <BookmarkCheck size={21} color="var(--coral)" /> : <Bookmark size={21} />}
        </button>
      </header>
      <div className="session-body">
        <article className="word-card">
          {phase === "study" ? (
            <>
              <span className="card-label">学习新词 {mastered ? "· 已掌握" : ""}</span>
              <h1 className="french-word" lang="fr">{entry.word}</h1>
              <span className="part-of-speech">{entry.pos}</span>
              <p className="translation">{entry.zh}</p>
              <div className="example-box">
                <p className="example-fr" lang="fr">{entry.exampleFr}</p>
                <p className="example-zh">{entry.exampleZh}</p>
                <p className="usage-note">{entry.usageNote}</p>
              </div>
              <div className="audio-row">
                <button className="audio-button" onClick={() => speak(entry.word)} disabled={!hasFrenchVoice}><Volume2 size={16} /> 单词</button>
                <button className="audio-button" onClick={() => speak(entry.exampleFr)} disabled={!hasFrenchVoice}><Headphones size={16} /> 例句</button>
              </div>
              {!hasFrenchVoice && <p className="example-zh" style={{ marginTop: 10 }}>未发现法语音色，已停用发音以避免误用英语语音。请在系统语言或辅助功能中安装法语语音。</p>}
            </>
          ) : (
            <>
              <span className="card-label">看中文，拼出法语</span>
              <p className="translation" style={{ fontSize: "clamp(22px,7vw,34px)" }}>{entry.zh}</p>
              <div style={{ width: "100%", marginTop: 28 }}>
                <input ref={inputRef} className="answer-input" value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => event.key === "Enter" && phase === "recall" && checkAnswer()} placeholder="输入法语…" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={phase === "feedback"} aria-label="法语答案" />
                <div className="accent-bar" aria-label="法语特殊字符">{accents.map((accent) => <button key={accent} type="button" onClick={() => insertAccent(accent)}>{accent}</button>)}</div>
              </div>
              {phase === "feedback" && (
                <div className={`feedback ${suggested}`}>
                  <strong>{suggested === "good" ? "拼写正确" : suggested === "hard" ? "很接近，注意拼写" : "再记一次"}</strong>
                  <p>正确答案：<b lang="fr">{entry.word}</b></p>
                </div>
              )}
            </>
          )}
        </article>
      </div>
      <div className="session-actions">
        {phase === "study" && <button className="primary-button" onClick={beginRecall}>隐藏答案，开始回忆</button>}
        {phase === "recall" && <button className="primary-button" onClick={checkAnswer} disabled={!answer.trim()}>检查答案</button>}
        {phase === "feedback" && (
          <div className="rating-grid" aria-label="评价记忆程度">
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
