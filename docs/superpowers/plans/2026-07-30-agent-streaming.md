# Agent Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream configured-model responses through `/api/agent` to incremental Web and iOS rendering while keeping actions, memories, persistence, fallbacks, and legacy JSON callers safe.

**Architecture:** Add a provider-neutral model stream with isolated SSE parsing and visible-text filtering, then reuse prepare/finalize Agent orchestration for both legacy JSON and opt-in NDJSON responses. Put the wire event schemas and incremental NDJSON parser in `@hbm/contracts`; Web uses browser `fetch`, while iOS uses `expo/fetch`.

**Tech Stack:** TypeScript 5.7/5.8, Next.js 15 route handlers and Web Streams, React 19, Expo SDK 53 with React Native 0.79, `expo/fetch`, Zod 3.24, Vitest 2.1.

## Global Constraints

- Streaming is opt-in with `Accept: application/x-ndjson`; callers without it retain the existing JSON contract.
- The server emits only `start`, visible-text `delta`, and one terminal `final` or `error` event.
- `<actions>` and `<memories>` content, including tags split across chunks, must never be emitted as deltas.
- Actions, memories, persistence, summaries, and conversation updates run only after a complete non-truncated model response.
- Client abort propagates to the provider and skips finalization.
- A provider failure or truncation resolves to the existing local-rule fallback and never executes partial control output.
- No WebSocket, resumable stream, background continuation, new Markdown dependency, or data-model migration.
- Keep user-facing copy already specified by the app; the iOS pending label remains `Coach 正在回复...`.

---

## File Map

**Create:**

- `packages/contracts/src/agentStream.ts` — stream event schemas/types, NDJSON encoder, and incremental parser.
- `tests/contracts/agentStream.test.ts` — wire schema and arbitrary-chunk parser coverage.
- `src/services/agentStreaming/sse.ts` — byte-safe SSE record parser.
- `src/services/agentStreaming/visibleText.ts` — incremental explanation/control-block filter.
- `tests/services/agentStreaming/sse.test.ts` — SSE chunk-boundary and UTF-8 tests.
- `tests/services/agentStreaming/visibleText.test.ts` — no-control-leak tests.
- `apps/mobile/src/api/agentStream.ts` — authenticated `expo/fetch` request and NDJSON consumption.
- `apps/mobile/src/api/agentStream.test.ts` — mobile network, auth refresh, and stream tests.

**Modify:**

- `packages/contracts/src/index.ts` — export the stream contract.
- `src/services/agent.ts` — provider streaming adapters and streaming Agent response entry point.
- `tests/services/agent.test.ts` — OpenAI-compatible, Anthropic, fallback, truncation, abort tests.
- `src/services/agentOrchestration.ts` — extract prepare/finalize stages shared by JSON and stream routes.
- `app/api/agent/route.ts` — negotiate NDJSON and build the response stream.
- `tests/api/agent.test.ts` — legacy JSON, NDJSON order/headers, pre-stream errors, abort behavior.
- `tests/api/agentActions.test.ts` — assert actions run only after complete generation.
- `components/AgentPanel.tsx` — optimistic assistant draft and incremental reconciliation.
- `tests/components/AgentPanel.test.tsx` — Web delta/final/error rendering.
- `apps/mobile/src/api/client.ts` — expose authenticated token refresh for the dedicated stream request without duplicating auth state.
- `apps/mobile/src/api/agent.ts` — retain JSON APIs and export the streaming request facade.
- `apps/mobile/app/(app)/(tabs)/coach.tsx` — replace one-shot mutation with incremental send state.
- `apps/mobile/src/coachMessages.ts` — pure optimistic assistant-draft helpers.
- `apps/mobile/src/coachMessages.test.ts` — mobile delta/final state coverage.

---

### Task 1: Shared NDJSON Event Contract

**Files:**

- Create: `packages/contracts/src/agentStream.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `tests/contracts/agentStream.test.ts`

**Interfaces:**

- Produces:

```ts
export const AGENT_STREAM_MEDIA_TYPE = "application/x-ndjson";
export type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>;
export type AgentFinalPayload = Omit<
  Extract<AgentStreamEvent, { type: "final" }>,
  "type"
