"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Dumbbell, Home, Layers3, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/courses", label: "课程", icon: BookOpen },
  { href: "/review", label: "复习", icon: Layers3 },
  { href: "/hard", label: "强化本", icon: Dumbbell },
  { href: "/profile", label: "我的", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname.startsWith("/learn/") || pathname.startsWith("/review/session");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <div className="app-frame">
      {!immersive && (
        <header className="topbar">
          <Link href="/" className="brand" aria-label="法语词卡首页">
            <span className="brand-mark">fr</span>
            <span>
              <strong>法语词卡</strong>
              <small>每天一课 · 稳稳记住</small>
            </span>
          </Link>
          {!configured && <span className="demo-pill">本地演示</span>}
        </header>
      )}
      <main className={immersive ? "immersive-main" : "page-main"}>{children}</main>
      {!immersive && (
        <nav className="bottom-nav" aria-label="主要导航">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "nav-item active" : "nav-item"} aria-current={active ? "page" : undefined}>
                <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
