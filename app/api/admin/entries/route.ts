import crypto from "node:crypto";
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
