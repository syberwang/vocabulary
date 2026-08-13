import { NextResponse } from "next/server";
import { courses } from "@/lib/vocabulary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const level = new URL(request.url).searchParams.get("level");
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json(courses.filter((course) => !level || course.level === level));
  let query = client.from("courses").select("*").order("sort_order");
  if (level) query = query.eq("level", level);
  const { data, error } = await query;
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data);
}