>;
export function encodeAgentStreamEvent(event: AgentStreamEvent): Uint8Array;
export function createAgentStreamParser(): {
  push(chunk: Uint8Array): AgentStreamEvent[];
  finish(): AgentStreamEvent[];
};
```

- `createAgentStreamParser().finish()` throws `Agent stream ended before a terminal event.` unless a parsed `final` or `error` event was seen.

- [ ] **Step 1: Write the failing contract tests**

```ts
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
      '"conversation":{"id":"conv-1","userId":"user-1","title":"恢复","summary":null,' +
      '"summaryUpdatedAt":null,"summaryMessageCount":0,"createdAt":"2026-07-30T00:00:00.000Z",' +
      '"updatedAt":"2026-07-30T00:00:00.000Z"},"adjustments":[],"appliedMemories":[]}\n'
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
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
npm test -- tests/contracts/agentStream.test.ts
```

Expected: FAIL because `@hbm/contracts` does not export `createAgentStreamParser` or `encodeAgentStreamEvent`.

- [ ] **Step 3: Implement the event schemas and parser**

Create discriminated Zod schemas for:

```ts
const start = z.object({ type: z.literal("start"), requestId: z.string().min(1) });
const delta = z.object({ type: z.literal("delta"), text: z.string().min(1) });
const final = agentMessageResponseSchema.extend({
  type: z.literal("final"),
  intent: z.string(),
  source: z.enum(["model", "rules"]),
  modelProvider: z.string().optional(),
  modelName: z.string().optional(),
  error: z.string().optional()
});
const error = z.object({
  type: z.literal("error"),
  error: z.string().min(1),
  code: z.enum(["request_failed", "stream_interrupted"])
});
```

Implement `createAgentStreamParser()` with one persistent `TextDecoder`, a string line buffer, and a `terminalSeen` boolean. Parse only newline-terminated non-empty lines in `push()`. In `finish()`, flush the decoder, parse a final non-empty buffered line, then require `terminalSeen`.

Add:

```ts
export * from "./agentStream";
```

to `packages/contracts/src/index.ts`.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run:

```bash
npm test -- tests/contracts/agentStream.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the shared contract**

```bash
git add packages/contracts/src/agentStream.ts packages/contracts/src/index.ts tests/contracts/agentStream.test.ts
git commit -m "feat: add agent stream wire contract"
```

---

### Task 2: SSE Parsing And Safe Visible-Text Filtering

**Files:**

- Create: `src/services/agentStreaming/sse.ts`
- Create: `src/services/agentStreaming/visibleText.ts`
- Create: `tests/services/agentStreaming/sse.test.ts`
- Create: `tests/services/agentStreaming/visibleText.test.ts`

**Interfaces:**

- Produces:

```ts
export type SseEvent = { event?: string; data: string };
export async function* readSseEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<SseEvent>;

export function createVisibleTextFilter(): {
  push(rawDelta: string): string;
  finish(): string;
};
```

- The visible filter returns only newly safe text. It supports wrapped
  `<explanation>` output and plain text, and permanently stops at
  `</explanation>`, `<actions>`, or `<memories>`.

- [ ] **Step 1: Write the failing SSE tests**

```ts
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
});
```

- [ ] **Step 2: Write the failing visible-filter tests**

```ts
import { describe, expect, it } from "vitest";
import { createVisibleTextFilter } from "@/src/services/agentStreaming/visibleText";

describe("visible Agent text filter", () => {
  it("streams explanation while withholding split control tags", () => {
    const filter = createVisibleTextFilter();
    expect(filter.push("<expla")).toBe("");
    expect(filter.push("nation>建议恢复")).toBe("建议恢复");
    expect(filter.push("跑。</explan")).toBe("跑。");
    expect(filter.push('ation><actions>[{"id":"reschedule_task"}]</actions>')).toBe("");
    expect(filter.finish()).toBe("");
  });

  it("streams plain text without leaking a split memories tag", () => {
    const filter = createVisibleTextFilter();
    expect(filter.push("先休息。\n<memo")).toBe("先休息。\n");
    expect(filter.push('ries>[{"op":"add"}]</memories>')).toBe("");
    expect(filter.finish()).toBe("");
  });
});
```

- [ ] **Step 3: Run both tests and verify RED**

Run:

