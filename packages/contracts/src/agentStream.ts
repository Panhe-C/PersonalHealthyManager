import { z } from "zod";
import {
  adjustmentSchema,
  agentMessageResponseSchema,
  appliedMemorySchema,
  conversationSchema
} from "./agent";

export const AGENT_STREAM_MEDIA_TYPE = "application/x-ndjson";

export const agentStreamStartSchema = z.object({
  type: z.literal("start"),
  requestId: z.string().min(1)
});

export const agentStreamDeltaSchema = z.object({
  type: z.literal("delta"),
  text: z.string().min(1)
});

export const agentStreamFinalSchema = agentMessageResponseSchema.extend({
  type: z.literal("final"),
  intent: z.string().min(1),
  source: z.enum(["model", "rules"]),
  modelProvider: z.string().optional(),
  modelName: z.string().optional(),
  error: z.string().optional(),
  conversation: conversationSchema,
  adjustments: z.array(adjustmentSchema),
  appliedMemories: z.array(appliedMemorySchema)
});

export const agentStreamErrorSchema = z.object({
  type: z.literal("error"),
  error: z.string().min(1),
  code: z.enum(["request_failed", "stream_interrupted"])
});

export const agentStreamEventSchema = z.discriminatedUnion("type", [
  agentStreamStartSchema,
  agentStreamDeltaSchema,
  agentStreamFinalSchema,
  agentStreamErrorSchema
]);

export type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>;
export type AgentFinalPayload = Omit<
  Extract<AgentStreamEvent, { type: "final" }>,
  "type"
>;

export function encodeAgentStreamEvent(event: AgentStreamEvent): Uint8Array {
  const validated = agentStreamEventSchema.parse(event);
  return new TextEncoder().encode(`${JSON.stringify(validated)}\n`);
}

export function createAgentStreamParser() {
  const decoder = new TextDecoder();
  let buffer = "";
  let terminalSeen = false;

  function parseAvailableLines(): AgentStreamEvent[] {
    const events: AgentStreamEvent[] = [];
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
      if (!line) continue;
      if (terminalSeen) {
        throw new Error("Agent stream emitted data after its terminal event.");
      }

      const event = agentStreamEventSchema.parse(JSON.parse(line));
      events.push(event);
      if (event.type === "final" || event.type === "error") terminalSeen = true;
    }

    return events;
  }

  return {
    push(chunk: Uint8Array): AgentStreamEvent[] {
      if (terminalSeen && chunk.byteLength > 0) {
        throw new Error("Agent stream emitted data after its terminal event.");
      }
      buffer += decoder.decode(chunk, { stream: true });
      return parseAvailableLines();
    },

    finish(): AgentStreamEvent[] {
      buffer += decoder.decode();
      if (buffer.trim()) buffer += "\n";
      const events = parseAvailableLines();
      if (!terminalSeen) {
        throw new Error("Agent stream ended before a terminal event.");
      }
      return events;
    }
  };
}
