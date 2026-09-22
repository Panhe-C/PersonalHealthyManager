import { loadModelRuntimeConfig, type ModelRuntimeConfig } from "@/src/settings/service";
import { getProviderCredentialSource } from "@/src/settings/defaults";
import type { AgentContext } from "@/src/services/agentContext";
import { actionIdList } from "@/src/services/agentActions/registry";
import { readSseEvents } from "@/src/services/agentStreaming/sse";
import { createVisibleTextFilter } from "@/src/services/agentStreaming/visibleText";
import { anthropicUserContent, openAiUserContent } from "@/src/services/agentAttachments";
import type { AgentAttachment } from "@hbm/contracts";

export type AgentIntent = "recovery_check" | "calendar_confirmation" | "menu_advice" | "replan" | "training_analysis" | "general";

export type AgentResponse = {
  intent: AgentIntent;
  message: string;
  source: "model" | "rules";
  modelProvider?: string;
  modelName?: string;
  error?: string;
  /** True when the model hit its output token limit; partial text may still be usable. */
  truncated?: boolean;
};

/** Default completion budget for coach replies (raised to reduce mid-answer cutoffs). */
export const DEFAULT_AGENT_MAX_TOKENS = 8192;

class IncompleteModelResponseError extends Error {
  readonly partialContent: string;

  constructor(message: string, partialContent: string) {
    super(message);
    this.name = "IncompleteModelResponseError";
    this.partialContent = partialContent;
  }
}

function isIncompleteModelResponseError(error: unknown): error is IncompleteModelResponseError {
  return error instanceof IncompleteModelResponseError;
}

export type AgentConversationMessage = {
  role: string;
  content: string;
};

export function createAgentResponse(
  message: string,
  history: AgentConversationMessage[] = []
): AgentResponse {
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

  if (/运动|训练|跑步|跑量|workout|exercise|activity|running/i.test(message)) {
    return {
      intent: "training_analysis",
      source: "rules",
      message: "I will analyze your recent training load, activity mix, distance, duration, and heart-rate signals."
    };
  }

  const fallback: AgentResponse = {
    intent: "general",
    source: "rules",
    message: "Ask me about today's training, menu choices, recovery, or calendar confirmation."
  };

  if (/coros|高驰|mcp|继续查|再查|查一下|看一下/i.test(message)) {
    const priorUserMessage = [...history]
      .reverse()
      .find((item) => item.role === "user" && item.content.trim());
    if (priorUserMessage) {
      const prior = createAgentResponse(priorUserMessage.content);
      if (prior.intent === "recovery_check" || prior.intent === "training_analysis") {
        return { ...fallback, intent: prior.intent };
      }
    }
  }

  return fallback;
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

function intentInstructions(intent: AgentIntent) {
  const instructions: Record<AgentIntent, string[]> = {
    recovery_check: [
      "Recovery check instructions:",
      "prioritize sleep quality, recovery score, HRV, resting heart rate, and recent hard sessions.",
      "If recovery signals are weak, recommend lower intensity, shorter duration, or rest before hard training."
    ],
    training_analysis: [
      "Training analysis instructions:",
      "Summarize patterns across recent activities instead of only listing workouts.",
      "Call out load, intensity mix, distance, duration, and heart-rate signals when the context provides them."
    ],
    calendar_confirmation: [
      "Calendar confirmation instructions:",
      "Explain proposed calendar drafts and the confirmation step.",
      "Never say a calendar event was written unless the app context explicitly reports a completed write."
    ],
    menu_advice: [
      "Menu advice instructions:",
      "Connect meal advice to training intensity, recovery state, and nutrition targets when those are available.",
      "Avoid medical claims or weight-loss promises."
    ],
    replan: [
      "Replanning instructions:",
      "Use schedule, recovery, completion, and plan context to suggest conservative plan adjustments.",
      "Describe what should change and why; do not claim the plan changed unless the app provides that result."
    ],
    general: [
      "General instructions:",
      "Answer the immediate question, then guide the user toward syncing data or asking about training, recovery, meals, or calendar confirmation if useful."
    ]
  };

  return instructions[intent].join("\n");
}

function systemPrompt(intent: AgentIntent, context?: AgentContext) {
  return [
    "You are a personal health management agent inside Healthy Body Manager.",
    "Answer in the user's language. Be practical, concise, and safety-conscious.",
    "Use the user's training, recovery, schedule, and meal context when it is available in the conversation.",
    "Use the app context below when it is available. Do not invent missing data.",
    "Do not claim latest COROS data unless the context says fresh COROS sync succeeded during this request.",
    "If fresh sync failed but cached app records are present, analyze the cached records and clearly mention that the live refresh failed.",
    "Do not claim that you wrote to calendars, changed plans, or fetched external data unless the app explicitly provides that result.",
    "Both clients render Markdown as rich text, so structure anything longer than a couple of sentences: '##' for section headings, '-' for bullets, '**' around the numbers that matter.",
    "Prefer a Markdown table over a run-on sentence whenever you report the same metrics across several days or items.",
    "If you use a table, include at least one data row; otherwise use a short bullet list instead of an empty table.",
    `You may propose actions only from this list: ${actionIdList().join(", ")}.`,
    "Do not invent action ids or arguments.",
    "Always put user-facing text first inside one <explanation>...</explanation> block.",
    "Put any actions after the explanation in a single <actions> JSON array block.",
    "All listed actions execute immediately and are undoable by the user; never claim an irreversible external write unless the app reports it.",
    "If a safety rule overrides your proposal, tell the user truthfully what was changed and why.",
    "You have long-term memory. The 'User memory' section lists facts/preferences you have already saved about this user.",
    "When the user explicitly asks you to remember something (e.g. 记住/记下/别忘了/remember), you MUST emit a memory add entry.",
    "When the user reveals a durable fact, preference, routine, or constraint, you MAY emit a memory add entry with confidence >= 0.6.",
    "When the user corrects a previously remembered fact, emit a memory update entry with targetContent naming the old fact.",
    "Do not memorize transient state (today's mood, one-off status). Only memorize durable facts/preferences/constraints.",
    "Put memory proposals in a single <memories> JSON array block, separate from <actions>. Each item has: op (add|update|delete), kind (fact|preference|routine|constraint), category (training|nutrition|recovery|schedule|general), content, confidence (0..1), and targetContent for update/delete.",
    "If there is nothing worth remembering, omit the <memories> block entirely.",
    `Current routed intent: ${intent}.`,
    intentInstructions(intent),
    `App context:\n${formatAgentContext(context)}`
  ].join("\n");
}

function extractOpenAiCompatibleMessage(body: unknown, providerLabel: string) {
  const choice = (body as { choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }> })?.choices?.[0];
  const content = choice?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";

  if (choice?.finish_reason === "length") {
    throw new IncompleteModelResponseError(
      `${providerLabel} response was cut off before completion.`,
      text
    );
  }

  if (text) return text;
  throw new Error("Model response did not include a message.");
}

