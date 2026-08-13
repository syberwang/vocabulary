"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarClock, Flame, Play, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import {
  currentLearningCourse,
  dueEntryIds,
  getCourseProgress,
  hardEntryIds,
  localDate,
  streakCount,
} from "@/lib/local-store";
import { courseById, courses, nextCourse } from "@/lib/vocabulary";

export function Dashboard() {
  const { state, hydrated } = useApp();
  const today = localDate(state.timezone);
  const assignment = state.dailyAssignments[today];
  const learningId = assignment?.courseId ?? currentLearningCourse(state);
  const learnedIds = new Set(
    Object.entries(state.courseProgress)
      .filter(([, progress]) => progress.status === "learned")
      .map(([id]) => id),
  );
  const recommended = nextCourse(state.selectedLevel, learnedIds);
  const activeCourse = learningId ? courseById.get(learningId) : recommended;
  const progress = activeCourse ? getCourseProgress(state, activeCourse.id) : undefined;
  const due = dueEntryIds(state).length;
  const hard = hardEntryIds(state).length;
  const learnedCourses = learnedIds.size;

  if (!hydrated) return <div className="panel">正在载入学习进度…</div>;

  return (
    <section className="page-section">
      <p className="eyebrow" style={{ color: "var(--green)", opacity: 1 }}><Sparkles size={14} /> Bonjour</p>
      <h1 className="page-title">今天，学好一整课。</h1>
      <p className="page-subtitle">新词按课程推进；到期复习与强化训练可以随时进行。</p>

      <article className="hero-card">
        <span className="eyebrow"><BookOpenCheck size={14} /> {assignment ? "今日课程" : "下一课"}</span>
        {activeCourse ? (
          <>
            <h2>{activeCourse.level} · {activeCourse.code}</h2>
            <p>{activeCourse.title} · 共 {activeCourse.wordCount} 个词</p>
            {progress && progress.masteredEntryIds.length > 0 && (
              <div className="progress-track" style={{ background: "rgba(255,255,255,.18)", marginTop: 16 }}>
                <div className="progress-bar" style={{ width: `${Math.round(progress.masteredEntryIds.length / activeCourse.wordCount * 100)}%`, background: "white" }} />
              </div>
            )}
            <div className="hero-actions">
              <Link className="primary-button" href={`/learn/${activeCourse.id}`}>
                <Play size={17} fill="currentColor" /> {progress?.masteredEntryIds.length ? "继续学习" : "开始今日课程"}
              </Link>
            </div>
          </>
        ) : (
          <><h2>全部课程已学习</h2><p>继续使用每日复习巩固记忆。</p></>
        )}
      </article>

      <div className="stats-grid">
        <Link href="/review" className="stat-card"><strong>{due}</strong><span>今日到期</span></Link>
        <Link href="/hard" className="stat-card"><strong>{hard}</strong><span>强化词汇</span></Link>
        <div className="stat-card"><strong>{streakCount(state)}</strong><span>连续天数</span></div>
      </div>

      <div className="section-heading"><h2>学习概览</h2><Link href="/courses">全部课程 <ArrowRight size={12} style={{ display: "inline" }} /></Link></div>
      <div className="panel">
        <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 13, alignItems: "center" }}>
          <span className="option-icon"><CalendarClock size={21} /></span>
          <div><strong style={{ fontSize: 14 }}>已学习 {learnedCourses} / {courses.length} 课</strong><p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11 }}>坚持一天一课，完成 A1-A2 全部词汇。</p></div>
        </div>
        <div className="progress-track" style={{ marginTop: 16 }}><div className="progress-bar" style={{ width: `${learnedCourses / courses.length * 100}%` }} /></div>
      </div>

      <div className="section-heading"><h2>快速复习</h2></div>
      <div className="review-grid">
        <Link className="review-option" href="/review/session?scope=due&mode=mixed">
          <span className="option-icon"><Flame size={22} /></span><div><strong>到期复习</strong><p>{due ? `有 ${due} 个词等待复习` : "今天的到期任务已完成"}</p></div><ArrowRight size={18} />
        </Link>
        <Link className="review-option" href="/hard">
          <span className="option-icon"><Sparkles size={22} /></span><div><strong>强化记忆</strong><p>集中练习易错和手动收藏</p></div><ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
