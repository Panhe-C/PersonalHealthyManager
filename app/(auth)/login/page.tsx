"use client";

import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";

const fieldStyle = {
  display: "grid",
  gap: 8,
  color: "var(--ink)",
  fontWeight: 600
} as const;

const inputStyle = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--panel)",
  color: "var(--ink)"
} as const;

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
    <main className="page">
      <form
        className="surface"
        onSubmit={submit}
        style={{
          display: "grid",
          gap: 20,
          maxWidth: 420,
          margin: "80px auto",
          padding: 24
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Healthy Body Manager</h1>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>Sign in to continue</p>
        </div>

        <label style={fieldStyle}>
          Email
          <input
            autoComplete="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          Password
          <input
            autoComplete="current-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={inputStyle}
          />
        </label>

        {error ? (
          <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 44,
            border: 0,
            borderRadius: 6,
            background: "var(--accent)",
            color: "#ffffff",
            cursor: isSubmitting ? "wait" : "pointer",
            fontWeight: 700,
            opacity: isSubmitting ? 0.75 : 1
          }}
        >
          <LogIn aria-hidden="true" size={18} />
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
