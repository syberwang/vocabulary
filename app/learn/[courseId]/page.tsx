import { LearningSession } from "@/components/learning-session";

export default async function LearnPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <LearningSession courseId={courseId} />;
}
