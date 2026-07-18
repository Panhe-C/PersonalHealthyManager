"use client";

import React from "react";
import { useState, type FormEvent } from "react";

export function AccountSettings({ email, timezone }: { email: string; timezone: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Password could not be changed");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed. Existing sessions were signed out; sign in again on your devices.");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Password could not be changed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface panel settings-panel">
      <div className="panel-heading">
        <div>
          <h2>Personal account</h2>
          <p className="page-subtitle">Your identity and login security for Web and Mobile.</p>
        </div>
      </div>

      <div className="grid form-grid settings-form-grid">
        <label className="field">
          Email
          <input value={email} readOnly />
        </label>
        <label className="field">
          Timezone
          <input value={timezone} readOnly />
        </label>
      </div>

      <form className="grid form-grid settings-form-grid" onSubmit={submit}>
        <label className="field field-span">
          Current password
          <input autoComplete="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </label>
        <label className="field">
          New password
          <input autoComplete="new-password" minLength={12} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        </label>
        <label className="field">
          Confirm new password
          <input autoComplete="new-password" minLength={12} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        </label>
        <div className="toolbar field-span">
          <button className="button" type="submit" disabled={saving}>{saving ? "Changing..." : "Change password"}</button>
          {message ? <span className="message" role="status">{message}</span> : null}
          {error ? <span className="message message-error" role="alert">{error}</span> : null}
        </div>
      </form>
    </section>
  );
}
