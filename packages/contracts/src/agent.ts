import { z } from "zod";

export const agentMessageRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().min(1)
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
