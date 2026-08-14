export type Level = string;
export type ReviewMode = "zh_to_fr" | "fr_to_zh" | "audio_to_fr";
export type RatingValue = "again" | "hard" | "good" | "easy";
export type CourseStatus = "not_started" | "learning" | "learned";
export type ContentStatus = "draft" | "approved" | "needs_review" | "quarantined";
export type ContentRisk = "low" | "medium" | "high";
export type ExampleSource = { kind: "manual" | "codex"; label: string };
export type ContentReview = {
  status: "approved";
  reviewerType: "human";
  reviewedAt: string;
  note: string;
  contentHash: string;
};

export interface Course {
  id: string;
  level: Level;
  levelTitle?: string;
  unit: number;
  lesson: number;
  code: string;
  title: string;
  sortOrder: number;
  sourceStartPage: number;
  sourceEndPage: number;
  entryIds: string[];
  wordCount: number;
}

export interface VocabularyEntry {
  id: string;
  sourceRow: number;
  courseId: string;
  level: Level;
  unit: number;
  lesson: number;
  courseCode: string;
  word: string;
  pos: string;
  zh: string;
  acceptedAnswers: string[];
  exampleFr: string;
  exampleZh: string;
  usageNote: string;
  sourcePage: number;
  sourceMethod: string;
  raw: { word: string | null; pos: string | null; zh: string | null };
  contentStatus: ContentStatus;
  contentVersion: number;
  exampleSource?: ExampleSource;
  contentRisk?: ContentRisk;
  contentReview?: ContentReview;
}

export interface SerializedCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export interface ReviewAttempt {
  id: string;
  entryId: string;
  courseId: string;
  mode: ReviewMode;
  rating: RatingValue;
  answer?: string;
  expected?: string;
  isPrimary: boolean;
  updatesSchedule: boolean;
  createdAt: string;
}

export interface CourseProgress {
  status: CourseStatus;
  masteredEntryIds: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface DailyAssignment {
  date: string;
  courseId: string;
  carriedFrom?: string;
  completedAt?: string;
}

export interface LocalLearningState {
  version: 1;
  timezone: string;
  selectedLevel: Level;
  dailyAssignments: Record<string, DailyAssignment>;
  courseProgress: Record<string, CourseProgress>;
  cards: Record<string, SerializedCard>;
  attempts: ReviewAttempt[];
  manualHardEntryIds: string[];
  activityDates: string[];
  voiceUri?: string;
  speechRate: number;
}
