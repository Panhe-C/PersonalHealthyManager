export type MemoryOp = "add" | "update" | "delete";

export type MemoryKind = "fact" | "preference" | "routine" | "constraint";
export type MemoryCategory =
  | "training"
  | "nutrition"
  | "recovery"
  | "schedule"
  | "general";

export type MemoryProposal = {
  op: MemoryOp;
  kind: MemoryKind;
  category: MemoryCategory;
  content: string;
  confidence: number;
  targetContent?: string;
};

export type ParsedMemories = {
  memories: MemoryProposal[];
  warnings: string[];
};

const kinds = new Set<MemoryKind>(["fact", "preference", "routine", "constraint"]);
const categories = new Set<MemoryCategory>([
  "training",
  "nutrition",
  "recovery",
  "schedule",
  "general"
]);

function extractBlock(reply: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(reply);
  return match ? match[1].trim() : null;
}

function stripCodeFence(body: string): string {
  return body
    .replace(/^\s*```[a-zA-Z]*\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function extractFencedBlock(reply: string): string | null {
  const match = /```[a-zA-Z]*[ \t]*\n([\s\S]*?)(?:\n?```|$)/i.exec(reply);
  return match ? match[1].trim() : null;
}

function stripMemoryArtifacts(reply: string): string {
  return reply
    .replace(/<memories>[\s\S]*?<\/memories>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseMemoriesJson(rawText: string, warnings: string[]): MemoryProposal[] {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    warnings.push("memories block was not valid JSON");
    return [];
  }

  const items = Array.isArray(raw) ? raw : [];
  const memories: MemoryProposal[] = [];

  for (const item of items) {
    const candidate = (item ?? {}) as Record<string, unknown>;
    const op = str(candidate.op) as MemoryOp | null;
    if (op !== "add" && op !== "update" && op !== "delete") {
      warnings.push("memory missing valid op; skipped");
      continue;
    }

    const content = str(candidate.content);
    if (!content) {
      warnings.push("memory missing content; skipped");
      continue;
    }

    const kind = str(candidate.kind) as MemoryKind | null;
    if (!kind || !kinds.has(kind)) {
      warnings.push(`memory has unknown kind: ${kind ?? "(empty)"}`);
      continue;
    }

    const category = str(candidate.category) as MemoryCategory | null;
    if (!category || !categories.has(category)) {
      warnings.push(`memory has unknown category: ${category ?? "(empty)"}`);
      continue;
    }

    const targetContent = str(candidate.targetContent) ?? undefined;

    memories.push({
      op,
      kind,
      category,
      content,
      confidence: num(candidate.confidence),
      targetContent
    });
  }

  return memories;
}

export function parseMemoryProposals(reply: string): ParsedMemories {
  const warnings: string[] = [];
  const memoriesBlock = extractBlock(reply, "memories");

  let raw: string | null = null;
  if (memoriesBlock) {
    raw = stripCodeFence(memoriesBlock);
  } else {
    // Only fall back to a fenced block if it is explicitly tagged as memories/json
    // and lives outside an <actions> block; otherwise leave memories empty so a
    // generic ```json action block is not misread as memories.
    const fenced = extractFencedBlock(reply);
    if (fenced && /"op"\s*:\s*"(add|update|delete)"/.test(fenced)) raw = fenced;
  }

  if (!raw) return { memories: [], warnings };

  return { memories: parseMemoriesJson(raw, warnings), warnings };
}

export function stripMemoryBlock(reply: string): string {
  return stripMemoryArtifacts(reply);
}
