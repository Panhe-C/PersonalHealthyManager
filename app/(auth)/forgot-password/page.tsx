"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(
          body?.code === "rate_limited"
            ? "Too many requests just now. Wait a few minutes before trying again."
            : "Could not send the reset email. Try again later."
        );
        return;
      }

      setSent(true);
    } catch {
      setError("Could not reach the server. Try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <main className="login-shell">
        <div className="login-layout login-layout-single">
          <section className="surface login-card">
            <div className="login-brand">
              <span className="brand-mark">
                <MailCheck aria-hidden="true" size={18} />
              </span>
              <div>
                <span className="eyebrow">Password reset</span>
                <h1>Check your inbox</h1>
                {/* Deliberately says nothing about whether the address exists. */}
                <p className="page-subtitle">
                  If that address has a verified account, a reset link is on its way. It expires in an hour.
                </p>
              </div>
            </div>

            <p className="auth-alt">
              <Link href="/login">Back to sign in</Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <div className="login-layout login-layout-single">
        <form className="surface login-card" onSubmit={submit}>
          <div className="login-brand">
            <span className="brand-mark">
              <KeyRound aria-hidden="true" size={18} />
            </span>
            <div>
              <span className="eyebrow">Password reset</span>
              <h1>Forgot your password?</h1>
              <p className="page-subtitle">We will email you a link to choose a new one.</p>
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
              placeholder="you@example.com"
              required
            />
          </label>

          {error ? (
            <p className="message message-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="button login-submit" type="submit" disabled={isSubmitting || !email}>
            {isSubmitting ? "Sending..." : "Send the reset link"}
          </button>

          <p className="auth-alt">
            <Link href="/login">Back to sign in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
