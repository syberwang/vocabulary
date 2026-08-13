import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

const Edit = z.object({ id: z.string(), word: z.string().min(1), part_of_speech: z.string().min(1), translation_zh: z.string().min(1), example_fr: z.string().min(1), example_zh: z.string().min(1), usage_note: z.string().min(1), accepted_answers: z.array(z.string().min(1)), content_status: z.enum(["draft", "approved", "needs_review", "quarantined"]), note: z.string().max(500).optional() });

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Missing server credentials" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim();
  const status = params.get("status") ?? "needs_review";
  let query = admin.from("vocabulary_entries").select("*").order("source_row").limit(50);
  if (status !== "all") query = query.eq("content_status", status);
  if (search) query = query.or(`word.ilike.%${search.replaceAll("%", "") }%,translation_zh.ilike.%${search.replaceAll("%", "")}%`);
  const { data, error } = await query;
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data ?? []);
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin || !auth.user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Missing server credentials" }, { status: 503 });
  const parsed = Edit.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { note, id, ...after } = parsed.data;
  const before = await admin.from("vocabulary_entries").select("*").eq("id", id).single();
  if (before.error) return NextResponse.json({ error: before.error.message }, { status: 404 });
  const update = await admin.from("vocabulary_entries").update({ ...after, content_version: before.data.content_version + 1, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });
  await admin.from("content_revisions").insert({ entry_id: id, editor_id: auth.user.id, before_values: before.data, after_values: update.data, note: note ?? null });
  return NextResponse.json(update.data);
}
