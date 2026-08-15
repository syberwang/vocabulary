import crypto, { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { query, withTransaction } from "@/lib/db";

const Edit = z.object({
  id: z.string().min(1).max(200),
  word: z.string().min(1),
  part_of_speech: z.string().min(1),
  translation_zh: z.string().min(1),
  example_fr: z.string().min(1),
  example_zh: z.string().min(1),
  usage_note: z.string().min(1),
  accepted_answers: z.array(z.string().min(1)),
  content_status: z.enum(["draft", "approved", "needs_review", "quarantined"]),
  note: z.string().max(500).optional(),
});

const Create = z.object({
  course_id: z.string().min(1).max(200),
  word: z.string().trim().min(1).max(300),
  part_of_speech: z.string().trim().max(80).default(""),
  translation_zh: z.string().trim().min(1).max(1000),
  accepted_answers: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  example_fr: z.string().trim().max(1000).default(""),
  example_zh: z.string().trim().max(1000).default(""),
  usage_note: z.string().trim().max(1000).default(""),
  content_status: z.enum(["draft", "approved", "needs_review", "quarantined"]).default("needs_review"),
  note: z.string().trim().max(500).optional(),
}).refine((value) => value.content_status !== "approved" || (value.example_fr.length > 0 && value.example_zh.length > 0), {
  message: "批准发布前需要填写法语例句和中文翻译",
  path: ["example_fr"],
});

export async function GET(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim().slice(0, 100);
  const status = params.get("status") ?? "needs_review";
  if (!["all", "draft", "approved", "needs_review", "quarantined"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (status !== "all") {
    values.push(status);
    conditions.push(`content_status = $${values.length}::content_status`);
  }
  if (search) {
    values.push(`%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    conditions.push(`(word ilike $${values.length} escape '\\' or translation_zh ilike $${values.length} escape '\\')`);
  }
  try {
    const result = await query(`select * from vocabulary_entries ${conditions.length ? `where ${conditions.join(" and ")}` : ""} order by source_row limit 50`, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Edit.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { note, id, ...after } = parsed.data;
  const reviewedAt = new Date().toISOString();
  const contentHash = crypto.createHash("sha256").update(JSON.stringify({
    word: after.word,
    pos: after.part_of_speech,
    zh: after.translation_zh,
    acceptedAnswers: after.accepted_answers,
    exampleFr: after.example_fr,
    exampleZh: after.example_zh,
    usageNote: after.usage_note,
  })).digest("hex");
  const contentReview = after.content_status === "approved" ? {
    status: "approved",
    reviewerType: "human",
    reviewedAt,
    note: note ?? "管理员后台校订并批准",
    contentHash,
  } : null;

  try {
    const updated = await withTransaction(async (client) => {
      const before = await client.query("select * from vocabulary_entries where id = $1 for update", [id]);
      if (!before.rows[0]) return null;
      const result = await client.query(
        `update vocabulary_entries set
          word = $2, part_of_speech = $3, translation_zh = $4, accepted_answers = $5::jsonb,
          example_fr = $6, example_zh = $7, usage_note = $8, content_status = $9::content_status,
          content_review = $10::jsonb, content_risk = case when $9::content_status = 'approved' then 'low' else content_risk end,
          content_version = content_version + 1, updated_at = $11::timestamptz
        where id = $1 returning *`,
        [id, after.word, after.part_of_speech, after.translation_zh, JSON.stringify(after.accepted_answers), after.example_fr, after.example_zh, after.usage_note, after.content_status, JSON.stringify(contentReview), reviewedAt],
      );
      await client.query(
        "insert into content_revisions (entry_id, editor, before_values, after_values, note) values ($1, 'owner', $2::jsonb, $3::jsonb, $4)",
        [id, JSON.stringify(before.rows[0]), JSON.stringify(result.rows[0]), note ?? null],
      );
      return result.rows[0];
    });
    return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const acceptedAnswers = input.accepted_answers?.length ? input.accepted_answers : [input.word];
  const reviewedAt = new Date().toISOString();
  const contentHash = crypto.createHash("sha256").update(JSON.stringify({
    word: input.word,
    pos: input.part_of_speech,
    zh: input.translation_zh,
    acceptedAnswers,
    exampleFr: input.example_fr,
    exampleZh: input.example_zh,
    usageNote: input.usage_note,
  })).digest("hex");
  const contentReview = input.content_status === "approved" ? {
    status: "approved",
    reviewerType: "human",
    reviewedAt,
    note: input.note ?? "内容后台手动录入并批准",
    contentHash,
  } : null;

  try {
    const created = await withTransaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtextextended('vocabulary_entries:manual_source_row', 0))");
      const course = await client.query("select id from courses where id = $1 for update", [input.course_id]);
      if (!course.rows[0]) throw Object.assign(new Error("课程不存在"), { code: "COURSE_NOT_FOUND" });
      const sourceRowResult = await client.query("select coalesce(min(source_row), 0) - 1 as source_row from vocabulary_entries");
      const sourceRow = Number(sourceRowResult.rows[0].source_row);
      const id = `manual-entry-${randomUUID()}`;
      const result = await client.query(
        `insert into vocabulary_entries (
          id, source_row, course_id, word, part_of_speech, translation_zh, accepted_answers,
          example_fr, example_zh, usage_note, source_page, source_method, raw_values,
          content_status, content_version, example_source, content_risk, content_review
        ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, 0, '内容后台手动录入', $11::jsonb, $12::content_status, 1, $13::jsonb, $14, $15::jsonb)
        returning *`,
        [
          id,
          sourceRow,
          input.course_id,
          input.word,
          input.part_of_speech,
          input.translation_zh,
          JSON.stringify(acceptedAnswers),
          input.example_fr,
          input.example_zh,
          input.usage_note,
          JSON.stringify({ word: input.word, pos: input.part_of_speech, zh: input.translation_zh }),
          input.content_status,
          JSON.stringify({ kind: "manual", label: "人工录入" }),
          input.content_status === "approved" ? "low" : "medium",
          JSON.stringify(contentReview),
        ],
      );
      await client.query("update courses set word_count = word_count + 1 where id = $1", [input.course_id]);
      await client.query(
        "insert into content_revisions (entry_id, editor, before_values, after_values, note) values ($1, 'owner', '{}'::jsonb, $2::jsonb, $3)",
        [id, JSON.stringify(result.rows[0]), input.note ?? "内容后台新增词条"],
      );
      return result.rows[0];
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === "COURSE_NOT_FOUND") return NextResponse.json({ error: "课程不存在" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
