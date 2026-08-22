"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Activity, CalendarCheck2, HeartPulse, Moon, UserPlus } from "lucide-react";
import { useRegistrationAvailability } from "../_components/RegistrationEntry";

const MIN_PASSWORD_LENGTH = 12;

export default function RegisterPage() {
  const registrationEnabled = useRegistrationAvailability();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    if (!acceptTerms) {
      setError("Please review and accept the privacy policy and terms to continue.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          acceptTerms: true
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "Could not create the account. Try again.");
        return;
      }

      const normalizedEmail = body?.email ?? email.trim().toLowerCase();
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      if (!loginResponse.ok) {
        setError("Account created, but automatic sign-in failed. Sign in with your new password.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (registrationEnabled !== true) {
    return (
      <main className="login-shell">
        <div className="login-layout">
          <section className="surface login-card">
            <div className="login-brand">
              <span className="brand-mark"><Activity aria-hidden="true" size={18} /></span>
              <div>
                <span className="eyebrow">邀请制服务</span>
                <h1>{registrationEnabled === false ? "暂未开放注册" : "正在确认注册状态"}</h1>
                <p className="page-subtitle">
                  {registrationEnabled === false
                    ? "当前部署仅允许已配置的账号登录，自助注册未开放。"
                    : "请稍候。"}
                </p>
              </div>
            </div>
            <p className="auth-alt"><Link href="/login">返回登录</Link></p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <div className="login-layout">
        <section className="login-preview" aria-label="Product preview">
          <div className="preview-header">
            <span className="eyebrow">What you get</span>
            <h2>Plan around recovery, schedule, and meals.</h2>
            <p className="page-subtitle">
              Create an account to bring your own recovery, calendar, training, and meal data together.
            </p>
          </div>
          <div className="preview-grid">
            <article className="preview-card preview-card-primary">
              <HeartPulse aria-hidden="true" size={18} />
              <span>Recovery</span>
              <strong>82%</strong>
              <p>Suitable for a moderate session.</p>
            </article>
            <article className="preview-card">
              <Moon aria-hidden="true" size={18} />
              <span>Sleep</span>
              <strong>7.6h</strong>
              <p>Latest synced duration.</p>
            </article>
            <article className="preview-card preview-card-wide">
              <CalendarCheck2 aria-hidden="true" size={18} />
              <span>Next training window</span>
              <strong>Tue 18:00</strong>
              <p>Draft events stay pending until you confirm them.</p>
            </article>
          </div>
        </section>

        <form className="surface login-card" onSubmit={submit}>
            <div className="login-brand">
              <span className="brand-mark">
                <Activity aria-hidden="true" size={18} />
              </span>
              <div>
                <span className="eyebrow">Personal recovery journal</span>
                <h1>Create your account</h1>
                <p className="page-subtitle">Create an account and start immediately</p>
              </div>
            </div>

            <label className="field">
              Email
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
              Password
              <input
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <span className="field-hint">At least {MIN_PASSWORD_LENGTH} characters.</span>
            </label>

            <label className="field">
              Confirm password
              <input
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>

            {error ? (
              <p className="message message-error" role="alert">
                {error}
              </p>
            ) : null}

            <label className="field field-checkbox">
              <input
                type="checkbox"
                name="acceptTerms"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                required
              />
              <span>
                我已阅读并同意
                <Link href="/privacy" target="_blank" rel="noopener">隐私说明</Link>
                与
                <Link href="/terms" target="_blank" rel="noopener">服务条款</Link>。
              </span>
            </label>

            <button className="button login-submit" type="submit" disabled={isSubmitting || !acceptTerms}>
              <UserPlus aria-hidden="true" size={18} />
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>

            <p className="auth-alt">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
        </form>
      </div>
    </main>
  );
}
