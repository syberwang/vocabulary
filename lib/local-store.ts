"use client";

import type {
  CourseProgress,
  LocalLearningState,
  RatingValue,
  ReviewAttempt,
  ReviewMode,
} from "@/lib/types";
import { courseById, entriesForCourse } from "@/lib/vocabulary";
import { isDue, scheduleCard } from "@/lib/scheduler";

export const STORAGE_KEY = "french-vocabulary-pwa:v1";

export const initialState: LocalLearningState = {
  version: 1,
  timezone: "America/Toronto",
  selectedLevel: "A1",
  dailyAssignments: {},
  courseProgress: {},
  cards: {},
  attempts: [],
  manualHardEntryIds: [],
  activityDates: [],
  speechRate: 0.9,
};

export function localDate(timezone: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function loadState(): LocalLearningState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...(JSON.parse(raw) as LocalLearningState) };
  } catch {
    return initialState;
  }
}

export function saveState(state: LocalLearningState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getCourseProgress(state: LocalLearningState, courseId: string): CourseProgress {
  return state.courseProgress[courseId] ?? { status: "not_started", masteredEntryIds: [] };
}

export function dueEntryIds(state: LocalLearningState) {
  return Object.entries(state.cards)
    .filter(([, card]) => isDue(card))
    .map(([entryId]) => entryId);
}

export function currentLearningCourse(state: LocalLearningState) {
  return Object.entries(state.courseProgress).find(([, progress]) => progress.status === "learning")?.[0];
}

export function startDailyCourse(state: LocalLearningState, requestedCourseId: string) {
  const today = localDate(state.timezone);
  const existingToday = state.dailyAssignments[today];
  if (existingToday) return { state, courseId: existingToday.courseId };

  const unfinished = currentLearningCourse(state);
  const courseId = unfinished ?? requestedCourseId;
  const next = structuredClone(state);
  next.dailyAssignments[today] = {
    date: today,
    courseId,
    carriedFrom: unfinished
      ? Object.values(state.dailyAssignments)
          .filter((assignment) => assignment.courseId === unfinished)
          .sort((a, b) => b.date.localeCompare(a.date))[0]?.date
      : undefined,
  };
  const progress = getCourseProgress(next, courseId);
  next.courseProgress[courseId] = {
    ...progress,
    status: "learning",
    startedAt: progress.startedAt ?? new Date().toISOString(),
  };
  return { state: next, courseId };
}

export interface RecordAttemptInput {
  id?: string;
  occurredAt?: string;
  entryId: string;
  courseId: string;
  rating: RatingValue;
  mode: ReviewMode;
  answer?: string;
  expected?: string;
  isPrimary?: boolean;
  scheduled?: boolean;
}

export function recordAttempt(state: LocalLearningState, input: RecordAttemptInput) {
  const next = structuredClone(state);
  const now = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const isNew = !next.cards[input.entryId];
  const updatesSchedule = Boolean(input.scheduled || isNew);
  if (updatesSchedule) {
    next.cards[input.entryId] = scheduleCard(next.cards[input.entryId], input.rating, now);
  }

  const attempt: ReviewAttempt = {
    id: input.id ?? crypto.randomUUID(),
    entryId: input.entryId,
    courseId: input.courseId,
    mode: input.mode,
    rating: input.rating,
    answer: input.answer,
    expected: input.expected,
    isPrimary: input.isPrimary ?? true,
    updatesSchedule,
    createdAt: now.toISOString(),
  };
  next.attempts = [...next.attempts, attempt].slice(-5000);

  if (input.rating === "good" || input.rating === "easy") {
    const progress = getCourseProgress(next, input.courseId);
    const mastered = new Set(progress.masteredEntryIds);
    mastered.add(input.entryId);
    const total = entriesForCourse(input.courseId).length;
    // Dynamically added courses are loaded from PostgreSQL at runtime and are
    // intentionally absent from the offline seed. Do not mark them learned
    // after the first card just because the fallback list is empty.
    const learned = total > 0 && mastered.size >= total;
    next.courseProgress[input.courseId] = {
      ...progress,
      status: learned ? "learned" : "learning",
      startedAt: progress.startedAt ?? now.toISOString(),
      masteredEntryIds: [...mastered],
      completedAt: learned ? now.toISOString() : progress.completedAt,
    };
    if (learned) {
      Object.values(next.dailyAssignments)
        .filter((assignment) => assignment.courseId === input.courseId)
        .forEach((assignment) => {
          assignment.completedAt = now.toISOString();
        });
    }
  }

  const activityDate = localDate(next.timezone, now);
  next.activityDates = [...new Set([...next.activityDates, activityDate])].sort();
  return next;
}

export function isAutomaticallyHard(state: LocalLearningState, entryId: string) {
  const history = state.attempts.filter((attempt) => attempt.entryId === entryId && attempt.isPrimary);
  let automatic = false;
  for (let index = 0; index < history.length; index += 1) {
    const attempts = history.slice(Math.max(0, index - 9), index + 1);
    const lastTwoAgain = attempts.length >= 2 && attempts.slice(-2).every((attempt) => attempt.rating === "again");
    const difficult = attempts.filter((attempt) => attempt.rating === "again" || attempt.rating === "hard").length;
    const difficultRate = attempts.length ? difficult / attempts.length : 0;
    const recentThreeStrong = attempts.length >= 3 && attempts.slice(-3).every((attempt) => attempt.rating === "good" || attempt.rating === "easy");
    if (lastTwoAgain || (attempts.length >= 5 && difficultRate >= 0.4)) automatic = true;
    else if (automatic && attempts.length >= 5 && difficultRate <= 0.2 && recentThreeStrong) automatic = false;
  }
  return automatic;
}

export function hardEntryIds(state: LocalLearningState) {
  const automatic = new Set(
    state.attempts
      .map((attempt) => attempt.entryId)
      .filter((entryId) => isAutomaticallyHard(state, entryId)),
  );
  state.manualHardEntryIds.forEach((entryId) => automatic.add(entryId));
  return [...automatic];
}

export function streakCount(state: LocalLearningState) {
  const dates = new Set(state.activityDates);
  let cursor = new Date();
  let count = 0;
  while (dates.has(localDate(state.timezone, cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function courseLabel(courseId: string) {
  const course = courseById.get(courseId);
  return course ? `${course.level} · ${course.code}` : courseId;
}
