"use client";

import React, { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

export type MemoryView = {
  id: string;
  kind: string;
  category: string;
  content: string;
  source: string;
  confidence: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const kindOptions = ["fact", "preference", "routine", "constraint"];
const categoryOptions = ["training", "nutrition", "recovery", "schedule", "general"];

type Draft = { kind: string; category: string; content: string };

const emptyDraft: Draft = { kind: "preference", category: "general", content: "" };

export function AgentMemoryPanel() {
  const [memories, setMemories] = useState<MemoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);

  async function reload() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/agent/memories");
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setMemories(Array.isArray(body) ? (body as MemoryView[]) : []);
    } else {
      setError(body.error ?? "记忆加载失败");
    }
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function submitCreate() {
    if (!draft.content.trim()) return;
    const response = await fetch("/api/agent/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setAdding(false);
      setDraft(emptyDraft);
      await reload();
    } else {
      setError(body.error ?? "新增失败");
    }
  }

  function startEdit(memory: MemoryView) {
    setEditingId(memory.id);
    setEditDraft({ kind: memory.kind, category: memory.category, content: memory.content });
  }

  async function submitEdit(memoryId: string) {
    if (!editDraft.content.trim()) return;
    const response = await fetch(`/api/agent/memories/${memoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editDraft)
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setEditingId("");
      await reload();
    } else {
      setError(body.error ?? "编辑失败");
    }
  }

  async function removeMemory(memoryId: string) {
    const response = await fetch(`/api/agent/memories/${memoryId}`, { method: "DELETE" });
    if (response.ok) {
      await reload();
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "删除失败");
    }
  }

  return (
    <div className="agent-memory-panel">
      <div className="agent-memory-header">
        <span className="agent-memory-title">记忆</span>
        <button
          type="button"
          className="agent-memory-add"
          aria-label="新增记忆"
          onClick={() => {
            setAdding((value) => !value);
            setDraft(emptyDraft);
          }}
        >
          <Plus aria-hidden="true" size={14} />
        </button>
      </div>

      {error ? <div className="agent-memory-error">{error}</div> : null}

      {adding ? (
        <div className="agent-memory-form" role="group" aria-label="新增记忆">
          <select value={draft.kind} onChange={(event) => setDraft((value) => ({ ...value, kind: event.target.value }))}>
            {kindOptions.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <select
            value={draft.category}
            onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))}
          >
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            value={draft.content}
            onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))}
            placeholder="要记住的内容"
          />
          <div className="agent-memory-form-actions">
            <ActionButton type="button" onClick={() => void submitCreate()}>
              保存
            </ActionButton>
            <button type="button" className="agent-memory-cancel" onClick={() => setAdding(false)}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="agent-memory-empty">加载中…</div>
      ) : memories.length === 0 ? (
        <div className="agent-memory-empty">还没有记忆。告诉 agent “记住……”或在上方手动添加。</div>
      ) : (
        <ul className="agent-memory-list">
          {memories.map((memory) => (
            <li key={memory.id} className="agent-memory-item">
              {editingId === memory.id ? (
                <div className="agent-memory-form" role="group" aria-label="编辑记忆">
                  <select
                    value={editDraft.kind}
                    onChange={(event) => setEditDraft((value) => ({ ...value, kind: event.target.value }))}
                  >
                    {kindOptions.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editDraft.category}
                    onChange={(event) => setEditDraft((value) => ({ ...value, category: event.target.value }))}
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <input
                    value={editDraft.content}
                    onChange={(event) => setEditDraft((value) => ({ ...value, content: event.target.value }))}
                  />
                  <div className="agent-memory-form-actions">
                    <button type="button" className="agent-memory-confirm" aria-label="保存" onClick={() => void submitEdit(memory.id)}>
                      <Check aria-hidden="true" size={14} />
                    </button>
                    <button type="button" className="agent-memory-cancel" aria-label="取消" onClick={() => setEditingId("")}>
                      <X aria-hidden="true" size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="agent-memory-content">
                    <span className="agent-memory-tag">{memory.category}</span>
                    <span className="agent-memory-text">{memory.content}</span>
                  </div>
                  <div className="agent-memory-actions">
                    <button type="button" className="agent-memory-edit" aria-label="编辑" onClick={() => startEdit(memory)}>
                      <Pencil aria-hidden="true" size={13} />
                    </button>
                    <button type="button" className="agent-memory-delete" aria-label="删除" onClick={() => void removeMemory(memory.id)}>
                      <Trash2 aria-hidden="true" size={13} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