function extractAnthropicMessage(body: unknown, providerLabel: string) {
  const parts = (body as { content?: Array<{ type?: string; text?: unknown }> })?.content ?? [];
  const text = parts
    .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if ((body as { stop_reason?: unknown })?.stop_reason === "max_tokens") {
    throw new IncompleteModelResponseError(
      `${providerLabel} response was cut off before completion.`,
      text
    );
  }

  if (text) return text;
  throw new Error("Model response did not include a message.");
}

async function readModelResponse(response: Response, config: ModelRuntimeConfig) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = String(
      (body as { error?: { message?: unknown } })?.error?.message ??
        (body as { message?: unknown })?.message ??
        `${config.providerLabel} returned HTTP ${response.status}.`
    );

    // A rejected key reads the same whether it is expired or simply issued by a
    // neighbouring product, so name the platform that can issue a working one.
    if (response.status === 401 || response.status === 403) {
      const source = getProviderCredentialSource(config.provider);
      throw new Error(
        source ? `${config.providerLabel} rejected the API key: ${message}. ${source}` : message
      );
    }

    throw new Error(message);
  }

  return body;
}

async function callAnthropicModel(
  config: ModelRuntimeConfig,
  message: string,
  history: AgentConversationMessage[],
  intent: AgentIntent,
  context?: AgentContext,
  attachments: AgentAttachment[] = []
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
      max_tokens: DEFAULT_AGENT_MAX_TOKENS,
      system: systemPrompt(intent, context),
      messages: [...compactHistory(history), { role: "user", content: anthropicUserContent(message, attachments) }]
    })
  });

  return extractAnthropicMessage(await readModelResponse(response, config), config.providerLabel);
}

async function callOpenAiCompatibleModel(
  config: ModelRuntimeConfig,
  message: string,
  history: AgentConversationMessage[],
  intent: AgentIntent,
  context?: AgentContext,
  attachments: AgentAttachment[] = []
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
      max_tokens: DEFAULT_AGENT_MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt(intent, context) },
        ...compactHistory(history),
        { role: "user", content: openAiUserContent(message, attachments) }
      ]
    })
  });

  return extractOpenAiCompatibleMessage(await readModelResponse(response, config), config.providerLabel);
}

async function callConfiguredModel(
  config: ModelRuntimeConfig,
  message: string,
  history: AgentConversationMessage[],
  intent: AgentIntent,
  context?: AgentContext,
  attachments: AgentAttachment[] = []
) {
  if (config.provider === "anthropic") return callAnthropicModel(config, message, history, intent, context, attachments);
  return callOpenAiCompatibleModel(config, message, history, intent, context, attachments);
}

