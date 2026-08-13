import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000"),
  title: { default: "法语词卡", template: "%s · 法语词卡" },
  description: "按课程学习 A1-A2 法语词汇，用间隔重复稳稳记住每一个词。",
  applicationName: "法语词卡",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "法语词卡" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f3ea",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      {/* Browser writing/grammar extensions may add data-* attributes here
          before React hydrates. The application itself renders stable body
          attributes, so suppress only this known root-level mismatch. */}
      <body suppressHydrationWarning>
        <AppProvider>
          <ServiceWorkerRegister />
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
