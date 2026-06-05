"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
};

const suggestions = [
  "我昨晚没睡好，今天还适合跑吗？",
  "帮我把本周训练写入飞书日历",
  "今天午餐这些菜怎么选？"
];

export function AgentPanel({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [sending, setSending] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!content || sending) return;

    setSending(true);
    setMessage("");
    const optimisticId = `local-${Date.now()}`;
    setMessages((items) => [...items, { id: optimisticId, role: "user", content }]);
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content })
    });
    const body = await response.json();

    if (response.ok) {
      setMessages((items) => [
        ...items,
        { id: `${optimisticId}-assistant`, role: "assistant", content: body.message }
      ]);
    }
    setSending(false);
  }

  return (
    <section className="surface agent-panel">
      <div className="agent-messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state">Ask about today&apos;s training, recovery, schedule, or meal choices.</div>
        ) : (
          messages.map((item) => (
            <div className={item.role === "user" ? "chat-row chat-row-user" : "chat-row"} key={item.id}>
              <span className="chat-avatar" aria-hidden="true">
                {item.role === "user" ? "You" : "AI"}
              </span>
              <div className={item.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble"}>{item.content}</div>
            </div>
          ))
        )}
      </div>

      <div className="agent-suggestions" aria-label="Suggested prompts">
        {suggestions.map((suggestion) => (
          <button className="suggestion-button" type="button" key={suggestion} onClick={() => setMessage(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <form className="agent-composer" onSubmit={send}>
        <label className="field agent-composer-field">
          <span className="sr-only">Message</span>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask about training, recovery, calendar, or meals"
          />
        </label>
        <ActionButton type="submit" disabled={sending || !message.trim()}>
          <Send aria-hidden="true" size={16} /> {sending ? "Sending..." : "Send"}
        </ActionButton>
      </form>
    </section>
  );
}
