import { loadModelRuntimeConfig, type ModelRuntimeConfig } from "@/src/settings/service";

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

function systemPrompt(intent: AgentIntent) {
  return [
    "You are a personal health management agent inside Healthy Body Manager.",
    "Answer in the user's language. Be practical, concise, and safety-conscious.",
    "Use the user's training, recovery, schedule, and meal context when it is available in the conversation.",
    "Do not claim that you wrote to calendars, changed plans, or fetched external data unless the app explicitly provides that result.",
    `Current routed intent: ${intent}.`
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

async function callAnthropicModel(config: ModelRuntimeConfig, message: string, history: AgentConversationMessage[], intent: AgentIntent) {
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
      system: systemPrompt(intent),
      messages: [...compactHistory(history), { role: "user", content: message }]
    })
  });

  return extractAnthropicMessage(await readModelResponse(response, config.providerLabel));
}

async function callOpenAiCompatibleModel(config: ModelRuntimeConfig, message: string, history: AgentConversationMessage[], intent: AgentIntent) {
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
        { role: "system", content: systemPrompt(intent) },
        ...compactHistory(history),
        { role: "user", content: message }
      ]
    })
  });

  return extractOpenAiCompatibleMessage(await readModelResponse(response, config.providerLabel));
}

async function callConfiguredModel(config: ModelRuntimeConfig, message: string, history: AgentConversationMessage[], intent: AgentIntent) {
  if (config.provider === "anthropic") return callAnthropicModel(config, message, history, intent);
  return callOpenAiCompatibleModel(config, message, history, intent);
}

export async function createAgentResponseForUser(
  userId: string,
  message: string,
  history: AgentConversationMessage[] = []
): Promise<AgentResponse> {
  const fallback = createAgentResponse(message);
  const config = await loadModelRuntimeConfig(userId);

  if (!config) return fallback;

  try {
    return {
      intent: fallback.intent,
      source: "model",
      modelProvider: config.providerLabel,
      modelName: config.modelName,
      message: await callConfiguredModel(config, message, history, fallback.intent)
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Model call failed.";
    return {
      ...fallback,
      error: errorMessage,
      message: `Model call failed, using local guidance instead. ${fallback.message}`
    };
  }
}
