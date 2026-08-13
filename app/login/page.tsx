import { LoginForm } from "@/components/login-form";

export const metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <section className="empty-state" style={{ minHeight: "calc(100dvh - 170px)" }}>
      <span className="brand-mark" style={{ width: 64, height: 64, borderRadius: 22, marginBottom: 18 }}>fr</span>
      <h1>登录法语词卡</h1>
      <p>请输入服务器中配置的固定账号和密码。</p>
      <LoginForm />
    </section>
  );
}
