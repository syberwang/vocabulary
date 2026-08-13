import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") ?? "due";
  const courseId = params.get("courseId");
  const requestedLimit = Number(params.get("limit") ?? (scope === "hard" ? 10 : 100));
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 100;
  try {
    if (scope === "course" && courseId) {
      const result = await query("select * from vocabulary_entries where course_id = $1 and content_status = 'approved' order by source_row limit $2", [courseId, limit]);
      return NextResponse.json(result.rows);
    }
    if (scope === "hard") {
      const result = await query("select v.* from hard_word_flags h join vocabulary_entries v on v.id = h.entry_id where v.content_status = 'approved' order by h.updated_at desc limit $1", [limit]);
      return NextResponse.json(result.rows);
    }
    const result = await query("select v.* from card_states c join vocabulary_entries v on v.id = c.entry_id where c.due <= now() and v.content_status = 'approved' order by c.due limit $1", [limit]);
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
