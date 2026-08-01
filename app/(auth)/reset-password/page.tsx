"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, KeyRound, LogIn } from "lucide-react";

function ResetPasswordCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setExpired(body?.code === "expired_token");
        setError(body?.error ?? "This reset link is not valid.");
        return;
      }

      setDone(true);
    } catch {
      setError("Could not reach the server. Try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="surface login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <KeyRound aria-hidden="true" size={18} />
          </span>
          <div>
            <span className="eyebrow">Password reset</span>
            <h1>Password changed</h1>
            <p className="page-subtitle">
              Your other devices have been signed out. Sign in again with the new password.
            </p>
          </div>
        </div>

        <Link className="button login-submit" href="/login">
          <LogIn aria-hidden="true" size={18} />
          Go to sign in
        </Link>
      </section>
    );
  }

  if (!token) {
    return (
      <section className="surface login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <CircleAlert aria-hidden="true" size={18} />
          </span>
          <div>
            <span className="eyebrow">Password reset</span>
            <h1>Link not valid</h1>
            <p className="page-subtitle">This reset link is missing its token.</p>
          </div>
        </div>

        <p className="auth-alt">
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      </section>
    );
  }

  return (
    <form className="surface login-card" onSubmit={submit}>
      <div className="login-brand">
        <span className="brand-mark">
          <KeyRound aria-hidden="true" size={18} />
        </span>
        <div>
          <span className="eyebrow">Password reset</span>
          <h1>Choose a new password</h1>
          <p className="page-subtitle">At least 12 characters.</p>
        </div>
      </div>

      <label className="field">
        New password
        <input
          autoComplete="new-password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      <label className="field">
        Repeat the password
        <input
          autoComplete="new-password"
          name="confirmation"
          type="password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
      </label>

      {error ? (
        <p className="message message-error" role="alert">
          {error}
        </p>
      ) : null}

      {expired ? (
        <p className="auth-alt">
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      ) : null}

      <button className="button login-submit" type="submit" disabled={isSubmitting || !password || !confirmation}>
        {isSubmitting ? "Saving..." : "Set the new password"}
      </button>

      <p className="auth-alt">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="login-shell">
      <div className="login-layout login-layout-single">
        <Suspense
          fallback={
            <section className="surface login-card">
              <p className="page-subtitle">Loading...</p>
            </section>
          }
        >
          <ResetPasswordCard />
        </Suspense>
      </div>
    </main>
  );
}
