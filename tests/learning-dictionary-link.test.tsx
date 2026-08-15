// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, VocabularyEntry } from "@/lib/types";

const fixtures = vi.hoisted(() => {
  const course = {
    id: "a2-u4l13",
    level: "A2",
    unit: 4,
    lesson: 13,
    code: "U4L13",
    title: "Test course",
    sortOrder: 1,
    sourceStartPage: 1,
    sourceEndPage: 1,
    entryIds: ["entry-cultiver"],
    wordCount: 1,
  } satisfies Course;
  const entry = {
    id: "entry-cultiver",
    sourceRow: 1,
    courseId: course.id,
    level: course.level,
    unit: course.unit,
    lesson: course.lesson,
    courseCode: course.code,
    word: "cultiver(se)",
    pos: "v.pr.",
    zh: "提高自己的修养",
    acceptedAnswers: ["cultiver(se)", "cultiver"],
    exampleFr: "Il aime se cultiver.",
    exampleZh: "他喜欢提高自己的修养。",
    usageNote: "Test",
    sourcePage: 1,
    sourceMethod: "test",
    raw: { word: "cultiver(se)", pos: "v.pr.", zh: "提高自己的修养" },
    contentStatus: "approved",
    contentVersion: 1,
  } satisfies VocabularyEntry;
  return { course, entry, push: vi.fn(), replace: vi.fn(), speak: vi.fn(() => true) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: fixtures.push, replace: fixtures.replace }),
}));

vi.mock("@/components/app-provider", () => ({
  useApp: () => ({
    state: {
      timezone: "America/Toronto",
      dailyAssignments: { "2026-08-15": { date: "2026-08-15", courseId: fixtures.course.id } },
      manualHardEntryIds: [],
    },
    assignCourse: vi.fn(),
    submitAttempt: vi.fn(),
    toggleHard: vi.fn(),
    canRecordProgress: true,
  }),
}));

vi.mock("@/hooks/use-speech", () => ({
  useSpeech: () => ({ speak: fixtures.speak, speechError: null, speechState: "idle" }),
}));

vi.mock("@/lib/local-store", () => ({
  currentLearningCourse: () => fixtures.course.id,
  getCourseProgress: () => ({ status: "learning", masteredEntryIds: [] }),
  localDate: () => "2026-08-15",
}));

vi.mock("@/lib/vocabulary", () => ({
  courseById: new Map([[fixtures.course.id, fixtures.course]]),
  entriesForCourse: () => [fixtures.entry],
}));

import { LearningSession } from "@/components/learning-session";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LearningSession dictionary link visibility", () => {
  it("shows the link on the word card, hides it during recall, and restores it after feedback", () => {
    render(<LearningSession courseId={fixtures.course.id} />);

    expect(screen.getByRole("link", { name: "在法语助手查询 cultiver" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "隐藏答案，开始拼写" }));
    expect(screen.queryByRole("link", { name: "在法语助手查询 cultiver" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "法语答案" }), { target: { value: "cultiver" } });
    fireEvent.click(screen.getByRole("button", { name: "检查答案" }));

    expect(screen.getByRole("link", { name: "在法语助手查询 cultiver" })).toHaveAttribute(
      "href",
      "https://www.frdic.com/dicts/fr/cultiver",
    );
  });
});
