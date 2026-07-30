import { describe, expect, it } from "vitest";
import {
  createAgentStreamParser,
  encodeAgentStreamEvent
} from "@hbm/contracts";

describe("Agent NDJSON contract", () => {
  it("reconstructs UTF-8 events split at arbitrary byte boundaries", () => {
    const bytes = encodeAgentStreamEvent({ type: "delta", text: "恢复跑🏃" });
    const parser = createAgentStreamParser();

    expect(parser.push(bytes.slice(0, 5))).toEqual([]);
    expect(parser.push(bytes.slice(5))).toEqual([{ type: "delta", text: "恢复跑🏃" }]);
    expect(() => parser.finish()).toThrow("Agent stream ended before a terminal event.");
  });

  it("parses multiple events and accepts exactly one terminal event", () => {
    const encoder = new TextEncoder();
    const parser = createAgentStreamParser();
    const events = parser.push(encoder.encode(
      '{"type":"start","requestId":"req-1"}\n' +
      '{"type":"delta","text":"建议恢复跑。"}\n' +
      '{"type":"final","message":"建议恢复跑。","intent":"general","source":"model",' +
      '"conversation":{"id":"conv-1","title":"恢复","updatedAt":"2026-07-30T00:00:00.000Z"},' +
      '"adjustments":[],"appliedMemories":[]}\n'
    ));

    expect(events.map((event) => event.type)).toEqual(["start", "delta", "final"]);
    expect(parser.finish()).toEqual([]);
  });

  it("rejects malformed events and bytes after a terminal event", () => {
    const parser = createAgentStreamParser();
    expect(() => parser.push(new TextEncoder().encode('{"type":"delta"}\n'))).toThrow();

    const terminal = createAgentStreamParser();
    terminal.push(new TextEncoder().encode(
      '{"type":"error","error":"failed","code":"stream_interrupted"}\n'
    ));
    expect(() => terminal.push(new TextEncoder().encode(
      '{"type":"delta","text":"late"}\n'
    ))).toThrow("Agent stream emitted data after its terminal event.");
  });
});
