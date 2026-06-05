"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

export function GoalForm() {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const targetDate = String(form.get("targetDate") ?? "");
    const payload = {
      title: String(form.get("title")),
      type: String(form.get("type")),
      priority: Number(form.get("priority")),
      ...(targetDate ? { targetDate } : {}),
      metrics: {}
    };
    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      event.currentTarget.reset();
      setMessage("Goal saved");
      window.location.reload();
      return;
    }

    setMessage("Goal could not be saved");
  }

  return (
    <form className="surface panel goal-form" onSubmit={submit}>
      <label className="field field-span">
        Goal title
        <input name="title" placeholder="Marathon, fat loss, sleep better" required />
      </label>
      <label className="field">
        Goal type
        <select name="type" defaultValue="primary">
          <option value="primary">Primary</option>
          <option value="short_term_event">Short-term event</option>
          <option value="long_term">Long-term</option>
          <option value="secondary">Secondary</option>
        </select>
      </label>
      <label className="field">
        Priority
        <input name="priority" type="number" min="1" max="10" defaultValue="8" required />
      </label>
      <label className="field field-span">
        Target date
        <input name="targetDate" type="date" />
      </label>
      <div className="field-span toolbar">
        <ActionButton type="submit">
          <Plus aria-hidden="true" size={16} /> Add goal
        </ActionButton>
        {message ? <span className={message === "Goal saved" ? "message" : "message message-error"}>{message}</span> : null}
      </div>
    </form>
  );
}
