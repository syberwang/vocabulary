import vocabularyData from "@/data/vocabulary.json";
import type { Course, VocabularyEntry } from "@/lib/types";

export const courses = vocabularyData.courses as Course[];
export const entries = vocabularyData.entries as VocabularyEntry[];
export const metadata = vocabularyData.metadata;

export const entryById = new Map(entries.map((entry) => [entry.id, entry]));
export const courseById = new Map(courses.map((course) => [course.id, course]));

export function entriesForCourse(courseId: string) {
  return entries.filter(
    (entry) => entry.courseId === courseId && entry.contentStatus !== "quarantined",
  );
}

export function nextCourse(level: "A1" | "A2", learnedCourseIds: Set<string>) {
  return courses.find((course) => course.level === level && !learnedCourseIds.has(course.id));
}
