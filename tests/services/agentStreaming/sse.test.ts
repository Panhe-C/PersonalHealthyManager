import { describe, expect, it } from "vitest";
import { readSseEvents } from "@/src/services/agentStreaming/sse";

function bodyFrom(parts: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      parts.forEach((part) => controller.enqueue(part));
      controller.close();
    }
  });
}

describe("readSseEvents", () => {
  it("reassembles UTF-8 and multi-line data across chunks", async () => {
    const bytes = new TextEncoder().encode(
      'event: content_block_delta\r\ndata: {"text":"恢复🏃"}\r\n\r\n' +
      'data: first\ndata: second\n\n'
    );
    const events = [];
    for await (const event of readSseEvents(bodyFrom([
      bytes.slice(0, 31), bytes.slice(31, 44), bytes.slice(44)
    ]))) events.push(event);

    expect(events).toEqual([
      { event: "content_block_delta", data: '{"text":"恢复🏃"}' },
      { data: "first\nsecond" }
    ]);
  });

  it("ignores comments and emits a final record without a trailing blank line", async () => {
    const body = bodyFrom([
      new TextEncoder().encode(": keepalive\n\ndata: [DONE]")
    ]);
    const events = [];
    for await (const event of readSseEvents(body)) events.push(event);

    expect(events).toEqual([{ data: "[DONE]" }]);
  });
});
