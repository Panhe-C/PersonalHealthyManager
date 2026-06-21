import { loadModelRuntimeConfig, type ModelRuntimeConfig } from "@/src/settings/service";
import type { AgentContext } from "@/src/services/agentContext";

export type AgentIntent = "recovery_check" | "calendar_confirmation" | "menu_advice" | "replan" | "general";

export type AgentResponse = {
  intent: AgentIntent;
  message: string;
  source: "model" | "rules";
  modelProvider?: string;
  modelName?: string;
  error?: string;
};

export type AgentConversationMessage = {
  role: string;
  content: string;
};

export function createAgentResponse(message: string): AgentResponse {
  if (/睡|sleep|恢复|recovery/i.test(message)) {
    return {
      intent: "recovery_check",
      source: "rules",
      message:
        "I will check sleep and recovery first. If recovery is low, the plan should downgrade hard training to recovery work."
    };
  }

  if (/日历|calendar|写入|飞书/i.test(message)) {
    return {
      intent: "calendar_confirmation",
      source: "rules",
      message:
        "I can prepare the training calendar drafts for review. Nothing is written until you confirm the drafts."
    };
  }

  if (/午餐|早餐|晚餐|menu|吃/i.test(message)) {
    return {
      intent: "menu_advice",
      source: "rules",
      message: "I will compare today's menu with the training intensity and nutrition targets."
    };
  }

  if (/重新|调整|replan|改/i.test(message)) {
    return {
      intent: "replan",
      source: "rules",
      message: "I can re-run the planning rules with the latest schedule, recovery, and completion data."
    };
  }

  return {
    intent: "general",
    source: "rules",
    message: "Ask me about today's training, menu choices, recovery, or calendar confirmation."
  };
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function compactHistory(history: AgentConversationMessage[]) {
  return history
    .filter((item) => ["user", "assistant"].includes(item.role) && item.content.trim())
    .slice(-8)
    .map((item) => ({ role: item.role as "user" | "assistant", content: item.content.trim() }));
}

function formatAgentContext(context?: AgentContext) {
  if (!context) return "No app context was loaded for this response.";
  const freshSync = context.freshSync.attempted
    ? context.freshSync.succeeded
      ? "Fresh COROS sync succeeded during this request."
      : `Fresh COROS sync failed during this request: ${context.freshSync.error ?? "Unknown error."}`
    : "No live COROS sync was requested during this response.";

  return [freshSync, ...context.sections.map((item) => `## ${item.title}\n${item.content}`)].join("\n\n");
}

function systemPrompt(intent: AgentIntent, context?: AgentContext) {
  return [
    "You are a personal health management agent inside Healthy Body Manager.",
    "Answer in the user's language. Be practical, concise, and safety-conscious.",
    "Use the user's training, recovery, schedule, and meal context when it is available in the conversation.",
    "Use the app context below when it is available. Do not invent missing data.",
    "Do not claim latest COROS data unless the context says fresh COROS sync succeeded during this request.",
    "Do not claim that you wrote to calendars, changed plans, or fetched external data unless the app explicitly provides that result.",
    `Current routed intent: ${intent}.`,
    `App context:\n${formatAgentContext(context)}`
  ].join("\n");
}

function extractOpenAiCompatibleMessage(body: unknown) {
  const content = (body as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  throw new Error("Model response did not include a message.");
}

function extractAnthropicMessage(body: unknown) {
  const parts = (body as { content?: Array<{ type?: string; text?: unknown }> })?.content ?? [];
  const text = parts
    .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  if (text) return text;
  throw new Error("Model response did not include a message.");
}

async function readModelResponse(response: Response, providerLabel: string) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (body as { error?: { message?: unknown } })?.error?.message ??
      (body as { message?: unknown })?.message ??
      `${providerLabel} returned HTTP ${response.status}.`;
    throw new Error(String(message));
  }

  return body;
}

async function callAnthropicModel(
  config: ModelRuntimeConfig,
  message: string,
  history: AgentConversationMessage[],
  intent: AgentIntent,
  context?: AgentContext
) {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.modelName,
      max_tokens: 700,
      system: systemPrompt(intent, context),
      messages: [...compactHistory(history), { role: "user", content: message }]
    })
  });

  return extractAnthropicMessage(await readModelResponse(response, config.providerLabel));
}

async function callOpenAiCompatibleModel(
  config: ModelRuntimeConfig,
  message: string,
  history: AgentConversationMessage[],
  intent: AgentIntent,
  context?: AgentContext
) {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.modelName,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt(intent, context) },
        ...compactHistory(history),
        { role: "user", content: message }
      ]
    })
  });

  return extractOpenAiCompatibleMessage(await readModelResponse(response, config.providerLabel));
}

async function callConfiguredModel(
  config: ModelRuntimeConfig,
  message: string,
  history: AgentConversationMessage[],
  intent: AgentIntent,
  context?: AgentContext
) {
  if (config.provider === "anthropic") return callAnthropicModel(config, message, history, intent, context);
  return callOpenAiCompatibleModel(config, message, history, intent, context);
}

export async function createAgentResponseForUser(
  userId: string,
  message: string,
  history: AgentConversationMessage[] = [],
  context?: AgentContext
): Promise<AgentResponse> {
  const fallback = createAgentResponse(message);
  const config = await loadModelRuntimeConfig(userId);
  const intent = context?.intent ?? fallback.intent;

  if (!config) return fallback;

  try {
    return {
      intent,
      source: "model",
      modelProvider: config.providerLabel,
      modelName: config.modelName,
      message: await callConfiguredModel(config, message, history, intent, context)
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Model call failed.";
    const normalizedErrorMessage = errorMessage.replace(/[.。]+$/, "");
    return {
      ...fallback,
      error: errorMessage,
      message: `Model call failed: ${normalizedErrorMessage}; using local guidance instead. ${fallback.message}`
    };
  }
}
