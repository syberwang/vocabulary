import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import type { LocalLearningState } from "@/lib/types";

const baseState: LocalLearningState = {
  version: 1, timezone: "America/Toronto", selectedLevel: "A1", dailyAssignments: {}, courseProgress: {}, cards: {}, attempts: [], manualHardEntryIds: [], activityDates: [], speechRate: 0.9,
};

function timestamp(value: Date | string | null) {
  return value instanceof Date ? value.toISOString() : value ?? undefined;
}

export async function GET() {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [settings, assignments, progress, cards, attempts, flags] = await Promise.all([
      query<{ timezone: string; selected_level: "A1" | "A2" }>("select timezone, selected_level from app_settings where id = 1"),
      query<{ local_date: string; course_id: string; carried_from: string | null; completed_at: Date | string | null }>("select local_date, course_id, carried_from, completed_at from daily_course_assignments"),
      query<{ course_id: string; status: "not_started" | "learning" | "learned"; mastered_entry_ids: string[]; started_at: Date | string | null; completed_at: Date | string | null }>("select course_id, status, mastered_entry_ids, started_at, completed_at from course_progress"),
      query<{ entry_id: string; due: Date | string; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; learning_steps: number; reps: number; lapses: number; state: number; last_review: Date | string | null }>("select * from card_states"),
      query<{ id: string; entry_id: string; course_id: string; mode: "zh_to_fr" | "fr_to_zh" | "audio_to_fr"; rating: "again" | "hard" | "good" | "easy"; answer: string | null; expected: string | null; is_primary: boolean; updates_schedule: boolean; created_at: Date | string }>("select id, entry_id, course_id, mode, rating, answer, expected, is_primary, updates_schedule, created_at from review_attempts order by created_at asc, id asc limit 5000"),
      query<{ entry_id: string }>("select entry_id from hard_word_flags where manual = true"),
    ]);
    const state = structuredClone(baseState);
    state.timezone = settings.rows[0]?.timezone ?? baseState.timezone;
    state.selectedLevel = settings.rows[0]?.selected_level ?? "A1";
    for (const row of assignments.rows) state.dailyAssignments[row.local_date] = { date: row.local_date, courseId: row.course_id, carriedFrom: row.carried_from ?? undefined, completedAt: timestamp(row.completed_at) };
    for (const row of progress.rows) state.courseProgress[row.course_id] = { status: row.status, masteredEntryIds: row.mastered_entry_ids ?? [], startedAt: timestamp(row.started_at), completedAt: timestamp(row.completed_at) };
    for (const row of cards.rows) state.cards[row.entry_id] = { due: timestamp(row.due)!, stability: row.stability, difficulty: row.difficulty, elapsed_days: row.elapsed_days, scheduled_days: row.scheduled_days, learning_steps: row.learning_steps, reps: row.reps, lapses: row.lapses, state: row.state, last_review: timestamp(row.last_review) };
    state.attempts = attempts.rows.map((row) => ({ id: row.id, entryId: row.entry_id, courseId: row.course_id, mode: row.mode, rating: row.rating, answer: row.answer ?? undefined, expected: row.expected ?? undefined, isPrimary: row.is_primary, updatesSchedule: row.updates_schedule, createdAt: timestamp(row.created_at)! }));
    state.manualHardEntryIds = flags.rows.map((row) => row.entry_id);
    state.activityDates = [...new Set(state.attempts.map((attempt) => new Intl.DateTimeFormat("en-CA", { timeZone: state.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(attempt.createdAt))))].sort();
    return NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

const Preferences = z.object({
  selectedLevel: z.enum(["A1", "A2"]).optional(),
  timezone: z.string().min(1).max(80).optional(),
}).refine((value) => value.selectedLevel || value.timezone, "No preference supplied");

export async function PATCH(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Preferences.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.timezone) {
    try { new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone }); }
    catch { return NextResponse.json({ error: "Invalid timezone" }, { status: 400 }); }
  }
  try {
    await query(
      "update app_settings set selected_level = coalesce($1::app_level, selected_level), timezone = coalesce($2::text, timezone), updated_at = now() where id = 1",
      [parsed.data.selectedLevel ?? null, parsed.data.timezone ?? null],
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
