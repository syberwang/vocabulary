import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/supabase/server";
import type { LocalLearningState } from "@/lib/types";

const baseState: LocalLearningState = {
  version: 1, timezone: "America/Toronto", selectedLevel: "A1", dailyAssignments: {}, courseProgress: {}, cards: {}, attempts: [], manualHardEntryIds: [], activityDates: [], speechRate: 0.9,
};

export async function GET() {
  const { client, user } = await requireApiUser();
  if (!client || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [profile, assignments, progress, cards, attempts, flags] = await Promise.all([
    client.from("profiles").select("timezone,selected_level").eq("id", user.id).single(),
    client.from("daily_course_assignments").select("local_date,course_id,carried_from,completed_at").eq("user_id", user.id),
    client.from("course_progress").select("course_id,status,mastered_entry_ids,started_at,completed_at").eq("user_id", user.id),
    client.from("card_states").select("*").eq("user_id", user.id),
    client.from("review_attempts").select("id,entry_id,course_id,mode,rating,answer,expected,is_primary,updates_schedule,created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(5000),
    client.from("hard_word_flags").select("entry_id,manual").eq("user_id", user.id).eq("manual", true),
  ]);
  const errors = [profile, assignments, progress, cards, attempts, flags].map((result) => result.error).filter(Boolean);
  if (errors.length) return NextResponse.json({ error: errors[0]?.message }, { status: 500 });

  const state = structuredClone(baseState);
  state.timezone = profile.data?.timezone ?? baseState.timezone;
  state.selectedLevel = profile.data?.selected_level ?? "A1";
  for (const row of assignments.data ?? []) state.dailyAssignments[row.local_date] = { date: row.local_date, courseId: row.course_id, carriedFrom: row.carried_from ?? undefined, completedAt: row.completed_at ?? undefined };
  for (const row of progress.data ?? []) state.courseProgress[row.course_id] = { status: row.status, masteredEntryIds: row.mastered_entry_ids ?? [], startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined };
  for (const row of cards.data ?? []) state.cards[row.entry_id] = { due: row.due, stability: row.stability, difficulty: row.difficulty, elapsed_days: row.elapsed_days, scheduled_days: row.scheduled_days, learning_steps: row.learning_steps, reps: row.reps, lapses: row.lapses, state: row.state, last_review: row.last_review ?? undefined };
  state.attempts = (attempts.data ?? []).map((row) => ({ id: row.id, entryId: row.entry_id, courseId: row.course_id, mode: row.mode, rating: row.rating, answer: row.answer ?? undefined, expected: row.expected ?? undefined, isPrimary: row.is_primary, updatesSchedule: row.updates_schedule, createdAt: row.created_at }));
  state.manualHardEntryIds = (flags.data ?? []).map((row) => row.entry_id);
  state.activityDates = [...new Set(state.attempts.map((attempt) => new Intl.DateTimeFormat("en-CA", { timeZone: state.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(attempt.createdAt))))].sort();
  return NextResponse.json(state);
}

export async function PUT(request: Request) {
  const { client, user } = await requireApiUser();
  if (!client || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = (await request.json()) as LocalLearningState;
  if (state.version !== 1) return NextResponse.json({ error: "Unsupported state version" }, { status: 400 });

  const operations = [
    client.from("profiles").update({ timezone: state.timezone, selected_level: state.selectedLevel, updated_at: new Date().toISOString() }).eq("id", user.id),
  ];
  await Promise.all(operations);

  const assignments = Object.values(state.dailyAssignments).map((row) => ({ user_id: user.id, local_date: row.date, course_id: row.courseId, carried_from: row.carriedFrom ?? null, completed_at: row.completedAt ?? null }));
  const progress = Object.entries(state.courseProgress).map(([courseId, row]) => ({ user_id: user.id, course_id: courseId, status: row.status, mastered_entry_ids: row.masteredEntryIds, started_at: row.startedAt ?? null, completed_at: row.completedAt ?? null, updated_at: new Date().toISOString() }));
  const cards = Object.entries(state.cards).map(([entryId, row]) => ({ user_id: user.id, entry_id: entryId, due: row.due, stability: row.stability, difficulty: row.difficulty, elapsed_days: row.elapsed_days, scheduled_days: row.scheduled_days, learning_steps: row.learning_steps, reps: row.reps, lapses: row.lapses, state: row.state, last_review: row.last_review ?? null, updated_at: new Date().toISOString() }));
  const attempts = state.attempts.map((row) => ({ id: row.id, user_id: user.id, entry_id: row.entryId, course_id: row.courseId, mode: row.mode, rating: row.rating, answer: row.answer ?? null, expected: row.expected ?? null, is_primary: row.isPrimary, updates_schedule: row.updatesSchedule, created_at: row.createdAt }));
  if (assignments.length) await client.from("daily_course_assignments").upsert(assignments, { onConflict: "user_id,local_date" });
  if (progress.length) await client.from("course_progress").upsert(progress, { onConflict: "user_id,course_id" });
  if (cards.length) await client.from("card_states").upsert(cards, { onConflict: "user_id,entry_id" });
  if (attempts.length) await client.from("review_attempts").upsert(attempts, { onConflict: "user_id,id" });
  await client.from("hard_word_flags").delete().eq("user_id", user.id).eq("manual", true);
  if (state.manualHardEntryIds.length) await client.from("hard_word_flags").upsert(state.manualHardEntryIds.map((entryId) => ({ user_id: user.id, entry_id: entryId, manual: true, automatic: false })), { onConflict: "user_id,entry_id" });
  return NextResponse.json({ success: true });
}
