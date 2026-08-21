"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Activity, CalendarCheck2, HeartPulse, LogIn, Moon } from "lucide-react";
import { RegistrationEntry } from "../_components/RegistrationEntry";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        setError("邮箱或密码不正确");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("邮箱或密码不正确");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-layout">
        <section className="login-preview" aria-label="Product preview">
          <div className="preview-header">
            <span className="eyebrow">今日教练视图</span>
            <h2>围绕恢复、日程与饮食做计划。</h2>
            <p className="page-subtitle">
              登录后使用你自己的恢复、日历、训练与饮食数据。
            </p>
          </div>
          <div className="preview-grid">
            <article className="preview-card preview-card-primary">
              <HeartPulse aria-hidden="true" size={18} />
              <span>恢复</span>
              <strong>82%</strong>
              <p>适合一次中等强度训练。</p>
            </article>
            <article className="preview-card">
              <Moon aria-hidden="true" size={18} />
              <span>睡眠</span>
              <strong>7.6h</strong>
              <p>最近一次同步时长。</p>
            </article>
            <article className="preview-card preview-card-wide">
              <CalendarCheck2 aria-hidden="true" size={18} />
              <span>下一个训练窗口</span>
              <strong>周二 18:00</strong>
              <p>草稿事件需你确认后才会写入日历。</p>
            </article>
          </div>
        </section>

        <form className="surface login-card" onSubmit={submit}>
          <div className="login-brand">
            <span className="brand-mark">
              <Activity aria-hidden="true" size={18} />
            </span>
            <div>
              <span className="eyebrow">个人恢复日记</span>
              <h1>健康身体管家</h1>
              <p className="page-subtitle">登录以继续</p>
            </div>
          </div>

          <label className="field">
            邮箱
            <input
              autoComplete="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field">
            密码
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? (
            <p className="message message-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="button login-submit" type="submit" disabled={isSubmitting}>
            <LogIn aria-hidden="true" size={18} />
            {isSubmitting ? "登录中…" : "登录"}
          </button>

          <p className="auth-alt">
            <Link href="/forgot-password">忘记密码？</Link>
          </p>

          <RegistrationEntry />
        </form>
      </div>
    </main>
  );
}
