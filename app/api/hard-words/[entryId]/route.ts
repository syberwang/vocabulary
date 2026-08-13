import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/supabase/server";

export async function PUT(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { client, user } = await requireApiUser();
  if (!client || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { entryId } = await params;
  const { manual } = await request.json() as { manual: boolean };
  if (manual) {
    const { error } = await client.from("hard_word_flags").upsert({ user_id: user.id, entry_id: entryId, manual: true }, { onConflict: "user_id,entry_id" });
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true });
  }
  const current = await client.from("hard_word_flags").select("automatic").eq("user_id", user.id).eq("entry_id", entryId).maybeSingle();
  const result = current.data?.automatic ? await client.from("hard_word_flags").update({ manual: false }).eq("user_id", user.id).eq("entry_id", entryId) : await client.from("hard_word_flags").delete().eq("user_id", user.id).eq("entry_id", entryId);
  return result.error ? NextResponse.json({ error: result.error.message }, { status: 500 }) : NextResponse.json({ success: true });
}
