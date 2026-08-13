import { NextResponse } from "next/server";
import type { DatabaseError } from "pg";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { scheduleCard } from "@/lib/scheduler";
import type { SerializedCard } from "@/lib/types";

const Attempt = z.object({
  id: z.string().uuid(),
  entryId: z.string().min(1).max(200),
  courseId: z.string().min(1).max(200),
  mode: z.enum(["zh_to_fr", "fr_to_zh", "audio_to_fr"]),
  rating: z.enum(["again", "hard", "good", "easy"]),
  answer: z.string().max(500).optional(),
  expected: z.string().max(500).optional(),
  isPrimary: z.boolean().default(true),
  scheduled: z.boolean().default(false),
});

type CardRow = {
  entry_id: string;
  due: string | Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | Date | null;
};

function serializeCard(row?: CardRow): SerializedCard | undefined {
  if (!row) return undefined;
  return {
    due: row.due instanceof Date ? row.due.toISOString() : row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review instanceof Date ? row.last_review.toISOString() : row.last_review ?? undefined,
  };
}

export async function POST(request: Request) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Attempt.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  for (let transactionAttempt = 0; transactionAttempt < 2; transactionAttempt += 1) {
    try {
      const currentResult = await query<CardRow>("select * from card_states where entry_id = $1", [input.entryId]);
      const current = serializeCard(currentResult.rows[0]);
      const updatesSchedule = input.scheduled || !current;
      const nextCard = updatesSchedule ? scheduleCard(current, input.rating) : current;
      const result = await query<{ result: { duplicate?: boolean; automaticHard?: boolean; courseStatus?: string; masteredEntryIds?: string[] } }>(
        `select submit_review_attempt_transaction(
          $1::uuid, $2, $3, $4::review_mode, $5::review_rating, $6, $7, $8, $9,
          $10, $11::timestamptz, $12::timestamptz, $13, $14, $15, $16, $17, $18, $19, $20, $21::timestamptz
        ) as result`,
        [
          input.id, input.entryId, input.courseId, input.mode, input.rating,
          input.answer ?? null, input.expected ?? null, input.isPrimary, updatesSchedule,
          current?.reps ?? 0, current?.last_review ?? null, nextCard?.due ?? null,
          nextCard?.stability ?? 0, nextCard?.difficulty ?? 0, nextCard?.elapsed_days ?? 0,
          nextCard?.scheduled_days ?? 0, nextCard?.learning_steps ?? 0, nextCard?.reps ?? 0,
          nextCard?.lapses ?? 0, nextCard?.state ?? 0, nextCard?.last_review ?? null,
        ],
      );
      const transactionResult = result.rows[0]?.result ?? {};
      return NextResponse.json({ success: true, card: transactionResult.duplicate ? current : nextCard, ...transactionResult });
    } catch (error) {
      const databaseError = error as DatabaseError;
      if (databaseError.code === "40001" && transactionAttempt === 0) continue;
      return NextResponse.json({ error: databaseError.message ?? "Database error" }, { status: databaseError.code === "40001" ? 409 : 500 });
    }
  }
  return NextResponse.json({ error: "Review transaction failed" }, { status: 500 });
}
