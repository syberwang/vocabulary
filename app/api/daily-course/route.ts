import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/supabase/server";
import { courses } from "@/lib/vocabulary";

export async function POST(request: Request) {
  const { client, user } = await requireApiUser();
  if (!client || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { courseId, localDate } = await request.json() as { courseId?: string; localDate?: string };
  if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return NextResponse.json({ error: "Invalid local date" }, { status: 400 });
  const existing = await client.from("daily_course_assignments").select("*").eq("user_id", user.id).eq("local_date", localDate).maybeSingle();
  if (existing.data) return NextResponse.json(existing.data);
  const unfinished = await client.from("course_progress").select("course_id").eq("user_id", user.id).eq("status", "learning").order("started_at").limit(1).maybeSingle();
  const selected = unfinished.data?.course_id ?? courseId;
  if (!selected || !courses.some((course) => course.id === selected)) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  const payload = { user_id: user.id, local_date: localDate, course_id: selected, carried_from: unfinished.data ? localDate : null };
  const { data, error } = await client.from("daily_course_assignments").insert(payload).select().single();
  if (error?.code === "23505") {
    const winner = await client.from("daily_course_assignments").select("*").eq("user_id", user.id).eq("local_date", localDate).single();
    return NextResponse.json(winner.data);
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await client.from("course_progress").upsert({ user_id: user.id, course_id: selected, status: "learning", mastered_entry_ids: [], started_at: new Date().toISOString() }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
  return NextResponse.json(data, { status: 201 });
}