```bash
npm test -- tests/services/agentStreaming/sse.test.ts tests/services/agentStreaming/visibleText.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement the minimal parsers**

For SSE, decode with `{ stream: true }`, normalize CRLF to LF, split records at
blank lines, ignore comment lines beginning with `:`, retain the last `event:`
value, and join multiple `data:` values with `\n`. Check `signal?.throwIfAborted()`
before and after each `reader.read()`, and cancel the reader in `finally`.

For visible text, maintain:

```ts
type Mode = "detect" | "wrapped" | "plain" | "done";
const CONTROL_MARKERS = ["</explanation>", "<actions>", "<memories>"];
const OPEN = "<explanation>";
```

Keep the longest suffix that is a prefix of any relevant marker. In `detect`
mode, suppress a split opening tag; switch to `wrapped` after `OPEN`, otherwise
switch to `plain` when the buffered prefix cannot become `OPEN`. In `wrapped`
or `plain`, emit only content before the earliest complete control marker and
retain possible split-marker suffixes. `finish()` emits only remaining plain or
wrapped visible text and never emits a partial `<...` control prefix.

- [ ] **Step 5: Run both tests and verify GREEN**

Run:

```bash
npm test -- tests/services/agentStreaming/sse.test.ts tests/services/agentStreaming/visibleText.test.ts
```

Expected: PASS with all parser/filter tests.

- [ ] **Step 6: Commit the stream primitives**

```bash
git add src/services/agentStreaming tests/services/agentStreaming
git commit -m "feat: parse model streams safely"
```

---

### Task 3: Provider-Neutral Model Streaming

**Files:**

- Modify: `src/services/agent.ts`
- Modify: `tests/services/agent.test.ts`

**Interfaces:**

- Consumes:

```ts
readSseEvents(body, signal)
createVisibleTextFilter()
```

- Produces:

```ts
export async function createStreamingAgentResponseForUser(
  userId: string,
  message: string,
  history: AgentConversationMessage[],
  context: AgentContext | undefined,
  onDelta: (text: string) => void | Promise<void>,
  signal?: AbortSignal
): Promise<AgentResponse>;
```

- The returned `AgentResponse.message` contains the complete raw model output
  when successful so finalization can parse action/memory blocks. On failure it
  contains the existing local fallback message and `source: "rules"`.

- [ ] **Step 1: Add failing OpenAI-compatible stream tests**

Add helpers to `tests/services/agent.test.ts`:

```ts
const deepSeekConfig = {
  provider: "deepseek" as const,
  providerLabel: "DeepSeek",
  modelName: "deepseek-chat",
  baseUrl: "https://api.deepseek.com",
  apiKey: "sk-configured"
};

function sseResponse(records: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      records.forEach((record) => controller.enqueue(encoder.encode(record)));
      controller.close();
    }
  }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
```

Test:

```ts
it("streams OpenAI-compatible deltas and retains private control blocks", async () => {
  vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
    provider: "deepseek",
    providerLabel: "DeepSeek",
    modelName: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-configured"
  });
  vi.mocked(fetch).mockResolvedValue(sseResponse([
    'data: {"choices":[{"delta":{"content":"<explanation>建议"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"恢复跑。</explanation><actions>[]</actions>"},' +
      '"finish_reason":"stop"}]}\n\n',
    "data: [DONE]\n\n"
  ]));
  const deltas: string[] = [];

  const result = await createStreamingAgentResponseForUser(
    "user-1", "今天怎么练？", [], undefined, (text) => deltas.push(text)
  );

  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
    stream: true
  });
  expect(deltas.join("")).toBe("建议恢复跑。");
  expect(result.message).toContain("<actions>[]</actions>");
  expect(result.source).toBe("model");
});
```

- [ ] **Step 2: Add failing Anthropic, truncation, and abort tests**

Add these cases after the OpenAI-compatible test:

```ts
it("streams Anthropic text deltas through the same visible contract", async () => {
  vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
    provider: "anthropic",
    providerLabel: "Anthropic",
    modelName: "claude-sonnet",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "sk-ant"
  });
  vi.mocked(fetch).mockResolvedValue(sseResponse([
    'event: content_block_delta\ndata: {"type":"content_block_delta",' +
      '"delta":{"type":"text_delta","text":"<explanation>先休息。"}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta",' +
      '"delta":{"type":"text_delta","text":"</explanation>"}}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n'
  ]));
  const deltas: string[] = [];

  const result = await createStreamingAgentResponseForUser(
    "user-1", "今天怎么练？", [], undefined, (text) => deltas.push(text)
  );

  expect(deltas.join("")).toBe("先休息。");
  expect(result).toMatchObject({ source: "model", modelProvider: "Anthropic" });
});

it("falls back without appending fallback text after a truncated partial delta", async () => {
  vi.mocked(loadModelRuntimeConfig).mockResolvedValue(deepSeekConfig);
  vi.mocked(fetch).mockResolvedValue(sseResponse([
    'data: {"choices":[{"delta":{"content":"<explanation>不完整"},' +
      '"finish_reason":"length"}]}\n\n',
    "data: [DONE]\n\n"
  ]));
  const deltas: string[] = [];

  const result = await createStreamingAgentResponseForUser(
    "user-1", "分析本周训练", [], undefined, (text) => deltas.push(text)
  );

  expect(deltas.join("")).toBe("不完整");
  expect(result.source).toBe("rules");
  expect(result.error).toContain("cut off");
  expect(deltas.join("")).not.toContain("using local guidance instead");
});

