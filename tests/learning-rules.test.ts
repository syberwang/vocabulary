import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, isAutomaticallyHard, localDate, recordAttempt, startDailyCourse } from "@/lib/local-store";
import { entriesForCourse } from "@/lib/vocabulary";

beforeEach(() => {
  vi.stubGlobal("crypto", { randomUUID: () => `00000000-0000-4000-8000-${Math.random().toString().slice(2, 14).padEnd(12, "0")}` });
});

describe("one course per day", () => {
  it("keeps the first course assignment for a local date", () => {
    const first = startDailyCourse(initialState, "a1-u1l1");
    const second = startDailyCourse(first.state, "a1-u1l2");
    expect(second.courseId).toBe("a1-u1l1");
    expect(Object.keys(second.state.dailyAssignments)).toEqual([localDate(initialState.timezone)]);
  });

  it("carries an unfinished course instead of opening another", () => {
    const state = structuredClone(initialState);
    state.courseProgress["a1-u1l1"] = { status: "learning", masteredEntryIds: [] };
    const result = startDailyCourse(state, "a1-u1l2");
    expect(result.courseId).toBe("a1-u1l1");
  });
});

describe("course completion and hard word rules", () => {
  it("only completes a course after every entry gets Good or Easy", () => {
    const courseId = "a1-u2l8";
    const words = entriesForCourse(courseId);
    let state = structuredClone(initialState);
    for (const entry of words.slice(0, -1)) state = recordAttempt(state, { entryId: entry.id, courseId, mode: "zh_to_fr", rating: "good", scheduled: true });
    expect(state.courseProgress[courseId].status).toBe("learning");
    state = recordAttempt(state, { entryId: words.at(-1)!.id, courseId, mode: "zh_to_fr", rating: "easy", scheduled: true });
    expect(state.courseProgress[courseId].status).toBe("learned");
  });

  it("flags consecutive failures and later releases a recovered word", () => {
    const entry = entriesForCourse("a1-u1l1")[0];
    let state = structuredClone(initialState);
    state = recordAttempt(state, { entryId: entry.id, courseId: entry.courseId, mode: "zh_to_fr", rating: "again" });
    state = recordAttempt(state, { entryId: entry.id, courseId: entry.courseId, mode: "zh_to_fr", rating: "again" });
    expect(isAutomaticallyHard(state, entry.id)).toBe(true);
    for (let i = 0; i < 8; i += 1) state = recordAttempt(state, { entryId: entry.id, courseId: entry.courseId, mode: "zh_to_fr", rating: "good" });
    expect(isAutomaticallyHard(state, entry.id)).toBe(false);
  });
});
