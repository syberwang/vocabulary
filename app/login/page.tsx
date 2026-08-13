import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return <section className="empty-state" style={{ minHeight: "calc(100dvh - 170px)" }}><span className="brand-mark" style={{ width: 64, height: 64, borderRadius: 22, marginBottom: 18 }}>fr</span><h1>登录法语词卡</h1><p>本应用仅限受邀账号。我们会向你的邮箱发送一次性登录链接。</p><LoginForm /></section>;
}
