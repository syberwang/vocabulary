import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET() {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [settings, due, learned, hard, recent] = await Promise.all([
      query<{ timezone: string; selected_level: string }>("select timezone, selected_level from app_settings where id = 1"),
      query<{ count: string }>("select count(*) from card_states where due <= now()"),
      query<{ count: string }>("select count(*) from course_progress where status = 'learned'"),
      query<{ count: string }>("select count(*) from hard_word_flags"),
      query<{ created_at: Date }>("select created_at from review_attempts order by created_at desc limit 200"),
    ]);
    return NextResponse.json({
      timezone: settings.rows[0]?.timezone,
      selectedLevel: settings.rows[0]?.selected_level,
      dueCount: Number(due.rows[0]?.count ?? 0),
      learnedCourseCount: Number(learned.rows[0]?.count ?? 0),
      hardCount: Number(hard.rows[0]?.count ?? 0),
      activityDates: [...new Set(recent.rows.map((row) => row.created_at.toISOString().slice(0, 10)))],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
