import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { query, withTransaction } from "@/lib/db";

const CourseInput = z.object({
  levelCode: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/),
  unitNo: z.number().int().min(1).max(10000),
  lessonNo: z.number().int().min(1).max(100000),
  code: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(1000000).optional(),
  sourceStartPage: z.number().int().min(0).max(100000).optional(),
  sourceEndPage: z.number().int().min(0).max(100000).optional(),
}).refine((value) => (value.sourceEndPage ?? value.sourceStartPage ?? 0) >= (value.sourceStartPage ?? 0), {
  message: "结束页不能早于起始页",
  path: ["sourceEndPage"],
});

export async function GET() {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await query(`
      select c.*, l.title as level_title
      from courses c
      join content_levels l on l.code = c.level
      order by c.level, c.sort_order, c.lesson_no
    `);
    return NextResponse.json(result.rows, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = CourseInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const level = input.levelCode.toUpperCase();
  try {
    const course = await withTransaction(async (client) => {
      const levelResult = await client.query("select code from content_levels where code = $1", [level]);
      if (!levelResult.rows[0]) throw Object.assign(new Error("请先添加该阶段"), { code: "LEVEL_NOT_FOUND" });
      const sortOrder = input.sortOrder ?? Number((await client.query("select coalesce(max(sort_order), 0) + 1 as value from courses where level = $1", [level])).rows[0].value);
      const id = `manual-course-${randomUUID()}`;
      const result = await client.query(
        `insert into courses (id, level, unit_no, lesson_no, code, title, sort_order, word_count, source_start_page, source_end_page)
         values ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9)
         returning *`,
        [id, level, input.unitNo, input.lessonNo, input.code, input.title, sortOrder, input.sourceStartPage ?? 0, input.sourceEndPage ?? input.sourceStartPage ?? 0],
      );
      return result.rows[0];
    });
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === "LEVEL_NOT_FOUND") return NextResponse.json({ error: "请先添加该阶段" }, { status: 400 });
    if (databaseError.code === "23505") return NextResponse.json({ error: "该阶段下的课程编号已经存在" }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
