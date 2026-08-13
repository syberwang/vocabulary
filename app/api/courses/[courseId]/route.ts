import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { courseId } = await params;
  try {
    const [course, entries] = await Promise.all([
      query("select * from courses where id = $1", [courseId]),
      query("select * from vocabulary_entries where course_id = $1 and content_status = 'approved' order by source_row", [courseId]),
    ]);
    if (!course.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ course: course.rows[0], entries: entries.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
