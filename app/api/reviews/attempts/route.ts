import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/supabase/server";
import { scheduleCard } from "@/lib/scheduler";
import type { SerializedCard } from "@/lib/types";

const Attempt = z.object({ id: z.string().uuid(), entryId: z.string(), courseId: z.string(), mode: z.enum(["zh_to_fr", "fr_to_zh", "audio_to_fr"]), rating: z.enum(["again", "hard", "good", "easy"]), answer: z.string().optional(), expected: z.string().optional(), isPrimary: z.boolean().default(true), scheduled: z.boolean().default(false) });

export async function POST(request: Request) {
  const { client, user } = await requireApiUser();
  if (!client || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Attempt.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const duplicate = await client.from("review_attempts").select("id").eq("user_id", user.id).eq("id", input.id).maybeSingle();
  if (duplicate.data) return NextResponse.json({ success: true, duplicate: true });
  const currentResult = await client.from("card_states").select("*").eq("user_id", user.id).eq("entry_id", input.entryId).maybeSingle();
  const current = currentResult.data ? ({ ...currentResult.data, last_review: currentResult.data.last_review ?? undefined } as SerializedCard) : undefined;
  const updatesSchedule = input.scheduled || !current;
  const nextCard = updatesSchedule ? scheduleCard(current, input.rating) : current;
  const { error } = await client.from("review_attempts").insert({ id: input.id, user_id: user.id, entry_id: input.entryId, course_id: input.courseId, mode: input.mode, rating: input.rating, answer: input.answer ?? null, expected: input.expected ?? null, is_primary: input.isPrimary, updates_schedule: updatesSchedule });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (nextCard && updatesSchedule) await client.from("card_states").upsert({ user_id: user.id, entry_id: input.entryId, ...nextCard, last_review: nextCard.last_review ?? null }, { onConflict: "user_id,entry_id" });
  const recent = await client.from("review_attempts").select("rating").eq("user_id", user.id).eq("entry_id", input.entryId).eq("is_primary", true).order("created_at", { ascending: false }).limit(10);
  const ratings = (recent.data ?? []).map((row) => row.rating);
  const lastTwoAgain = ratings.length >= 2 && ratings.slice(0, 2).every((rating) => rating === "again");
  const difficultRate = ratings.length ? ratings.filter((rating) => rating === "again" || rating === "hard").length / ratings.length : 0;
  const recentThreeStrong = ratings.length >= 3 && ratings.slice(0, 3).every((rating) => rating === "good" || rating === "easy");
  const automatic = lastTwoAgain || (ratings.length >= 5 && difficultRate >= 0.4 && !(difficultRate <= 0.2 && recentThreeStrong));
  if (automatic) await client.from("hard_word_flags").upsert({ user_id: user.id, entry_id: input.entryId, automatic: true }, { onConflict: "user_id,entry_id" });
  return NextResponse.json({ success: true, card: nextCard, automaticHard: automatic });
}
