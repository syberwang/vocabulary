import { NextResponse } from "next/server";
import { courseById, entriesForCourse } from "@/lib/vocabulary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const client = await createSupabaseServerClient();
  if (!client) {
    const course = courseById.get(courseId);
    return course ? NextResponse.json({ course, entries: entriesForCourse(courseId) }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [course, entries] = await Promise.all([
    client.from("courses").select("*").eq("id", courseId).single(),
    client.from("vocabulary_entries").select("*").eq("course_id", courseId).neq("content_status", "quarantined").order("source_row"),
  ]);
  if (course.error) return NextResponse.json({ error: course.error.message }, { status: 404 });
  return NextResponse.json({ course: course.data, entries: entries.data ?? [] });
}
