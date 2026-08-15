"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Headphones, Volume2 } from "lucide-react";
import { useSpeech } from "@/hooks/use-speech";
import { mapDbCourse, mapDbEntry } from "@/lib/content-mappers";
import { courseById, entriesForCourse } from "@/lib/vocabulary";

export function CourseBrowseSession({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { speak, speechError, speechState } = useSpeech();
  const [course, setCourse] = useState(courseById.get(courseId));
  const [allEntries, setAllEntries] = useState(entriesForCourse(courseId));
  const [loading, setLoading] = useState(!courseById.has(courseId));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/courses/${encodeURIComponent(courseId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("课程载入失败")))
      .then((payload: { course: Parameters<typeof mapDbCourse>[0]; entries: Parameters<typeof mapDbEntry>[0][] }) => {
        if (cancelled) return;
        const mappedCourse = mapDbCourse(payload.course);
        const mappedEntries = payload.entries.map((entry) => mapDbEntry(entry, mappedCourse));
        setCourse(mappedCourse);
        setAllEntries(mappedEntries);
        setIndex((current) => Math.min(current, Math.max(0, mappedEntries.length - 1)));
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setIndex((current) => Math.min(Math.max(0, allEntries.length - 1), current + 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allEntries.length]);

  if (loading) {
    return <section className="empty-state"><p>正在载入课程……</p></section>;
  }

  const entry = allEntries[index];
  if (!course || !entry) {
    return <section className="empty-state"><h1>课程没有可浏览的单词</h1><button className="primary-button" onClick={() => router.push("/courses")}>返回课程</button></section>;
  }

  const lastEntry = index >= allEntries.length - 1;

  return (
    <section className="session">
      <header className="session-header">
        <button className="icon-button" type="button" onClick={() => router.push("/courses")} aria-label="退出快速浏览"><ArrowLeft size={21} /></button>
        <div className="session-progress">
          <strong>{course.level} · {course.code} · 快速浏览</strong>
          <span>{index + 1} / {allEntries.length} · 不记录学习进度</span>
        </div>
        <span aria-hidden="true" />
      </header>
      <div className="session-body">
        <article className="word-card">
          <span className="card-label">单词卡片</span>
          <h1 className="french-word" lang="fr">{entry.word}</h1>
          <span className="part-of-speech">{entry.pos}</span>
          <p className="translation">{entry.zh}</p>
          <div className="example-box">
            <p className="example-fr" lang="fr">{entry.exampleFr}</p>
            <p className="example-zh">{entry.exampleZh}</p>
            <p className="usage-note">{entry.usageNote}</p>
          </div>
          <div className="audio-row">
            <button className="audio-button" type="button" onClick={() => speak(entry.id)} disabled={speechState === "loading"}><Volume2 size={16} /> 单词</button>
            <button className="audio-button" type="button" onClick={() => speak(entry.id, "example")} disabled={speechState === "loading"}><Headphones size={16} /> 例句</button>
          </div>
          {speechError && <p className="example-zh" role="status" style={{ marginTop: 10 }}>{speechError}</p>}
        </article>
      </div>
      <div className="session-actions">
        <div className="browse-actions">
          <button className="secondary-button" type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}><ChevronLeft size={18} /> 上一个</button>
          <button className="primary-button" type="button" onClick={() => lastEntry ? router.push("/courses") : setIndex((current) => current + 1)}>
            {lastEntry ? "完成浏览" : <>下一个 <ChevronRight size={18} /></>}
          </button>
        </div>
      </div>
    </section>
  );
}