type ModelDeltaHandler = (text: string) => void | Promise<void>;

async function requireStreamingBody(response: Response, config: ModelRuntimeConfig) {
  if (!response.ok) {
    await readModelResponse(response, config);
  }
  if (!response.body) {
    throw new Error(`${config.providerLabel} response did not include a stream.`);
  }
  return response.body;
}

function streamedProviderError(payload: unknown, fallback: string) {
  return String(
    (payload as { error?: { message?: unknown } })?.error?.message ??
      (payload as { message?: unknown })?.message ??
      fallback
  );
}

async function streamOpenAiCompatibleModel(
  config: ModelRuntimeConfig,
  message: string,
  history: AgentConversationMessage[],
  intent: AgentIntent,
  context: AgentContext | undefined,
  onRawDelta: ModelDeltaHandler,
  signal?: AbortSignal,
  attachments: AgentAttachment[] = []
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
      max_tokens: DEFAULT_AGENT_MAX_TOKENS,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt(intent, context) },
        ...compactHistory(history),
        { role: "user", content: openAiUserContent(message, attachments) }
      ]
    }),
    signal
  });
  const body = await requireStreamingBody(response, config);
  let finishReason: string | undefined;
  let sawDone = false;
  let rawMessage = "";

  for await (const event of readSseEvents(body, signal)) {
    if (event.data === "[DONE]") {
      sawDone = true;
      continue;
    }

    const payload = JSON.parse(event.data) as {
      error?: { message?: unknown };
      choices?: Array<{
        delta?: { content?: unknown };
        finish_reason?: unknown;
      }>;
    };
    if (payload.error) {
      throw new Error(streamedProviderError(payload, `${config.providerLabel} stream failed.`));
    }
    const choice = payload.choices?.[0];
    const content = choice?.delta?.content;
    if (typeof content === "string" && content) {
      rawMessage += content;
      await onRawDelta(content);
    }
    if (typeof choice?.finish_reason === "string") finishReason = choice.finish_reason;
  }

  if (finishReason === "length") {
    throw new IncompleteModelResponseError(
      `${config.providerLabel} response was cut off before completion.`,
      rawMessage
    );
  }
  if (!sawDone) {
    throw new Error(`${config.providerLabel} stream ended before completion.`);
  }
  if (finishReason !== "stop") {
    throw new Error(`${config.providerLabel} stream ended without a successful completion reason.`);
  }
}

async function streamAnthropicModel(
  config: ModelRuntimeConfig,
  message: string,
  history: AgentConversationMessage[],
  intent: AgentIntent,
  context: AgentContext | undefined,
  onRawDelta: ModelDeltaHandler,
  signal?: AbortSignal,
  attachments: AgentAttachment[] = []
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
      max_tokens: DEFAULT_AGENT_MAX_TOKENS,
      stream: true,
      system: systemPrompt(intent, context),
      messages: [...compactHistory(history), { role: "user", content: anthropicUserContent(message, attachments) }]
    }),
    signal
  });
  const body = await requireStreamingBody(response, config);
  let stopReason: string | undefined;
  let sawStop = false;
  let rawMessage = "";

  for await (const event of readSseEvents(body, signal)) {
    const payload = JSON.parse(event.data) as {
      type?: string;
      error?: { message?: unknown };
      delta?: { type?: string; text?: unknown; stop_reason?: unknown };
    };
    if (event.event === "error" || payload.type === "error") {
      throw new Error(streamedProviderError(payload, `${config.providerLabel} stream failed.`));
    }
    if (
      payload.type === "content_block_delta" &&
      payload.delta?.type === "text_delta" &&
      typeof payload.delta.text === "string"
    ) {
      rawMessage += payload.delta.text;
      await onRawDelta(payload.delta.text);
    }
    if (payload.type === "message_delta" && typeof payload.delta?.stop_reason === "string") {
      stopReason = payload.delta.stop_reason;
    }
    if (payload.type === "message_stop") sawStop = true;
  }

  if (stopReason === "max_tokens") {
    throw new IncompleteModelResponseError(
      `${config.providerLabel} response was cut off before completion.`,
      rawMessage
    );
  }
  if (!sawStop) {
    throw new Error(`${config.providerLabel} stream ended before completion.`);
  }
  if (stopReason !== "end_turn" && stopReason !== "stop_sequence") {
    throw new Error(`${config.providerLabel} stream ended without a successful completion reason.`);
  }
}

