import type { Course, VocabularyEntry } from "@/lib/types";

type DbCourse = {
  id: string;
  level: string;
  level_title?: string;
  unit_no: number;
  lesson_no: number;
  code: string;
  title: string;
  sort_order: number;
  word_count: number;
  source_start_page: number;
  source_end_page: number;
};

type DbEntry = {
  id: string;
  source_row: number;
  course_id: string;
  word: string;
  part_of_speech: string;
  translation_zh: string;
  accepted_answers: string[];
  example_fr: string;
  example_zh: string;
  usage_note: string;
  source_page: number;
  source_method: string;
  raw_values: { word?: string; pos?: string; zh?: string };
  content_status: VocabularyEntry["contentStatus"];
  content_version: number;
  example_source?: VocabularyEntry["exampleSource"];
  content_risk?: VocabularyEntry["contentRisk"];
  content_review?: VocabularyEntry["contentReview"];
};

export function mapDbCourse(row: DbCourse): Course {
  return {
    id: row.id,
    level: row.level,
    levelTitle: row.level_title,
    unit: row.unit_no,
    lesson: row.lesson_no,
    code: row.code,
    title: row.title,
    sortOrder: row.sort_order,
    sourceStartPage: row.source_start_page,
    sourceEndPage: row.source_end_page,
    entryIds: [],
    wordCount: row.word_count,
  };
}

export function mapDbEntry(row: DbEntry, course?: Course): VocabularyEntry {
  return {
    id: row.id,
    sourceRow: row.source_row,
    courseId: row.course_id,
    level: course?.level ?? "",
    unit: course?.unit ?? 0,
    lesson: course?.lesson ?? 0,
    courseCode: course?.code ?? "",
    word: row.word,
    pos: row.part_of_speech,
    zh: row.translation_zh,
    acceptedAnswers: row.accepted_answers ?? [row.word],
    exampleFr: row.example_fr,
    exampleZh: row.example_zh,
    usageNote: row.usage_note,
    sourcePage: row.source_page,
    sourceMethod: row.source_method,
    raw: {
      word: row.raw_values?.word ?? null,
      pos: row.raw_values?.pos ?? null,
      zh: row.raw_values?.zh ?? null,
    },
    contentStatus: row.content_status,
    contentVersion: row.content_version,
    exampleSource: row.example_source,
    contentRisk: row.content_risk,
    contentReview: row.content_review,
  };
}
