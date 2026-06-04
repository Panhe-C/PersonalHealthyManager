"use client";

import clsx from "clsx";
import { useState } from "react";
import { CircleSlash2 } from "lucide-react";

type ChecklistItem = {
  id: string;
  label: string;
  status: string;
};

export function Checklist({ taskId, items }: { taskId: string; items: ChecklistItem[] }) {
  const [localItems, setLocalItems] = useState(items);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function update(itemId: string, status: "pending" | "completed" | "skipped") {
    const nextItems = localItems.map((item) => (item.id === itemId ? { ...item, status } : item));
    setLocalItems(nextItems);
    setSavingId(itemId);
    const response = await fetch(`/api/training/tasks/${taskId}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: nextItems.map((item) => ({
          id: item.id,
          label: item.label,
          status: item.status
        }))
      })
    });

    if (response.ok) {
      window.location.reload();
      return;
    }

    setSavingId(null);
  }

  return (
    <div className="checklist">
      {localItems.map((item) => (
        <div className="checklist-row" key={item.id}>
          <input
            aria-label={`Complete ${item.label}`}
            type="checkbox"
            checked={item.status === "completed"}
            disabled={savingId !== null}
            onChange={(event) => update(item.id, event.target.checked ? "completed" : "pending")}
          />
          <span className={clsx("checklist-label", item.status === "completed" && "checklist-label-completed")}>{item.label}</span>
          {item.status === "skipped" ? <span className="status status-warn">Skipped</span> : null}
          <button
            aria-label={`Skip ${item.label}`}
            className="icon-button"
            title="Mark skipped"
            type="button"
            disabled={savingId !== null}
            onClick={() => update(item.id, item.status === "skipped" ? "pending" : "skipped")}
          >
            <CircleSlash2 aria-hidden="true" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
