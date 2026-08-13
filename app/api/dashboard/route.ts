import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/supabase/server";

export async function GET() {
  const { client, user } = await requireApiUser();
  if (!client || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date().toISOString();
  const [profile, due, learned, hard, recent] = await Promise.all([
    client.from("profiles").select("timezone,selected_level").eq("id", user.id).single(),
    client.from("card_states").select("entry_id", { count: "exact", head: true }).eq("user_id", user.id).lte("due", now),
    client.from("course_progress").select("course_id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "learned"),
    client.from("hard_word_flags").select("entry_id", { count: "exact", head: true }).eq("user_id", user.id),
    client.from("review_attempts").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
  ]);
  return NextResponse.json({ timezone: profile.data?.timezone, selectedLevel: profile.data?.selected_level, dueCount: due.count ?? 0, learnedCourseCount: learned.count ?? 0, hardCount: hard.count ?? 0, activityDates: [...new Set((recent.data ?? []).map((row) => row.created_at.slice(0, 10)))] });
}
