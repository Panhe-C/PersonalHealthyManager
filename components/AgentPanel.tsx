"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { AgentMemoryPanel } from "@/components/AgentMemoryPanel";

type AdjustmentRef = { id: string; label: string; undoneAt: string | null };

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  adjustments?: AdjustmentRef[];
};

type AgentConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

type AgentPanelProps = {
  initialConversations: AgentConversationSummary[];
  initialConversationId: string;
  initialMessages: ChatMessage[];
};

const fallbackSuggestions = [
  "我昨晚没睡好，今天还适合跑吗？",
  "帮我把本周训练写入飞书日历",
  "今天午餐这些菜怎么选？"
];

const suggestionGroups = {
  truncated: ["重新生成这次完整分析", "拉取最新 COROS 数据后再分析", "总结最需要调整的三件事"],
  recovery: ["我昨晚没睡好，今天还适合跑吗？", "今天改成恢复训练可以吗？", "看下最近 HRV 和静息心率"],
  training: ["拉取最新 COROS 数据后再分析", "给我下周跑步安排", "哪些训练需要降低强度？"],
  calendar: ["帮我把本周训练写入飞书日历", "查看明天有哪些训练空档", "生成下周训练日历草稿"],
  meal: ["今天午餐这些菜怎么选？", "训练日前后怎么吃？", "帮我按蛋白质优先选餐"],
  replan: ["按恢复状态调整本周计划", "把高强度训练挪到哪天？", "重新生成更保守的计划"]
};

function uniqueSuggestions(items: string[]) {
  return Array.from(new Set(items)).slice(0, 3);
}

function buildSuggestions(messages: ChatMessage[]) {
  const recentMessages = messages.slice(-6);
  const recentText = recentMessages.map((item) => item.content).join("\n").toLowerCase();
  const latestAssistant = [...recentMessages].reverse().find((item) => item.role === "assistant");

  if (latestAssistant && isLikelyTruncatedAssistantContent(latestAssistant.content)) {
    return suggestionGroups.truncated;
  }

  if (/飞书|日历|calendar|空档|写入|草稿|安排到|预约/.test(recentText)) {
    return suggestionGroups.calendar;
  }

  if (/睡|hrv|静息|压力|没睡好|恢复状态|恢复情况|recovery/.test(recentText)) {
    return uniqueSuggestions([...suggestionGroups.recovery, ...suggestionGroups.replan]);
  }

  if (/午餐|晚餐|早餐|菜|饮食|蛋白|碳水|meal|吃/.test(recentText)) {
    return suggestionGroups.meal;
  }

  if (/运动|训练|跑|跑步|强度|配速|coros|负荷|马拉松|周计划|计划/.test(recentText)) {
    return uniqueSuggestions([...suggestionGroups.training, ...suggestionGroups.replan]);
  }

  return fallbackSuggestions;
}

