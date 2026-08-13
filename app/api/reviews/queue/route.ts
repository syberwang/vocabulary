import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { client, user } = await requireApiUser();
  if (!client || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") ?? "due";
  const courseId = params.get("courseId");
  const limit = Math.min(Number(params.get("limit") ?? (scope === "hard" ? 10 : 100)), 200);
  let entryIds: string[] = [];
  if (scope === "course" && courseId) {
    const result = await client.from("vocabulary_entries").select("id").eq("course_id", courseId).neq("content_status", "quarantined").limit(limit);
    entryIds = (result.data ?? []).map((row) => row.id);
  } else if (scope === "hard") {
    const result = await client.from("hard_word_flags").select("entry_id").eq("user_id", user.id).limit(limit);
    entryIds = (result.data ?? []).map((row) => row.entry_id);
  } else {
    const result = await client.from("card_states").select("entry_id").eq("user_id", user.id).lte("due", new Date().toISOString()).order("due").limit(limit);
    entryIds = (result.data ?? []).map((row) => row.entry_id);
  }
  if (!entryIds.length) return NextResponse.json([]);
  const { data, error } = await client.from("vocabulary_entries").select("*").in("id", entryIds);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data ?? []);
}