it("preserves AbortError instead of converting cancellation to fallback", async () => {
  vi.mocked(loadModelRuntimeConfig).mockResolvedValue(deepSeekConfig);
  vi.mocked(fetch).mockRejectedValue(new DOMException("aborted", "AbortError"));
  const controller = new AbortController();
  controller.abort();

  await expect(createStreamingAgentResponseForUser(
    "user-1", "分析本周训练", [], undefined, vi.fn(), controller.signal
  )).rejects.toMatchObject({ name: "AbortError" });
});
```

Assert the prompt body includes the stronger formatting rule:

```ts
expect(payload.messages[0].content).toContain(
  "Always put user-facing text first inside one <explanation>...</explanation> block."
);
```

- [ ] **Step 3: Run the targeted service tests and verify RED**

Run:

```bash
npm test -- tests/services/agent.test.ts
```

Expected: FAIL because `createStreamingAgentResponseForUser` is not exported and
provider requests do not send `stream: true`.

- [ ] **Step 4: Implement streaming provider adapters**

In `src/services/agent.ts`:

1. Strengthen `systemPrompt()` to require exactly one explanation block first.
2. Add `streamOpenAiCompatibleModel()` that calls `/chat/completions` with
   `stream: true`, parses `data:` JSON, appends `delta.content`, records
   `finish_reason`, requires `[DONE]`, and rejects `length`.
3. Add `streamAnthropicModel()` that calls `/messages` with `stream: true`,
   appends `content_block_delta.delta.text`, records `message_delta.stop_reason`,
   requires `message_stop`, and rejects `max_tokens` or `error`.
4. Feed raw deltas through `createVisibleTextFilter()`, call `onDelta()` only
   with non-empty visible output, and accumulate raw output separately.
5. In `createStreamingAgentResponseForUser()`, load Settings, emit the local
   response as one delta if no model exists, preserve `AbortError`, and convert
   other provider errors to the current rule fallback. Emit fallback text only
   when zero visible model text was previously emitted.

Keep `createAgentResponseForUser()` and `runModelCompletion()` unchanged for
non-Agent consumers in this task.

- [ ] **Step 5: Run the service tests and verify GREEN**

Run:

```bash
npm test -- tests/services/agent.test.ts
```

Expected: PASS, including existing non-streaming provider behavior.

- [ ] **Step 6: Commit provider streaming**

```bash
git add src/services/agent.ts tests/services/agent.test.ts
git commit -m "feat: stream configured agent models"
```

---

### Task 4: Shared Orchestration And NDJSON API

**Files:**

- Modify: `src/services/agentOrchestration.ts`
- Modify: `app/api/agent/route.ts`
- Modify: `tests/api/agent.test.ts`
- Modify: `tests/api/agentActions.test.ts`

**Interfaces:**

- Produces:

```ts
export type PreparedAgentMessage = {
  userId: string;
  content: string;
  conversationId: string;
  conversation: AgentConversationSummary;
  history: AgentConversationMessage[];
  context: AgentContext;
};

export type AgentPreparation =
  | { ok: true; value: PreparedAgentMessage }
  | { ok: false; result: AgentMessageResult };

export function prepareAgentMessage(userId: string, body: unknown): Promise<AgentPreparation>;
export function finalizeAgentMessage(
  prepared: PreparedAgentMessage,
  response: AgentResponse
): Promise<AgentMessageResult>;
export function handlePreparedAgentMessage(
  prepared: PreparedAgentMessage
): Promise<AgentMessageResult>;
```

- [ ] **Step 1: Write failing API negotiation tests**

Extend `tests/api/agent.test.ts` with:

```ts
function agentRequest({ accept }: { accept: string }) {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: accept
    },
    body: JSON.stringify({
      conversationId: "conv-1",
      message: "今天怎么训练？"
    })
  });
}

it("keeps JSON for callers that do not request NDJSON", async () => {
  const response = await POST(agentRequest({ accept: "application/json" }));
  expect(response.headers.get("content-type")).toContain("application/json");
  await expect(response.json()).resolves.toMatchObject({ message: "模型回复" });
});

