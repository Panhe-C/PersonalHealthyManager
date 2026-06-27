import { agentActionRegistry } from "@/src/services/agentActions/registry";

export type AgentActionProposal = { id: string; args: Record<string, unknown> };
export type ParsedAgentReply = {
  explanation: string;
  actions: AgentActionProposal[];
  warnings: string[];
};

function extractBlock(reply: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(reply);
  return match ? match[1].trim() : null;
}

// Strip a leading/trailing ```json or ``` fence from a block body.
function stripCodeFence(body: string): string {
  return body
    .replace(/^\s*```[a-zA-Z]*\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

// Find a fenced (```...```) block anywhere in the reply and return its inner content.
function extractFencedBlock(reply: string): string | null {
  const match = /```[a-zA-Z]*\s*\n([\s\S]*?)\n?```/i.exec(reply);
  return match ? match[1].trim() : null;
}

// Remove <actions>...</actions> and any fenced code block from user-facing text.
function stripActionArtifacts(reply: string): string {
  return reply
    .replace(/<actions>[\s\S]*?<\/actions>/gi, "")
    .replace(/```[a-zA-Z]*\s*\n[\s\S]*?\n?```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseActionsJson(rawText: string, warnings: string[]): AgentActionProposal[] {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    warnings.push("actions block was not valid JSON");
    return [];
  }

  const items = Array.isArray(raw) ? raw : [];
  const actions: AgentActionProposal[] = [];

  for (const item of items) {
    const candidate = (item ?? {}) as { id?: unknown; args?: unknown };
    const id = typeof candidate.id === "string" ? candidate.id : "";
    const definition = agentActionRegistry[id];
    if (!definition) {
      warnings.push(`unknown action id: ${id || "(empty)"}`);
      continue;
    }
    const args = definition.validate(candidate.args);
    if (!args) {
      warnings.push(`invalid args for action: ${id}`);
      continue;
    }
    actions.push({ id, args });
  }

  return actions;
}

export function parseActionProposals(reply: string): ParsedAgentReply {
  const explanationBlock = extractBlock(reply, "explanation");
  const actionsBlock = extractBlock(reply, "actions");
  const warnings: string[] = [];

  const explanation = explanationBlock ?? stripActionArtifacts(reply);

  let actionsRaw: string | null = null;
  if (actionsBlock) {
    actionsRaw = stripCodeFence(actionsBlock);
  } else {
    const fenced = extractFencedBlock(reply);
    if (fenced) actionsRaw = fenced;
  }

  if (!actionsRaw) return { explanation, actions: [], warnings };

  return { explanation, actions: parseActionsJson(actionsRaw, warnings), warnings };
}
