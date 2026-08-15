"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Check, CloudOff, Dumbbell, Home, Layers3, LoaderCircle, RefreshCw, Settings } from "lucide-react";
import { useApp } from "@/components/app-provider";

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/courses", label: "课程", icon: BookOpen },
  { href: "/review", label: "复习", icon: Layers3 },
  { href: "/hard", label: "强化本", icon: Dumbbell },
  { href: "/profile", label: "我的", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { syncStatus, syncMessage, retrySync } = useApp();
  const immersive = pathname === "/login" || pathname.startsWith("/learn/") || pathname.startsWith("/browse/") || pathname.startsWith("/review/session");
  const configured = true;

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
          {!configured ? <span className="demo-pill">本地演示</span> : (
            <button className={`sync-pill ${syncStatus}`} onClick={syncStatus === "error" ? retrySync : undefined} disabled={syncStatus !== "error"} aria-label={syncStatus === "error" ? "同步失败，点击重试" : undefined}>
              {syncStatus === "loading" || syncStatus === "syncing" ? <LoaderCircle size={14} className="spin" /> : syncStatus === "error" ? <CloudOff size={14} /> : <Check size={14} />}
              {syncStatus === "loading" ? "载入中" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "重试同步" : "已同步"}
            </button>
          )}
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
      {configured && syncStatus === "error" && (
        <div className="sync-error" role="alert">
          <CloudOff size={17} />
          <span>{syncMessage ?? "学习记录尚未同步。"}</span>
          <button onClick={retrySync}><RefreshCw size={15} />重试</button>
        </div>
      )}
    </div>
  );
}
