import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

const LevelInput = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/),
  title: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export async function GET() {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await query(`
      select l.code, l.title, l.sort_order, count(c.id)::int as course_count
      from content_levels l
      left join courses c on c.level = l.code
      group by l.code, l.title, l.sort_order
      order by l.sort_order, l.code
    `);
    return NextResponse.json(result.rows, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = LevelInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const code = parsed.data.code.toUpperCase();
  try {
    const result = await query(
      `insert into content_levels (code, title, sort_order)
       values ($1, $2, coalesce($3, (select coalesce(max(sort_order), 0) + 1 from content_levels)))
       returning code, title, sort_order, 0::int as course_count`,
      [code, parsed.data.title, parsed.data.sortOrder ?? null],
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === "23505") return NextResponse.json({ error: "该阶段已经存在" }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