function isAbortError(error: unknown, signal?: AbortSignal) {
  return signal?.aborted || (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

export type ModelChatMessage = { role: "user" | "assistant"; content: string };

export async function runModelCompletion(
  config: ModelRuntimeConfig,
  system: string,
  messages: ModelChatMessage[],
  options: { maxTokens?: number } = {}
): Promise<string> {
  const maxTokens = options.maxTokens ?? 1200;
  if (config.provider === "anthropic") {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.modelName,
        max_tokens: maxTokens,
        system,
        messages: messages.map((item) => ({ role: item.role, content: item.content }))
      })
    });
    return extractAnthropicMessage(await readModelResponse(response, config), config.providerLabel);
  }

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.modelName,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        ...messages.map((item) => ({ role: item.role, content: item.content }))
      ]
    })
  });
  return extractOpenAiCompatibleMessage(await readModelResponse(response, config), config.providerLabel);
}

export async function createAgentResponseForUser(
  userId: string,
  message: string,
  history: AgentConversationMessage[] = [],
  context?: AgentContext,
  attachments: AgentAttachment[] = []
): Promise<AgentResponse> {
  const fallback = createAgentResponse(message, history);
  const config = await loadModelRuntimeConfig(userId);
  const intent = context?.intent ?? fallback.intent;

  if (!config) {
    return attachments.length
      ? { ...fallback, message: "附件已保存，但当前没有配置可分析附件的模型。请先在设置中配置支持图片或文件输入的模型。" }
      : fallback;
  }

  try {
    return {
      intent,
      source: "model",
      modelProvider: config.providerLabel,
      modelName: config.modelName,
      message: await callConfiguredModel(config, message, history, intent, context, attachments)
    };
  } catch (error) {
    if (isIncompleteModelResponseError(error) && error.partialContent.trim()) {
      return {
        intent,
        source: "model",
        modelProvider: config.providerLabel,
        modelName: config.modelName,
        message: error.partialContent,
        error: error.message,
        truncated: true
      };
    }
    const errorMessage = error instanceof Error ? error.message : "Model call failed.";
    const normalizedErrorMessage = errorMessage.replace(/[.。]+$/, "");
    return {
      ...fallback,
      error: errorMessage,
      message: `Model call failed: ${normalizedErrorMessage}; using local guidance instead. ${fallback.message}`
    };
  }
}

export async function createStreamingAgentResponseForUser(
  userId: string,
  message: string,
  history: AgentConversationMessage[],
  context: AgentContext | undefined,
  onDelta: ModelDeltaHandler,
  signal?: AbortSignal,
  attachments: AgentAttachment[] = []
): Promise<AgentResponse> {
  const fallback = createAgentResponse(message, history);
  const config = await loadModelRuntimeConfig(userId);
  const intent = context?.intent ?? fallback.intent;

  if (!config) {
    const response = attachments.length
      ? { ...fallback, message: "附件已保存，但当前没有配置可分析附件的模型。请先在设置中配置支持图片或文件输入的模型。" }
      : fallback;
    await onDelta(response.message);
    return response;
  }

  const filter = createVisibleTextFilter();
  let rawMessage = "";
  let emittedVisibleText = false;
  const onRawDelta = async (text: string) => {
    rawMessage += text;
    const visible = filter.push(text);
    if (!visible) return;
    emittedVisibleText = true;
    await onDelta(visible);
  };

  try {
    if (config.provider === "anthropic") {
      await streamAnthropicModel(config, message, history, intent, context, onRawDelta, signal, attachments);
    } else {
      await streamOpenAiCompatibleModel(config, message, history, intent, context, onRawDelta, signal, attachments);
    }

    const trailing = filter.finish();
    if (trailing) {
      emittedVisibleText = true;
      await onDelta(trailing);
    }
    if (!rawMessage.trim()) {
      throw new Error("Model response did not include a message.");
    }

    return {
      intent,
      source: "model",
      modelProvider: config.providerLabel,
      modelName: config.modelName,
      message: rawMessage
    };
  } catch (error) {
    if (isAbortError(error, signal)) throw error;

    if (isIncompleteModelResponseError(error)) {
      const partial = error.partialContent.trim() ? error.partialContent : rawMessage;
      if (partial.trim()) {
        const trailing = filter.finish();
        if (trailing) {
          emittedVisibleText = true;
          await onDelta(trailing);
        }
        if (!emittedVisibleText) {
          const visible = createVisibleTextFilter();
          const text = visible.push(partial) + visible.finish();
          if (text) await onDelta(text);
        }
        return {
          intent,
          source: "model",
          modelProvider: config.providerLabel,
          modelName: config.modelName,
          message: partial,
          error: error.message,
          truncated: true
        };
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Model call failed.";
    const normalizedErrorMessage = errorMessage.replace(/[.。]+$/, "");
    const response = {
      ...fallback,
      error: errorMessage,
      message: `Model call failed: ${normalizedErrorMessage}; using local guidance instead. ${fallback.message}`
    };
    if (!emittedVisibleText) await onDelta(response.message);
    return response;
  }
}
