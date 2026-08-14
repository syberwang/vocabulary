import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const level = new URL(request.url).searchParams.get("level");
  if (level && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/.test(level)) return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  try {
    const result = level
      ? await query("select c.*, l.title as level_title from courses c join content_levels l on l.code = c.level where c.level = $1 order by c.sort_order, c.lesson_no", [level])
      : await query("select c.*, l.title as level_title from courses c join content_levels l on l.code = c.level order by c.sort_order, c.lesson_no");
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