function normalizeMarkdown(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+---[ \t]+(#{1,4}[ \t]+)/g, "\n---\n$1")
    .replace(/([^\n])([ \t]+#{2,4}[ \t]+)/g, "$1\n$2");
}

function renderInline(text: string) {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    if (match[2]) {
      nodes.push(
        <strong className="rich-strong" key={`${match.index}-strong`}>
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      nodes.push(
        <code className="rich-code" key={`${match.index}-code`}>
          {match[3]}
        </code>
      );
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes.length > 0 ? nodes : text;
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableLine(line: string) {
  const value = line.trim();
  return value.startsWith("|") && value.endsWith("|") && parseTableRow(value).length > 1;
}

function isTableDivider(line: string) {
  const cells = parseTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isLikelyTruncatedAssistantContent(content: string) {
  if (content.includes("|")) return false;

  const plain = content
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();

  if (plain.length === 0 || plain.length > 120) return false;
  if (/[。.!！？?）)]$/.test(plain)) return false;
  return /以下是|分析|这一周|本周|建议|概览/.test(plain);
}

function RichMessageContent({ content }: { content: string }) {
  if (isLikelyTruncatedAssistantContent(content)) {
    return (
      <div className="rich-message-content">
        <p className="rich-truncated">这条回复生成时被截断了，请重新发送问题以获取完整分析。</p>
      </div>
    );
  }

  const lines = normalizeMarkdown(content).split("\n");
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      blocks.push(
        <p className="rich-paragraph" key={`p-${blocks.length}`}>
          {renderInline(text)}
        </p>
      );
    }
    paragraph = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      flushParagraph();
      blocks.push(<hr className="rich-divider" key={`hr-${blocks.length}`} />);
      continue;
    }

    const headingMatch = /^(#{2,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      const HeadingTag = headingMatch[1].length === 2 ? "h2" : "h3";
      blocks.push(
        <HeadingTag className="rich-heading" key={`h-${blocks.length}`}>
          {renderInline(headingMatch[2].trim())}
        </HeadingTag>
      );
      continue;
    }

    if (/^```/.test(line)) {
      flushParagraph();
      const fenceLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        fenceLines.push(lines[index]);
        index += 1;
      }
      blocks.push(
        <pre className="rich-code-block" key={`code-${blocks.length}`}>
          <code>{fenceLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (isTableLine(line) && lines[index + 1] && isTableDivider(lines[index + 1])) {
      flushParagraph();
      const headers = parseTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableLine(lines[index])) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      index -= 1;

      if (rows.length === 0) {
        blocks.push(
          <div className="rich-table-empty" key={`table-empty-${blocks.length}`}>
            <strong>{headers.join(" / ")}</strong>
            <span>这张表没有提供明细。</span>
          </div>
        );
        continue;
      }

      blocks.push(
        <div className="rich-table-wrap" key={`table-${blocks.length}`}>
          <table className="rich-table">
            <thead>
              <tr>
                {headers.map((header, headerIndex) => (
                  <th key={`${header}-${headerIndex}`}>{renderInline(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>{renderInline(row[cellIndex] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      index -= 1;
      blocks.push(
        <ul className="rich-list" key={`ul-${blocks.length}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return <div className="rich-message-content">{blocks}</div>;
}

export function AgentPanel({ initialConversations, initialConversationId, initialMessages }: AgentPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState(initialConversationId);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState("");
  const [deletingConversationId, setDeletingConversationId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const suggestions = useMemo(() => buildSuggestions(messages), [messages]);

  async function undoAdjustment(messageId: string, adjustmentId: string) {
    const response = await fetch(`/api/agent/adjustments/${adjustmentId}/undo`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "撤销失败");
      return;
    }
    const body = await response.json();
    setMessages((items) =>
      items.map((item) =>
        item.id === messageId
          ? {
              ...item,
              adjustments: item.adjustments?.map((adjustment) =>
                adjustment.id === adjustmentId ? { ...adjustment, undoneAt: body.undoneAt } : adjustment
              )
            }
          : item
      )
    );
    router.refresh();
  }

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;

    if (typeof messagesElement.scrollTo === "function") {
      messagesElement.scrollTo({ top: messagesElement.scrollHeight });
    } else {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    }
  }, [messages.length]);

  async function loadConversation(conversationId: string) {
    setLoadingConversation(true);
    setError("");
    const response = await fetch(`/api/agent/conversations/${conversationId}`);
    const body = await response.json();
    if (response.ok) {
      setSelectedConversationId(body.id);
      setMessages(body.messages);
      setConversations((items) =>
        items.map((item) => (item.id === body.id ? { id: body.id, title: body.title, updatedAt: body.updatedAt } : item))
      );
    } else {
      setError(body.error ?? "Conversation could not be loaded.");
    }
    setLoadingConversation(false);
  }

  async function selectConversation(conversationId: string) {
    if (conversationId === selectedConversationId || loadingConversation) return;
    setConfirmingDeleteId("");
    await loadConversation(conversationId);
  }

  async function createConversation() {
    setLoadingConversation(true);
    setError("");
    const response = await fetch("/api/agent/conversations", { method: "POST" });
    const body = await response.json();
    if (response.ok) {
      const conversation = { id: body.id, title: body.title, updatedAt: body.updatedAt };
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
      setSelectedConversationId(body.id);
      setMessages(body.messages);
      setMessage("");
    } else {
      setError(body.error ?? "Conversation could not be created.");
    }
    setLoadingConversation(false);
  }

  async function deleteConversation(conversationId: string) {
    if (deletingConversationId) return;

    setDeletingConversationId(conversationId);
    setError("");
    const response = await fetch(`/api/agent/conversations/${conversationId}`, { method: "DELETE" });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? "Conversation could not be deleted.");
      setDeletingConversationId("");
      return;
    }

    const remaining = conversations.filter((item) => item.id !== conversationId);
    setConversations(remaining);
    setConfirmingDeleteId("");
    setDeletingConversationId("");

    if (conversationId !== selectedConversationId) return;
    if (remaining.length > 0) {
      await loadConversation(remaining[0].id);
      return;
    }

    setSelectedConversationId("");
    setMessages([]);
    await createConversation();
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || sending || !selectedConversationId) return;

    setSending(true);
    setError("");
    setMessage("");
    const optimisticId = `local-${Date.now()}`;
    setMessages((items) => [...items, { id: optimisticId, role: "user", content }]);
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedConversationId, message: content })
    });
    const body = await response.json();

    if (response.ok) {
      setMessages((items) => [
        ...items,
        {
          id: `${optimisticId}-assistant`,
          role: "assistant",
          content: body.message,
          adjustments: Array.isArray(body.adjustments) ? body.adjustments : undefined
        }
      ]);
      if (body.conversation) {
        setConversations((items) => [body.conversation, ...items.filter((item) => item.id !== body.conversation.id)]);
      }
    } else {
      setError(body.error ?? "Message could not be sent.");
    }
    setSending(false);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(message);
  }

  return (
    <section className="agent-workspace">
      <aside className="agent-conversation-rail" aria-label="Agent conversations">
        <button className="agent-new-chat" type="button" onClick={createConversation} disabled={loadingConversation}>
          New chat
        </button>
        <div className="agent-conversation-list">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={conversation.id === selectedConversationId ? "agent-conversation-item active" : "agent-conversation-item"}
            >
              <button
                type="button"
                className="agent-conversation-select"
                aria-pressed={conversation.id === selectedConversationId}
                onClick={() => selectConversation(conversation.id)}
              >
                <span>{conversation.title}</span>
              </button>
              <button
                type="button"
                className="agent-conversation-delete"
                aria-label={`Delete conversation ${conversation.title}`}
                aria-expanded={confirmingDeleteId === conversation.id}
                onClick={() => setConfirmingDeleteId((value) => (value === conversation.id ? "" : conversation.id))}
                disabled={Boolean(deletingConversationId)}
              >
                <Trash2 aria-hidden="true" size={15} />
              </button>
              {confirmingDeleteId === conversation.id ? (
                <div className="agent-delete-confirm" role="group" aria-label={`Delete ${conversation.title} confirmation`}>
                  <span>Delete this chat?</span>
                  <button
                    type="button"
                    className="agent-delete-confirm-button"
                    aria-label={`Confirm delete ${conversation.title}`}
                    onClick={() => deleteConversation(conversation.id)}
                    disabled={deletingConversationId === conversation.id}
                  >
                    {deletingConversationId === conversation.id ? "Deleting" : "Delete"}
                  </button>
                  <button type="button" className="agent-delete-cancel-button" onClick={() => setConfirmingDeleteId("")}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <AgentMemoryPanel />
      </aside>

      <section className="surface agent-panel">
        {error ? <div className="message message-error">{error}</div> : null}
        <div className="agent-messages agent-messages-scroll" aria-label="Conversation messages" aria-live="polite" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="empty-state">Ask about today&apos;s training, recovery, schedule, or meal choices.</div>
          ) : (
            messages.map((item) => (
              <div
                aria-label={item.role === "user" ? "User message" : "AI message"}
                className={item.role === "user" ? "chat-row chat-row-user" : "chat-row chat-row-assistant"}
                key={item.id}
              >
                <span
                  className={item.role === "user" ? "chat-avatar chat-avatar-user" : "chat-avatar chat-avatar-assistant"}
                  aria-hidden="true"
                >
                  {item.role === "user" ? "You" : "AI"}
                </span>
                <div className={item.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-assistant"}>
                  {item.role === "assistant" ? <RichMessageContent content={item.content} /> : item.content}
                  {item.role === "assistant" && item.adjustments?.length
                    ? item.adjustments.map((adjustment) => (
                        <div className="agent-adjustment-row" key={adjustment.id}>
                          <span className="agent-adjustment-label">{adjustment.label}</span>
                          {adjustment.undoneAt ? (
                            <span className="agent-adjustment-undone">已撤销</span>
                          ) : (
                            <button
                              type="button"
                              className="agent-undo-button"
                              aria-label="撤销"
                              onClick={() => undoAdjustment(item.id, adjustment.id)}
                            >
                              撤销
                            </button>
                          )}
                        </div>
                      ))
                    : null}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="agent-suggestions" aria-label="Suggested prompts">
          {suggestions.map((suggestion) => (
            <button
              className="suggestion-button"
              type="button"
              key={suggestion}
              onClick={() => sendMessage(suggestion)}
              disabled={sending || !selectedConversationId}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form className="agent-composer agent-composer-dock" aria-label="Message composer" onSubmit={send}>
          <label className="field agent-composer-field">
            <span className="sr-only">Message</span>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about training, recovery, calendar, or meals"
            />
          </label>
          <ActionButton type="submit" disabled={sending || !message.trim() || !selectedConversationId}>
            <Send aria-hidden="true" size={16} /> {sending ? "Sending..." : "Send"}
          </ActionButton>
        </form>
      </section>
    </section>
  );
}
