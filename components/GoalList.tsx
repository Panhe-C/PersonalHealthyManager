"use client";

import React, { useState, type FormEvent } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

export type GoalListItem = {
  id: string;
  title: string;
  type: string;
  priority: number;
  targetDate: string | null;
  targetDateLabel: string | null;
};

function typeLabel(type: string) {
  return type.replaceAll("_", " ");
}

export function GoalList({ goals }: { goals: GoalListItem[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function saveGoal(event: FormEvent<HTMLFormElement>, goalId: string) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const targetDate = String(form.get("targetDate") ?? "");
    const payload = {
      title: String(form.get("title")),
      type: String(form.get("type")),
      priority: Number(form.get("priority")),
      status: "active",
      ...(targetDate ? { targetDate } : {}),
      metrics: {}
    };

    const response = await fetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      window.location.reload();
      return;
    }

    setMessage("Goal could not be updated");
  }

  async function remove(goal: GoalListItem) {
    setMessage("");
    if (!window.confirm(`Remove "${goal.title}" from active goals?`)) {
      return;
    }

    const response = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    if (response.ok) {
      window.location.reload();
      return;
    }

    setMessage("Goal could not be removed");
  }

  if (goals.length === 0) {
    return <div className="empty-state">No active goals yet.</div>;
  }

  return (
    <div className="list goal-list">
      {goals.map((goal, index) => {
        const isEditing = editingId === goal.id;

        return (
          <div className={index === 0 ? "list-row goal-row-primary" : "list-row"} key={goal.id}>
            {isEditing ? (
              <form className="goal-edit-form" onSubmit={(event) => saveGoal(event, goal.id)}>
                <label className="field field-span">
                  Goal title
                  <input name="title" defaultValue={goal.title} required />
                </label>
                <label className="field">
                  Goal type
                  <select name="type" defaultValue={goal.type}>
                    <option value="primary">Primary</option>
                    <option value="short_term_event">Short-term event</option>
                    <option value="long_term">Long-term</option>
                    <option value="secondary">Secondary</option>
                  </select>
                </label>
                <label className="field">
                  Priority
                  <input name="priority" type="number" min="1" max="10" defaultValue={goal.priority} required />
                </label>
                <label className="field field-span">
                  Target date
                  <input name="targetDate" type="date" defaultValue={goal.targetDate ?? ""} />
                </label>
                <div className="field-span toolbar">
                  <ActionButton type="submit">Save changes</ActionButton>
                  <ActionButton variant="secondary" type="button" onClick={() => setEditingId(null)}>
                    <X aria-hidden="true" size={16} /> Cancel
                  </ActionButton>
                </div>
                {message ? <span className="message message-error field-span">{message}</span> : null}
              </form>
            ) : (
              <>
                <div>
                  <strong>{goal.title}</strong>
                  <div className="task-meta">
                    {typeLabel(goal.type)}
                    {goal.targetDateLabel ? ` · ${goal.targetDateLabel}` : ""}
                  </div>
                </div>
                <div className="goal-row-actions">
                  <span className={index === 0 ? "status status-positive" : "status"}>Priority {goal.priority}</span>
                  <button
                    aria-label={`Edit ${goal.title}`}
                    className="icon-button"
                    title={`Edit ${goal.title}`}
                    type="button"
                    onClick={() => setEditingId(goal.id)}
                  >
                    <Pencil aria-hidden="true" size={16} />
                  </button>
                  <button
                    aria-label={`Remove ${goal.title}`}
                    className="icon-button"
                    title={`Remove ${goal.title}`}
                    type="button"
                    onClick={() => remove(goal)}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
