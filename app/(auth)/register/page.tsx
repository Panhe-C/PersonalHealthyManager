"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Activity, CalendarCheck2, HeartPulse, MailCheck, Moon, UserPlus } from "lucide-react";

const MIN_PASSWORD_LENGTH = 12;

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendNotice, setResendNotice] = useState("");

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

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "Could not create the account. Try again.");
        return;
      }

      setSentTo(body?.email ?? email.trim().toLowerCase());
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resend() {
    setIsResending(true);
    setResendNotice("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sentTo })
      });

      setResendNotice(
        response.ok
          ? "Sent again. Check your inbox."
          : "Too many requests just now. Wait a few minutes before trying again."
      );
    } catch {
      setResendNotice("Could not reach the server. Try again later.");
    } finally {
      setIsResending(false);
    }
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

        {sentTo ? (
          <section className="surface login-card">
            <div className="login-brand">
              <span className="brand-mark">
                <MailCheck aria-hidden="true" size={18} />
              </span>
              <div>
                <span className="eyebrow">Almost there</span>
                <h1>Check your inbox</h1>
                <p className="page-subtitle">
                  If <strong>{sentTo}</strong> can have an account, a verification link is on its way. The link is
                  valid for 24 hours.
                </p>
              </div>
            </div>

            {resendNotice ? (
              <p className="message" role="status">
                {resendNotice}
              </p>
            ) : null}

            <button
              className="button button-secondary"
              type="button"
              onClick={resend}
              disabled={isResending}
            >
              {isResending ? "Sending..." : "Send the email again"}
            </button>

            <p className="auth-alt">
              Already verified? <Link href="/login">Sign in</Link>
            </p>
          </section>
        ) : (
          <form className="surface login-card" onSubmit={submit}>
            <div className="login-brand">
              <span className="brand-mark">
                <Activity aria-hidden="true" size={18} />
              </span>
              <div>
                <span className="eyebrow">Personal recovery journal</span>
                <h1>Create your account</h1>
                <p className="page-subtitle">Verify your email, then sign in</p>
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

            <button className="button login-submit" type="submit" disabled={isSubmitting}>
              <UserPlus aria-hidden="true" size={18} />
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>

            <p className="auth-alt">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
