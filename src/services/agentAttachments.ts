import {
  AGENT_ATTACHMENTS_MAX_TOTAL_BYTES,
  AGENT_ATTACHMENT_MAX_COUNT,
  agentAttachmentSchema,
  type AgentAttachment
} from "@hbm/contracts";

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json"
]);

const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);

export type AttachmentValidation =
  | { ok: true; attachments: AgentAttachment[] }
  | { ok: false; error: string };

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

function decodedByteLength(base64: string) {
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function validateAgentAttachments(value: unknown): AttachmentValidation {
  const parsed = agentAttachmentSchema.array().max(AGENT_ATTACHMENT_MAX_COUNT).safeParse(value ?? []);
  if (!parsed.success) return { ok: false, error: "Invalid attachment payload." };

  let totalBytes = 0;
  for (const attachment of parsed.data) {
    const data = parseDataUrl(attachment.dataUrl);
    if (!data || data.mimeType !== attachment.mimeType.toLowerCase()) {
      return { ok: false, error: `Attachment ${attachment.name} has invalid encoded data.` };
    }
    if (!SUPPORTED_MIME_TYPES.has(data.mimeType)) {
      return { ok: false, error: `Attachment type ${attachment.mimeType} is not supported.` };
    }
    const byteLength = decodedByteLength(data.base64);
    if (byteLength !== attachment.size) {
      return { ok: false, error: `Attachment ${attachment.name} size does not match its data.` };
    }
    totalBytes += byteLength;
  }

  if (totalBytes > AGENT_ATTACHMENTS_MAX_TOTAL_BYTES) {
    return { ok: false, error: "Attachments exceed the 10 MB total limit." };
  }
  return { ok: true, attachments: parsed.data };
}

function dataParts(attachment: AgentAttachment) {
  const parsed = parseDataUrl(attachment.dataUrl);
  if (!parsed) throw new Error(`Attachment ${attachment.name} has invalid encoded data.`);
  return parsed;
}

export function openAiUserContent(message: string, attachments: AgentAttachment[]) {
  if (attachments.length === 0) return message;
  const content: Array<Record<string, unknown>> = [{ type: "text", text: message }];

  for (const attachment of attachments) {
    if (attachment.mimeType.startsWith("image/")) {
      content.push({ type: "image_url", image_url: { url: attachment.dataUrl, detail: "auto" } });
    } else if (attachment.mimeType === "application/pdf") {
      content.push({
        type: "file",
        file: { filename: attachment.name, file_data: attachment.dataUrl }
      });
    } else if (TEXT_MIME_TYPES.has(attachment.mimeType)) {
      const { base64 } = dataParts(attachment);
      const text = Buffer.from(base64, "base64").toString("utf8");
      content.push({ type: "text", text: `<file name="${attachment.name}">\n${text}\n</file>` });
    }
  }
  return content;
}

export function anthropicUserContent(message: string, attachments: AgentAttachment[]) {
  if (attachments.length === 0) return message;
  const content: Array<Record<string, unknown>> = [];

  for (const attachment of attachments) {
    const { base64 } = dataParts(attachment);
    if (attachment.mimeType.startsWith("image/")) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: attachment.mimeType, data: base64 }
      });
    } else if (attachment.mimeType === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
        title: attachment.name
      });
    } else if (TEXT_MIME_TYPES.has(attachment.mimeType)) {
      content.push({
        type: "document",
        source: {
          type: "text",
          media_type: "text/plain",
          data: Buffer.from(base64, "base64").toString("utf8")
        },
        title: attachment.name
      });
    }
  }
  content.push({ type: "text", text: message });
  return content;
}

export function attachmentsFromMetadata(metadataJson: string): AgentAttachment[] {
  try {
    const value = (JSON.parse(metadataJson) as { attachments?: unknown }).attachments;
    const parsed = agentAttachmentSchema.array().safeParse(value ?? []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
