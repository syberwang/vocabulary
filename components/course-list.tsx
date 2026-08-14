"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronRight, LockKeyhole } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { getCourseProgress, localDate } from "@/lib/local-store";
import { mapDbCourse } from "@/lib/content-mappers";
import { courses } from "@/lib/vocabulary";
import type { Course } from "@/lib/types";

export function CourseList() {
  const { state, setLevel } = useApp();
  const [catalog, setCatalog] = useState<Course[]>(courses);
  const todayAssignment = state.dailyAssignments[localDate(state.timezone)];
  useEffect(() => {
    fetch("/api/courses", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("课程目录载入失败")))
      .then((rows: unknown[]) => setCatalog(rows.map((row) => mapDbCourse(row as Parameters<typeof mapDbCourse>[0]))))
      .catch(() => undefined);
  }, []);
  const levels = [...new Set(catalog.map((course) => course.level))];
  const visible = catalog.filter((course) => course.level === state.selectedLevel);

  return (
    <section className="page-section">
      <h1 className="page-title">课程</h1>
      <p className="page-subtitle">每个级别 9 个单元、36 课。每天只开启一门新课。</p>
      <div className="level-switch" role="group" aria-label="选择法语级别">
        {levels.map((level) => (
          <button key={level} className={state.selectedLevel === level ? "active" : ""} onClick={() => setLevel(level)}>{catalog.find((course) => course.level === level)?.levelTitle ?? `${level} 基础`}</button>
        ))}
      </div>
      <div className="course-list">
        {visible.map((course) => {
          const progress = getCourseProgress(state, course.id);
          const percent = Math.round(progress.masteredEntryIds.length / course.wordCount * 100);
          const lockedToday = Boolean(todayAssignment && todayAssignment.courseId !== course.id && progress.status === "not_started");
          const href = progress.status === "learned" ? `/review/session?scope=course&courseId=${course.id}&mode=mixed` : lockedToday ? "#" : `/learn/${course.id}`;
          return (
            <Link key={course.id} href={href} className="course-card" aria-disabled={lockedToday} onClick={(event) => lockedToday && event.preventDefault()}>
              <span className="course-number">{course.lesson}</span>
              <span className="course-info">
                <strong>{course.code} · {course.title}</strong>
                <span>{course.wordCount} 词 · 来源第 {course.sourceStartPage}{course.sourceEndPage !== course.sourceStartPage ? `–${course.sourceEndPage}` : ""} 页</span>
                <span className="progress-track"><span className="progress-bar" style={{ display: "block", width: `${percent}%` }} /></span>
              </span>
              <span className="course-progress">
                {lockedToday ? <LockKeyhole size={17} /> : progress.status === "learned" ? <Check size={19} color="var(--green)" /> : percent ? `${percent}%` : <ChevronRight size={19} />}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
