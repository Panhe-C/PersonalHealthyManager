"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, LogIn, MailCheck, MailWarning } from "lucide-react";

type State =
  | { kind: "verifying" }
  | { kind: "verified"; alreadyVerified: boolean }
  | { kind: "failed"; message: string; expired: boolean };

function VerifyEmailCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "verifying" });
  const [email, setEmail] = useState("");
  const [resendNotice, setResendNotice] = useState("");
  const [isResending, setIsResending] = useState(false);
  // React 18 mounts effects twice in development; the token is single-use, so
  // the second run must not report the first one's consumption as a failure.
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    if (!token) {
      setState({ kind: "failed", message: "This verification link is missing its token.", expired: false });
      return;
    }

    (async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          setState({
            kind: "failed",
            message: body?.error ?? "This verification link is not valid.",
            expired: body?.code === "expired_token"
          });
          return;
        }

        setState({ kind: "verified", alreadyVerified: Boolean(body?.alreadyVerified) });
      } catch {
        setState({
          kind: "failed",
          message: "Could not reach the server. Try opening the link again.",
          expired: false
        });
      }
    })();
  }, [token]);

  async function resend() {
    setIsResending(true);
    setResendNotice("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      setResendNotice(
        response.ok
          ? "If that address needs verifying, a new link is on its way."
          : "Too many requests just now. Wait a few minutes before trying again."
      );
    } catch {
      setResendNotice("Could not reach the server. Try again later.");
    } finally {
      setIsResending(false);
    }
  }

  if (state.kind === "verifying") {
    return (
      <section className="surface login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <MailCheck aria-hidden="true" size={18} />
          </span>
          <div>
            <span className="eyebrow">Email verification</span>
            <h1>Verifying...</h1>
            <p className="page-subtitle">Confirming your link.</p>
          </div>
        </div>
      </section>
    );
  }

  if (state.kind === "verified") {
    return (
      <section className="surface login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <MailCheck aria-hidden="true" size={18} />
          </span>
          <div>
            <span className="eyebrow">Email verification</span>
            <h1>{state.alreadyVerified ? "Already verified" : "Email verified"}</h1>
            <p className="page-subtitle">
              {state.alreadyVerified
                ? "This address was confirmed earlier. You can sign in."
                : "Your account is active. Sign in to get started."}
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

  return (
    <section className="surface login-card">
      <div className="login-brand">
        <span className="brand-mark">
          {state.expired ? <MailWarning aria-hidden="true" size={18} /> : <CircleAlert aria-hidden="true" size={18} />}
        </span>
        <div>
          <span className="eyebrow">Email verification</span>
          <h1>{state.expired ? "Link expired" : "Link not valid"}</h1>
          <p className="page-subtitle">{state.message}</p>
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
        />
        <span className="field-hint">Enter the address you signed up with to get a new link.</span>
      </label>

      {resendNotice ? (
        <p className="message" role="status">
          {resendNotice}
        </p>
      ) : null}

      <button className="button" type="button" onClick={resend} disabled={isResending || !email}>
        {isResending ? "Sending..." : "Send a new link"}
      </button>

      <p className="auth-alt">
        <Link href="/login">Back to sign in</Link>
      </p>
    </section>
  );
}

export default function VerifyEmailPage() {
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
          <VerifyEmailCard />
        </Suspense>
      </div>
    </main>
  );
}
