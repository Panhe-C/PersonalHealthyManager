import { z } from "zod";

export const AGENT_ATTACHMENT_MAX_COUNT = 4;
export const AGENT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const AGENT_ATTACHMENTS_MAX_TOTAL_BYTES = 10 * 1024 * 1024;

export const agentAttachmentSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().nonnegative().max(AGENT_ATTACHMENT_MAX_BYTES),
  dataUrl: z.string().min(1)
});

export const agentMessageRequestSchema = z.object({
  message: z.string(),
  conversationId: z.string().min(1),
  attachments: z.array(agentAttachmentSchema).max(AGENT_ATTACHMENT_MAX_COUNT).optional()
}).refine((value) => value.message.trim().length > 0 || Boolean(value.attachments?.length), {
  message: "A message or attachment is required"
});

export const appliedMemorySchema = z.object({
  op: z.string(),
  status: z.string(),
  content: z.string()
}).passthrough();

export const adjustmentSchema = z.object({
  id: z.string(),
  planId: z.string(),
  userId: z.string()
}).passthrough();

export const conversationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  summaryUpdatedAt: z.string().nullable(),
  summaryMessageCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string()
}).passthrough();

export const agentMessageResponseSchema = z.object({
  message: z.string(),
  conversation: conversationSchema,
  adjustments: z.array(adjustmentSchema),
  appliedMemories: z.array(appliedMemorySchema)
}).passthrough();

export const conversationListResponseSchema = z.array(conversationSchema);

export type AgentMessageRequest = z.infer<typeof agentMessageRequestSchema>;
export type AgentAttachment = z.infer<typeof agentAttachmentSchema>;