it("streams ordered NDJSON events for opted-in callers", async () => {
  vi.mocked(createStreamingAgentResponseForUser).mockImplementation(
    async (_userId, _message, _history, _context, onDelta) => {
      await onDelta("建议");
      await onDelta("恢复跑。");
      return { intent: "general", message: "<explanation>建议恢复跑。</explanation>",
        source: "model", modelProvider: "DeepSeek", modelName: "deepseek-chat" };
    }
  );

  const response = await POST(agentRequest({ accept: "application/x-ndjson" }));
  const parser = createAgentStreamParser();
  const events = parser.push(new Uint8Array(await response.arrayBuffer()));
  parser.finish();

  expect(response.headers.get("content-type")).toContain("application/x-ndjson");
  expect(response.headers.get("x-accel-buffering")).toBe("no");
  expect(events.map((event) => event.type)).toEqual(["start", "delta", "delta", "final"]);
});
```

Keep the current missing-conversation and unauthorized-conversation tests and
assert they remain JSON `400`/`404` even with the NDJSON `Accept` header.
Update mocked conversation return values to include every field required by
`conversationSchema`:

```ts
const fullConversation = {
  id: "conv-1",
  userId: "user-1",
  title: "恢复",
  summary: null,
  summaryUpdatedAt: null,
  summaryMessageCount: 0,
  createdAt: new Date("2026-07-30T00:00:00.000Z"),
  updatedAt: new Date("2026-07-30T00:00:00.000Z")
};
```

- [ ] **Step 2: Write failing finalization safety tests**

In `tests/api/agentActions.test.ts`, make the mocked stream defer completion:

```ts
let complete!: () => void;
const gate = new Promise<void>((resolve) => { complete = resolve; });
vi.mocked(createStreamingAgentResponseForUser).mockImplementation(
  async (_userId, _message, _history, _context, onDelta) => {
    await onDelta("准备调整。");
    await gate;
    return {
      intent: "replan",
      source: "model",
      message: '<explanation>准备调整。</explanation><actions>[{"id":"adjust_task_intensity",' +
        '"args":{"taskId":"task-1","intensity":"easy"}}]</actions>'
    };
  }
);

