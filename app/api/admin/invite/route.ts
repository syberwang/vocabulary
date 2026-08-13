import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ email: z.string().email() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Missing server credentials" }, { status: 503 });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ id: data.user.id, email: data.user.email });
}
