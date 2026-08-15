import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

const Assignment = z.object({
  courseId: z.string().min(1),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Assignment.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid course assignment" }, { status: 400 });
  }
  try {
    const course = await query("select id from courses where id = $1", [parsed.data.courseId]);
    if (!course.rows[0]) return NextResponse.json({ error: "Invalid course assignment" }, { status: 400 });
    const result = await query<{ assignment: Record<string, unknown> }>(
      "select assign_daily_course_transaction($1, $2::date) as assignment",
      [parsed.data.courseId, parsed.data.localDate],
    );
    return NextResponse.json(result.rows[0]?.assignment ?? null);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
