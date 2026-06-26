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

export function parseActionProposals(reply: string): ParsedAgentReply {
  const explanationBlock = extractBlock(reply, "explanation");
  const actionsBlock = extractBlock(reply, "actions");
  const warnings: string[] = [];

  const explanation =
    explanationBlock ?? reply.replace(/<actions>[\s\S]*?<\/actions>/i, "").trim();

  if (!actionsBlock) return { explanation, actions: [], warnings };

  let raw: unknown;
  try {
    raw = JSON.parse(actionsBlock);
  } catch {
    warnings.push("actions block was not valid JSON");
    return { explanation, actions: [], warnings };
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

  return { explanation, actions, warnings };
}
