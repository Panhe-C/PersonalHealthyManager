"use client";

import { useState, type FormEvent } from "react";
import { Activity, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("healthy-body-demo");
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
    </main>
  );
}
