"use client";

import React from "react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
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

const suggestions = [
  "我昨晚没睡好，今天还适合跑吗？",
  "帮我把本周训练写入飞书日历",
  "今天午餐这些菜怎么选？"
];

export function AgentPanel({ initialConversations, initialConversationId, initialMessages }: AgentPanelProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState(initialConversationId);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;

    if (typeof messagesElement.scrollTo === "function") {
      messagesElement.scrollTo({ top: messagesElement.scrollHeight });
    } else {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    }
  }, [messages.length]);

  async function selectConversation(conversationId: string) {
    if (conversationId === selectedConversationId || loadingConversation) return;
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

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
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
        { id: `${optimisticId}-assistant`, role: "assistant", content: body.message }
      ]);
      if (body.conversation) {
        setConversations((items) => [body.conversation, ...items.filter((item) => item.id !== body.conversation.id)]);
      }
    } else {
      setError(body.error ?? "Message could not be sent.");
    }
    setSending(false);
  }

  return (
    <section className="agent-workspace">
      <aside className="agent-conversation-rail" aria-label="Agent conversations">
        <button className="agent-new-chat" type="button" onClick={createConversation} disabled={loadingConversation}>
          New chat
        </button>
        <div className="agent-conversation-list">
          {conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className={conversation.id === selectedConversationId ? "agent-conversation-item active" : "agent-conversation-item"}
              aria-pressed={conversation.id === selectedConversationId}
              onClick={() => selectConversation(conversation.id)}
            >
              <span>{conversation.title}</span>
            </button>
          ))}
        </div>
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
                  {item.content}
                </div>
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
