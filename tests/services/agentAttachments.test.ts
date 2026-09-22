import { describe, expect, it } from "vitest";
import {
  anthropicUserContent,
  attachmentsFromMetadata,
  openAiUserContent,
  validateAgentAttachments
} from "@/src/services/agentAttachments";
import type { AgentAttachment } from "@hbm/contracts";

function attachment(overrides: Partial<AgentAttachment> = {}): AgentAttachment {
  const data = Buffer.from("hello").toString("base64");
  return {
    id: "attachment-1",
    name: "notes.txt",
    mimeType: "text/plain",
    size: 5,
    dataUrl: `data:text/plain;base64,${data}`,
    ...overrides
  };
}

describe("agent attachments", () => {
  it("validates encoded size and supported type", () => {
    expect(validateAgentAttachments([attachment()])).toEqual({ ok: true, attachments: [attachment()] });
    expect(validateAgentAttachments([attachment({ size: 4 })])).toEqual({
      ok: false,
      error: "Attachment notes.txt size does not match its data."
    });
  });

  it("builds OpenAI image, PDF, and text content blocks", () => {
    const image = attachment({
      id: "image",
      name: "meal.png",
      mimeType: "image/png",
      dataUrl: `data:image/png;base64,${Buffer.from("hello").toString("base64")}`
    });
    const pdf = attachment({
      id: "pdf",
      name: "report.pdf",
      mimeType: "application/pdf",
      dataUrl: `data:application/pdf;base64,${Buffer.from("hello").toString("base64")}`
    });
    expect(openAiUserContent("分析", [image, pdf, attachment()])).toEqual([
      { type: "text", text: "分析" },
      { type: "image_url", image_url: { url: image.dataUrl, detail: "auto" } },
      { type: "file", file: { filename: "report.pdf", file_data: pdf.dataUrl } },
      { type: "text", text: '<file name="notes.txt">\nhello\n</file>' }
    ]);
  });

  it("builds Anthropic document content and restores persisted metadata", () => {
    const value = attachment();
    expect(anthropicUserContent("总结", [value])).toEqual([
      {
        type: "document",
        source: { type: "text", media_type: "text/plain", data: "hello" },
        title: "notes.txt"
      },
      { type: "text", text: "总结" }
    ]);
    expect(attachmentsFromMetadata(JSON.stringify({ attachments: [value] }))).toEqual([value]);
  });
});