const responsePromise = POST(agentRequest({ accept: "application/x-ndjson" }));
await Promise.resolve();
expect(executeAgentAction).not.toHaveBeenCalled();
complete();
const response = await responsePromise;
await response.text();
expect(executeAgentAction).toHaveBeenCalledTimes(1);
```

Add an abort case asserting provider abort leaves `agentMessage.create` and
`executeAgentAction` uncalled:

```ts
it("aborts provider generation and skips finalization when the client cancels", async () => {
  const providerAborted = vi.fn();
  vi.mocked(createStreamingAgentResponseForUser).mockImplementation(
    async (_userId, _message, _history, _context, _onDelta, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          providerAborted();
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      })
  );

  const response = await POST(agentRequest({ accept: "application/x-ndjson" }));
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();

  await vi.waitFor(() => expect(providerAborted).toHaveBeenCalled());
  expect(prisma.agentMessage.create).not.toHaveBeenCalled();
  expect(executeAgentAction).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run API tests and verify RED**

Run:

```bash
npm test -- tests/api/agent.test.ts tests/api/agentActions.test.ts
```

Expected: FAIL because the route always returns `NextResponse.json` and the
orchestration is not split.

- [ ] **Step 4: Extract prepare and finalize without changing legacy behavior**

Move validation, conversation lookup, history loading, routing, and context
construction into `prepareAgentMessage()`. Move everything after model
generation into `finalizeAgentMessage()`. Implement:

```ts
export async function handleAgentMessage(userId: string, body: unknown) {
  const prepared = await prepareAgentMessage(userId, body);
  if (!prepared.ok) return prepared.result;
  return handlePreparedAgentMessage(prepared.value);
}
```

Run the existing API tests before changing the route:

```bash
npm test -- tests/api/agent.test.ts tests/api/agentActions.test.ts
```

Expected at this intermediate point: existing JSON tests PASS; new streaming
tests still FAIL.

- [ ] **Step 5: Implement the negotiated NDJSON route**

After rate limiting and `request.json()`, call `prepareAgentMessage()` before
creating a stream. Return its JSON error result if `ok` is false.

If the `Accept` header does not include `AGENT_STREAM_MEDIA_TYPE`, call
`handlePreparedAgentMessage()` and return the existing JSON response.

Otherwise create a `ReadableStream<Uint8Array>` whose `start()`:

```ts
enqueue({ type: "start", requestId: crypto.randomUUID() });
const modelResponse = await createStreamingAgentResponseForUser(
  user.id,
  prepared.value.content,
  prepared.value.history,
  prepared.value.context,
  (text) => enqueue({ type: "delta", text }),
  abortController.signal
);
const result = await finalizeAgentMessage(prepared.value, modelResponse);
enqueue({ type: "final", ...(result.body as AgentFinalPayload) });
controller.close();
```

Link `request.signal` to an internal `AbortController`. In the stream's
`cancel()`, abort it. Do not convert abort into a terminal event. Convert other
post-start failures to:

```ts
{ type: "error", error: message, code: "stream_interrupted" }
```

Return `Response` with NDJSON, `no-cache, no-transform`, and
`X-Accel-Buffering: no` headers plus rate-limit headers.

- [ ] **Step 6: Run API tests and verify GREEN**

Run:

```bash
npm test -- tests/api/agent.test.ts tests/api/agentActions.test.ts
```

Expected: PASS for legacy JSON, ordered NDJSON, pre-stream errors, action timing,
and abort behavior.

- [ ] **Step 7: Commit API streaming**

```bash
git add src/services/agentOrchestration.ts app/api/agent/route.ts tests/api/agent.test.ts tests/api/agentActions.test.ts
git commit -m "feat: stream agent API responses"
```

---

### Task 5: Web Incremental Rendering

**Files:**

- Modify: `components/AgentPanel.tsx`
- Modify: `tests/components/AgentPanel.test.tsx`

**Interfaces:**

- Consumes:

```ts
createAgentStreamParser()
AGENT_STREAM_MEDIA_TYPE
AgentStreamEvent
```

- [ ] **Step 1: Write the failing Web rendering test**

Add a stream helper:

```ts
const fullConversation = {
  id: "conv-1",
  userId: "user-1",
  title: "恢复",
  summary: null,
  summaryUpdatedAt: null,
  summaryMessageCount: 0,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z"
};

function controlledNdjsonResponse() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  return {
    response: new Response(new ReadableStream({
      start(value) { controller = value; }
    }), { status: 200, headers: { "Content-Type": "application/x-ndjson" } }),
    event(value: unknown) { controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`)); },
    close() { controller.close(); }
  };
}
```

Test:

```ts
it("renders deltas into one assistant message and reconciles final metadata", async () => {
  const stream = controlledNdjsonResponse();
  const fetchMock = vi.fn().mockResolvedValue(stream.response);
  vi.stubGlobal("fetch", fetchMock);
  render(<AgentPanel initialConversations={conversations}
    initialConversationId="conv-1" initialMessages={[]} />);

  fireEvent.change(screen.getByPlaceholderText(
    "Ask about training, recovery, calendar, or meals"
  ), { target: { value: "今天怎么练？" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(fetchMock).toHaveBeenCalledWith("/api/agent", expect.objectContaining({
    headers: expect.objectContaining({ Accept: "application/x-ndjson" })
  }));
  stream.event({ type: "start", requestId: "req-1" });
  stream.event({ type: "delta", text: "建议" });
  await waitFor(() => expect(screen.getByLabelText("AI message")).toHaveTextContent("建议"));
  stream.event({ type: "delta", text: "恢复跑。" });
  stream.event({ type: "final", message: "建议恢复跑。\n已安全调整",
    intent: "replan", source: "model", conversation: fullConversation,
    adjustments: [{ id: "adj-1", label: "已安全调整", undoneAt: null }],
    appliedMemories: [] });
  stream.close();

  await waitFor(() => expect(screen.getByLabelText("AI message"))
    .toHaveTextContent("建议恢复跑。 已安全调整"));
  expect(screen.getAllByLabelText("AI message")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "撤销" })).toBeInTheDocument();
});
```

Add abrupt EOF and JSON `400` tests that verify the composer is re-enabled and
a retryable error is shown.

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
npm test -- tests/components/AgentPanel.test.tsx
```

Expected: FAIL because send still calls `response.json()` and no assistant draft
exists before completion.

- [ ] **Step 3: Implement incremental Web state**

In `sendMessage()`:

1. Append both `local-...-user` and `local-...-assistant` messages in one state
   update; initialize assistant content to `""`.
2. Send `Accept: AGENT_STREAM_MEDIA_TYPE`.
3. If response is non-2xx, parse the existing JSON error and throw.
4. Require `response.body`; read chunks, pass them through
   `createAgentStreamParser()`, and handle events:
   - `delta`: append text to the local assistant by id.
   - `final`: replace content with `event.message`, set adjustments, and update
     the conversation list.
   - `error`: throw `Error(event.error)`.
5. Call `parser.finish()` at EOF.
6. In `catch`, remove an empty assistant draft; keep a non-empty draft and set
   the error to `回复中断，请重试。` for abrupt EOF, otherwise use the server
   error.
7. Set `sending` false in `finally`.

Change the scroll effect dependency from `[messages.length]` to a value that
also changes with the last message content so streamed deltas remain visible:

```ts
const lastMessageContent = messages.at(-1)?.content;
// ...
}, [messages.length, lastMessageContent]);
```

- [ ] **Step 4: Run the component test and verify GREEN**

Run:

```bash
npm test -- tests/components/AgentPanel.test.tsx
```

Expected: PASS, including existing layout, suggestions, deletion, and undo tests.

- [ ] **Step 5: Commit Web rendering**

```bash
git add components/AgentPanel.tsx tests/components/AgentPanel.test.tsx
git commit -m "feat: render agent stream on web"
```

---

### Task 6: iOS Streaming Request And Incremental Coach UI

**Files:**

- Create: `apps/mobile/src/api/agentStream.ts`
- Create: `apps/mobile/src/api/agentStream.test.ts`
- Modify: `apps/mobile/src/api/client.ts`
- Modify: `apps/mobile/src/api/agent.ts`
- Modify: `apps/mobile/src/coachMessages.ts`
- Modify: `apps/mobile/src/coachMessages.test.ts`
- Modify: `apps/mobile/app/(app)/(tabs)/coach.tsx`
- Modify: `apps/mobile/src/coachLifecycle.test.ts`

**Interfaces:**

- `client.ts` produces:

```ts
export function getApiBaseUrl(): string;
export function getV1ApiUrl(path: string): string;
export function getValidAccessToken(options?: { forceRefresh?: boolean }): Promise<string | null>;
export function handleUnauthorized(): Promise<void>;
```

- `agentStream.ts` produces:

```ts
export async function streamAgentMessage(
  conversationId: string,
  message: string,
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal
): Promise<void>;
```

- `coachMessages.ts` produces:

```ts
export function appendAssistantDelta(
  messages: AgentMessage[],
  assistantId: string,
  text: string
): AgentMessage[];

export function finalizeAssistantMessage(
  messages: AgentMessage[],
  assistantId: string,
  event: Extract<AgentStreamEvent, { type: "final" }>
): AgentMessage[];
```

- [ ] **Step 1: Write failing pure Coach message-state tests**

```ts
const fullConversation = {
  id: "conv-1",
  userId: "user-1",
  title: "恢复",
  summary: null,
  summaryUpdatedAt: null,
  summaryMessageCount: 0,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z"
};

it("appends deltas to one local assistant and reconciles the final event", () => {
  const initial: AgentMessage[] = [
    { id: "local-user-1", role: "user", content: "今天怎么练？" },
    { id: "local-assistant-1", role: "assistant", content: "" }
  ];

  const partial = appendAssistantDelta(initial, "local-assistant-1", "建议恢复跑。");
  const final = finalizeAssistantMessage(partial, "local-assistant-1", {
    type: "final",
    message: "建议恢复跑。\n已安全调整",
    intent: "replan",
    source: "model",
    conversation: fullConversation,
    adjustments: [{ id: "adj-1", label: "已安全调整", undoneAt: null }],
    appliedMemories: []
  });

  expect(final[1]).toMatchObject({
    id: "local-assistant-1",
    content: "建议恢复跑。\n已安全调整",
    adjustments: [{ id: "adj-1" }]
  });
});
```

- [ ] **Step 2: Write failing `expo/fetch` network tests**

Mock `expo/fetch` separately from global `fetch`:

```ts
const expoFetch = vi.hoisted(() => vi.fn());
vi.mock("expo/fetch", () => ({ fetch: expoFetch }));
```

Test that `streamAgentMessage()`:

- Sends `POST http://localhost:3000/api/v1/agent`.
- Sends bearer authentication, JSON content type, and NDJSON accept.
- Delivers `start`, split `delta`, and `final` in order.
- On the first `401`, calls the existing single-flight refresh, retries once,
  and consumes only the successful response body.
- Throws on JSON `400` without invoking `onEvent`.
- Throws on abrupt EOF and respects `AbortSignal`.

- [ ] **Step 3: Run mobile helper/network tests and verify RED**

Run:

```bash
npm test --workspace @hbm/mobile -- src/coachMessages.test.ts src/api/agentStream.test.ts
```

Expected: FAIL because the helpers and streaming module do not exist.

- [ ] **Step 4: Expose reusable authentication without changing JSON requests**

Refactor `apps/mobile/src/api/client.ts` so the current request path and the new
stream path share URL construction, access-token loading, single-flight refresh,
and unauthorized cleanup. Keep all existing `api.get/post/patch/delete/auth`
behavior and tests unchanged.

Run:

```bash
npm test --workspace @hbm/mobile -- src/api/client.test.ts src/api/agent.test.ts
```

Expected: PASS for existing JSON client behavior.

- [ ] **Step 5: Implement `streamAgentMessage()` with `expo/fetch`**

Use:

```ts
import { fetch as expoFetch } from "expo/fetch";
```

Build a helper that attempts the request with the current access token. On the
first `401`, obtain a forced refreshed token and retry once. For non-2xx
responses, parse JSON error text. For success, require `response.body`, loop on
`reader.read()`, feed chunks to `createAgentStreamParser()`, and invoke
`onEvent()` synchronously in order. Call `parser.finish()` at EOF and cancel the
reader when aborted.

Re-export the function from `apps/mobile/src/api/agent.ts`.

- [ ] **Step 6: Implement the pure Coach state helpers**

Both helpers map only the target message id and preserve every other object.
`appendAssistantDelta()` concatenates `text`. `finalizeAssistantMessage()`
replaces content with the canonical final message and sets adjustments.

- [ ] **Step 7: Run mobile helper/network tests and verify GREEN**

Run:

```bash
npm test --workspace @hbm/mobile -- src/coachMessages.test.ts src/api/agentStream.test.ts src/api/client.test.ts src/api/agent.test.ts
```

Expected: PASS.

- [ ] **Step 8: Write the failing Coach lifecycle source test**

Extend `apps/mobile/src/coachLifecycle.test.ts` to require:

```ts
expect(source).toContain("streamAgentMessage");
expect(source).toContain("appendAssistantDelta");
expect(source).toContain("finalizeAssistantMessage");
expect(source).toContain("AbortController");
expect(source).not.toContain("sendMutation.mutate");
```

Run:

```bash
npm test --workspace @hbm/mobile -- src/coachLifecycle.test.ts
```

Expected: FAIL because Coach still uses `sendMutation`.

- [ ] **Step 9: Replace the one-shot mutation with incremental Coach state**

In `coach.tsx`:

1. Replace `sendMutation` with `sending` boolean state and an
   `AbortController` ref.
2. On submit, append the optimistic user message and empty assistant message in
   one update.
3. Call `streamAgentMessage()` and handle:
   - `delta` with `appendAssistantDelta()`.
   - `final` with `finalizeAssistantMessage()`, conversation cache update, and
     conversation/memory invalidation.
   - `error` by throwing its error text.
4. In `catch`, remove an empty assistant draft or preserve a partial draft,
   show `回复中断，请重试。` for abrupt EOF, and avoid cache invalidation.
5. In `finally`, clear the controller and `sending`.
6. Abort on component unmount.
7. Replace every `sendMutation.isPending` use with `sending`; keep
   `Coach 正在回复...`.

- [ ] **Step 10: Run Coach and full mobile tests**

Run:

```bash
npm test --workspace @hbm/mobile -- src/coachLifecycle.test.ts src/coachMessages.test.ts src/api/agentStream.test.ts
npm test --workspace @hbm/mobile
```

Expected: targeted tests PASS, then the complete mobile suite passes with zero
failures.

- [ ] **Step 11: Commit iOS streaming**

```bash
git add apps/mobile/src/api/client.ts apps/mobile/src/api/agent.ts \
  apps/mobile/src/api/agentStream.ts apps/mobile/src/api/agentStream.test.ts \
  apps/mobile/src/coachMessages.ts apps/mobile/src/coachMessages.test.ts \
  apps/mobile/src/coachLifecycle.test.ts 'apps/mobile/app/(app)/(tabs)/coach.tsx'
git commit -m "feat: render agent stream on ios"
```

---

### Task 7: Cross-Layer Verification And Handoff

**Files:**

- Modify only files required by failures directly caused by Tasks 1–6.

**Interfaces:**

- Consumes the completed streaming contract, provider adapters, API, Web client,
  and iOS client.
- Produces fresh evidence that the feature satisfies the specification.

- [ ] **Step 1: Run focused streaming regression suites**

```bash
npm test -- \
  tests/contracts/agentStream.test.ts \
  tests/services/agentStreaming/sse.test.ts \
  tests/services/agentStreaming/visibleText.test.ts \
  tests/services/agent.test.ts \
  tests/api/agent.test.ts \
  tests/api/agentActions.test.ts \
  tests/components/AgentPanel.test.tsx

npm test --workspace @hbm/mobile -- \
  src/api/agentStream.test.ts \
  src/api/client.test.ts \
  src/api/agent.test.ts \
  src/coachMessages.test.ts \
  src/coachLifecycle.test.ts
```

Expected: all focused tests PASS with zero failures.

- [ ] **Step 2: Run full Web and mobile test suites**

```bash
npm test
npm test --workspace @hbm/mobile
```

Expected: both suites exit 0 with zero failed tests.

- [ ] **Step 3: Run both TypeScript checks**

```bash
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p apps/mobile/tsconfig.json
```

Expected: both commands exit 0 with no diagnostics.

- [ ] **Step 4: Run whitespace and production-build verification**

```bash
git diff --check
npm run build
```

Expected: `git diff --check` prints nothing and exits 0; Next.js production
build exits 0.

- [ ] **Step 5: Inspect final scope**

```bash
git status --short
git diff --stat HEAD~6..HEAD
git log -7 --oneline
```

Expected: only Agent streaming files are changed; the log shows one focused
commit for each task plus the pre-existing plan commit. The pre-existing,
user-owned untracked file `scripts/coros-recovery-probe.mts` may still appear in
status and must not be staged, edited, or removed.

- [ ] **Step 6: Report evidence and remaining runtime boundary**

Report exact test counts, typecheck/build status, commits, and branch state.
State explicitly that automated stream tests prove chunked protocol handling,
while a real configured provider on a running Web session and physical iPhone
remain runtime acceptance unless both were exercised during implementation.

If any verification command fails, return to the task that owns the failing
behavior, add a failing regression test there, repeat its red-green cycle, and
amend that task with a new focused fix commit before rerunning Task 7 from
Step 1. Do not make a catch-all verification commit.
