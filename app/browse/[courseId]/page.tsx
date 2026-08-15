import { CourseBrowseSession } from "@/components/course-browse-session";

export default async function BrowseCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseBrowseSession courseId={courseId} />;
}
