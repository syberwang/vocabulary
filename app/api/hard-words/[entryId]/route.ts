import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db";

export async function PUT(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  if (!(await requireApiSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { entryId } = await params;
  const parsed = z.object({ manual: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || !entryId || entryId.length > 200) return NextResponse.json({ error: "Invalid hard-word flag" }, { status: 400 });
  try {
    await withTransaction(async (client) => {
      if (parsed.data.manual) {
        await client.query(
          "insert into hard_word_flags (entry_id, manual, automatic, updated_at) values ($1, true, false, now()) on conflict (entry_id) do update set manual = true, updated_at = now()",
          [entryId],
        );
        return;
      }
      await client.query("update hard_word_flags set manual = false, updated_at = now() where entry_id = $1 and automatic = true", [entryId]);
      await client.query("delete from hard_word_flags where entry_id = $1 and automatic = false", [entryId]);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
