"use client";

import { useState, type FormEvent } from "react";
import { Activity, CalendarCheck2, HeartPulse, LogIn, Moon } from "lucide-react";

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
        setError("Invalid email or password");
        return;
      }

      window.location.href = "/plan";
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-layout">
        <section className="login-preview" aria-label="Product preview">
          <div className="preview-header">
            <span className="eyebrow">Today&apos;s coaching view</span>
            <h2>Plan around recovery, schedule, and meals.</h2>
            <p className="page-subtitle">
              Sign in to use your own recovery, calendar, training, and meal data.
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
              <h1>Healthy Body Manager</h1>
              <p className="page-subtitle">Sign in to continue</p>
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
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
