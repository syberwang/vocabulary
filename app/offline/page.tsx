import Link from "next/link";

export default function OfflinePage() {
  return (
    <section className="empty-state page-section">
      <span className="empty-icon">↻</span>
      <h1>暂时离线</h1>
      <p>已缓存的卡片仍可浏览；正式学习进度需要联网同步。</p>
      <Link className="primary-button" href="/courses">查看已缓存课程</Link>
    </section>
  );
}
