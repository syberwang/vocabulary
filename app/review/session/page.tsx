import { Suspense } from "react";
import { ReviewSession } from "@/components/review-session";

export default function ReviewSessionPage() {
  return <Suspense fallback={<div className="empty-state">正在准备复习卡片…</div>}><ReviewSession /></Suspense>;
}
