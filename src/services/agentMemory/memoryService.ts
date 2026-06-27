import { prisma } from "@/src/db/client";
import type { AgentIntent } from "@/src/services/agent";
import type { MemoryCategory, MemoryProposal } from "@/src/services/agentMemory/memories";

export type AppliedMemory = {
  op: "add" | "update" | "delete";
  id: string;
  content: string;
  status: "created" | "superseded" | "deleted" | "skipped";
  reason?: string;
};

export type ApplyMemoriesContext = {
  messageId?: string;
  conversationId?: string;
  source: "explicit" | "auto";
};

export type AgentMemoryRow = {
  id: string;
  kind: string;
  category: string;
  content: string;
  confidence: number;
  status: string;
};

const CONFIDENCE_THRESHOLD = 0.6;
const DEDUP_JACCARD = 0.8;
const SUPERSEDE_JACCARD = 0.7;
const CONTEXT_LIMIT = 50;

const intentCategoryPriority: Record<AgentIntent, MemoryCategory[]> = {
  recovery_check: ["recovery", "training"],
  training_analysis: ["training", "recovery"],
  calendar_confirmation: ["schedule", "training"],
  menu_advice: ["nutrition", "training"],
  replan: ["training", "schedule", "recovery"],
  general: ["training", "nutrition", "recovery", "schedule", "general"]
};

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function tokenSet(text: string): Set<string> {
  const key = normalizeKey(text);
  if (key.length === 0) return new Set();
  if (key.length < 2) return new Set([key]);
  const tokens = new Set<string>();
  for (let i = 0; i < key.length - 1; i += 1) {
    tokens.add(key.slice(i, i + 2));
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

type ActiveMemory = {
  id: string;
  content: string;
  contentTokens: Set<string>;
};

async function loadActiveMemories(userId: string): Promise<ActiveMemory[]> {
  const rows = await prisma.agentMemory.findMany({
    where: { userId, status: "active" },
    select: { id: true, content: true }
  });
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    contentTokens: tokenSet(row.content)
  }));
}

