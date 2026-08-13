import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const level = new URL(request.url).searchParams.get("level");
  if (level && level !== "A1" && level !== "A2") return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  try {
    const result = level
      ? await query("select * from courses where level = $1::app_level order by sort_order", [level])
      : await query("select * from courses order by sort_order");
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