function findSimilar(
  haystack: ActiveMemory[],
  content: string,
  threshold: number
): ActiveMemory | null {
  const tokens = tokenSet(content);
  if (tokens.size === 0) return null;
  let best: ActiveMemory | null = null;
  let bestScore = 0;
  for (const candidate of haystack) {
    if (normalizeKey(candidate.content) === normalizeKey(content)) return candidate;
    const score = jaccard(tokens, candidate.contentTokens);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore >= threshold ? best : null;
}

export async function applyMemories(
  userId: string,
  proposals: MemoryProposal[],
  context: ApplyMemoriesContext
): Promise<{ applied: AppliedMemory[]; warnings: string[] }> {
  const applied: AppliedMemory[] = [];
  const warnings: string[] = [];

  if (proposals.length === 0) return { applied, warnings };

  const active = await loadActiveMemories(userId);

  for (const proposal of proposals) {
    const confidence = context.source === "explicit" ? 1.0 : proposal.confidence;
    if (context.source === "auto" && confidence < CONFIDENCE_THRESHOLD) {
      warnings.push(`memory dropped below confidence threshold: ${proposal.content}`);
      continue;
    }

    if (proposal.op === "add") {
      const dup = findSimilar(active, proposal.content, DEDUP_JACCARD);
      if (dup) {
        applied.push({
          op: "add",
          id: dup.id,
          content: proposal.content,
          status: "skipped",
          reason: "duplicate of existing memory"
        });
        continue;
      }
      const created = await prisma.agentMemory.create({
        data: {
          userId,
          kind: proposal.kind,
          category: proposal.category,
          content: proposal.content,
          source: context.source,
          confidence,
          status: "active",
          originMessageId: context.messageId ?? null,
          originConversationId: context.conversationId ?? null
        },
        select: { id: true }
      });
      active.push({ id: created.id, content: proposal.content, contentTokens: tokenSet(proposal.content) });
      applied.push({ op: "add", id: created.id, content: proposal.content, status: "created" });
      continue;
    }

    if (proposal.op === "update") {
      const target = proposal.targetContent
        ? findSimilar(active, proposal.targetContent, SUPERSEDE_JACCARD)
        : findSimilar(active, proposal.content, SUPERSEDE_JACCARD);
      if (!target) {
        const created = await prisma.agentMemory.create({
          data: {
            userId,
            kind: proposal.kind,
            category: proposal.category,
            content: proposal.content,
            source: context.source,
            confidence,
            status: "active",
            originMessageId: context.messageId ?? null,
            originConversationId: context.conversationId ?? null
          },
          select: { id: true }
        });
        active.push({ id: created.id, content: proposal.content, contentTokens: tokenSet(proposal.content) });
        applied.push({
          op: "update",
          id: created.id,
          content: proposal.content,
          status: "created",
          reason: "no matching memory to supersede; added as new"
        });
        continue;
      }
      await prisma.agentMemory.update({
        where: { id_userId: { id: target.id, userId } },
        data: { status: "superseded" }
      });
      const created = await prisma.agentMemory.create({
        data: {
          userId,
          kind: proposal.kind,
          category: proposal.category,
          content: proposal.content,
          source: context.source,
          confidence,
          status: "active",
          originMessageId: context.messageId ?? null,
          originConversationId: context.conversationId ?? null
        },
        select: { id: true }
      });
      active.push({ id: created.id, content: proposal.content, contentTokens: tokenSet(proposal.content) });
      applied.push({ op: "update", id: created.id, content: proposal.content, status: "superseded" });
      continue;
    }

    if (proposal.op === "delete") {
      const target = proposal.targetContent
        ? findSimilar(active, proposal.targetContent, SUPERSEDE_JACCARD)
        : findSimilar(active, proposal.content, SUPERSEDE_JACCARD);
      if (!target) {
        warnings.push(`memory delete target not found: ${proposal.targetContent ?? proposal.content}`);
        continue;
      }
      await prisma.agentMemory.update({
        where: { id_userId: { id: target.id, userId } },
        data: { status: "deleted" }
      });
      applied.push({ op: "delete", id: target.id, content: target.content, status: "deleted" });
      continue;
    }
  }

  return { applied, warnings };
}

export async function loadActiveMemoriesForContext(
  userId: string,
  intent: AgentIntent
): Promise<AgentMemoryRow[]> {
  const priority = intentCategoryPriority[intent] ?? intentCategoryPriority.general;
  const rows = await prisma.agentMemory.findMany({
    where: { userId, status: "active" },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: CONTEXT_LIMIT * 2
  });

  // Order by category priority (matching intent first), then by confidence/recency.
  const rank = new Map(priority.map((category, index) => [category, index] as const));
  return rows
    .sort((a, b) => {
      const ra = rank.get(a.category as MemoryCategory) ?? priority.length;
      const rb = rank.get(b.category as MemoryCategory) ?? priority.length;
      if (ra !== rb) return ra - rb;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, CONTEXT_LIMIT);
}

export function formatMemoryLines(memories: AgentMemoryRow[]): string[] {
  return memories.map((memory) => `- [${memory.category}] ${memory.content}`);
}

export type AgentMemoryView = {
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

function toView(row: {
  id: string;
  kind: string;
  category: string;
  content: string;
  source: string;
  confidence: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): AgentMemoryView {
  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    content: row.content,
    source: row.source,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function listMemoriesForUser(userId: string): Promise<AgentMemoryView[]> {
  const rows = await prisma.agentMemory.findMany({
    where: { userId, status: { not: "deleted" } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });
  return rows.map(toView);
}

const validKinds = new Set(["fact", "preference", "routine", "constraint"]);
const validCategories = new Set(["training", "nutrition", "recovery", "schedule", "general"]);

export type MemoryWriteInput = {
  kind: string;
  category: string;
  content: string;
};

export async function createMemoryForUser(
  userId: string,
  input: MemoryWriteInput
): Promise<{ ok: true; memory: AgentMemoryView } | { ok: false; status: number; error: string }> {
  const kind = input.kind.trim();
  const category = input.category.trim();
  const content = input.content.trim();
  if (!kind || !validKinds.has(kind)) return { ok: false, status: 400, error: "Invalid kind" };
  if (!category || !validCategories.has(category)) return { ok: false, status: 400, error: "Invalid category" };
  if (!content) return { ok: false, status: 400, error: "Content is required" };

  const row = await prisma.agentMemory.create({
    data: { userId, kind, category, content, source: "explicit", confidence: 1.0, status: "active" }
  });
  return { ok: true, memory: toView(row) };
}

export async function updateMemoryForUser(
  userId: string,
  memoryId: string,
  patch: Partial<MemoryWriteInput>
): Promise<{ ok: true; memory: AgentMemoryView } | { ok: false; status: number; error: string }> {
  const existing = await prisma.agentMemory.findFirst({ where: { id: memoryId, userId } });
  if (!existing) return { ok: false, status: 404, error: "Memory not found" };

  const data: Record<string, string> = {};
  if (patch.kind !== undefined) {
    const kind = patch.kind.trim();
    if (!validKinds.has(kind)) return { ok: false, status: 400, error: "Invalid kind" };
    data.kind = kind;
  }
  if (patch.category !== undefined) {
    const category = patch.category.trim();
    if (!validCategories.has(category)) return { ok: false, status: 400, error: "Invalid category" };
    data.category = category;
  }
  if (patch.content !== undefined) {
    const content = patch.content.trim();
    if (!content) return { ok: false, status: 400, error: "Content is required" };
    data.content = content;
  }

  const row = await prisma.agentMemory.update({
    where: { id_userId: { id: memoryId, userId } },
    data
  });
  return { ok: true, memory: toView(row) };
}

export async function deleteMemoryForUser(
  userId: string,
  memoryId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.agentMemory.findFirst({ where: { id: memoryId, userId } });
  if (!existing) return { ok: false, status: 404, error: "Memory not found" };

  await prisma.agentMemory.update({
    where: { id_userId: { id: memoryId, userId } },
    data: { status: "deleted" }
  });
  return { ok: true };
}
