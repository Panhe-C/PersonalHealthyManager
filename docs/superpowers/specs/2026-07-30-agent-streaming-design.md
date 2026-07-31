# Agent Streaming Design

## Goal

Make Healthy Body Agent responses stream from the configured model through the
server to both the Web and iOS chat interfaces. Users should see the visible
answer grow as it is generated instead of waiting for the complete model turn.

The design must preserve the current Agent semantics:

- Model selection still comes from Settings.
- Conversation history and app context remain conversation-scoped.
- Agent actions and long-term memory proposals remain server-only.
- Actions, memories, messages, summaries, and conversation metadata are
  finalized only after the model stream completes successfully.
- Existing non-streaming API consumers continue to receive one JSON response.

## Scope

In scope:

- Streaming adapters for OpenAI-compatible and Anthropic model APIs.
- A provider-neutral stream representation inside the server.
- An NDJSON response protocol for `/api/agent` and `/api/v1/agent`.
- Incremental rendering in the Web Agent panel.
- Incremental rendering in the Expo iOS Coach tab using `expo/fetch`.
- Safe filtering of `<explanation>`, `<actions>`, and `<memories>` output.
- Fallback, truncation, transport-error, and cancellation behavior.
- Automated coverage for provider parsing, API events, and both clients.

Out of scope:

- WebSockets.
- Background generation that continues after a client disconnects.
- Resuming a disconnected stream.
- Streaming action execution or memory writes.
- Streaming arbitrary endpoints besides Agent chat.
- Changing the conversation, action, memory, or Settings data models.

## Chosen Approach

Use content negotiation and newline-delimited JSON (NDJSON).

Clients that want streaming send:

```http
Accept: application/x-ndjson
```

The server returns:

```http
Content-Type: application/x-ndjson; charset=utf-8
Cache-Control: no-cache, no-transform
X-Accel-Buffering: no
```

Each line is one complete JSON object followed by `\n`. NDJSON is preferred
over raw provider SSE because the current request is an authenticated `POST`
with a JSON body and because Web and iOS need one provider-neutral protocol.
The server owns all OpenAI-compatible and Anthropic format differences.

Requests without the NDJSON `Accept` value keep the existing JSON response
contract. This preserves compatibility for tests, scripts, and any external
consumer while the first-party Web and iOS clients opt into streaming.

## Stream Event Contract

The server may send four event types:

```ts
type AgentStreamEvent =
  | {
      type: "start";
      requestId: string;
    }
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "final";
      message: string;
      intent: AgentIntent;
      source: "model" | "rules";
      modelProvider?: string;
      modelName?: string;
      error?: string;
      conversation: AgentConversationSummary;
      adjustments: ExecutedAdjustment[];
      appliedMemories: AppliedMemory[];
    }
  | {
      type: "error";
      error: string;
      code: "request_failed" | "stream_interrupted";
    };
```

Event rules:

- `start` is emitted after request validation, authorization, conversation
  lookup, history loading, and context construction succeed.
- `delta` contains user-visible text only and may be emitted many times.
- Exactly one terminal `final` or `error` event is emitted when the connection
  remains writable.
- `final.message` is canonical. Clients replace their accumulated draft with
  this value so server-added safety notes, memory confirmations, and formatting
  corrections are reflected.
- Validation failures that happen before streaming begins keep their existing
  JSON status codes (`400`, `404`, `429`). Failures after the streaming response
  starts are represented by terminal stream events because the HTTP status can
  no longer change.

## Provider Streaming

Add a provider-neutral model stream API alongside the existing completion API.
It should expose visible text deltas while accumulating the complete raw model
message and finish metadata on the server.

### OpenAI-Compatible Providers

DeepSeek, Kimi, MiniMax-compatible custom endpoints, and `custom` use
`/chat/completions` with:

```json
{
  "stream": true
}
```

The adapter parses SSE `data:` records:

- Append `choices[0].delta.content` when it is a string.
- Record `choices[0].finish_reason`.
- Treat `[DONE]` as transport completion, not proof of a successful finish.
- Mark a `length` finish reason as truncated and keep the accumulated text.
- Reject an EOF without a recognized terminal record.
- Parse an error response as JSON when the provider returns a non-2xx status.

The SSE parser must tolerate arbitrary byte boundaries, CRLF or LF separators,
comments, multiple `data:` lines, and UTF-8 characters split across chunks.

### Anthropic

Anthropic uses `/messages` with `stream: true`. The adapter parses these SSE
events:

- `content_block_delta` with `delta.type === "text_delta"` contributes text.
- `message_delta` records `delta.stop_reason`.
- `message_stop` marks transport completion.
- `error` fails the model stream.
- `max_tokens` is treated as truncated, keeping the accumulated text.

### Rule Fallback

If no model runtime is configured, the existing local rule response is emitted
as one `delta` followed by `final`.

If the provider fails before any safe visible text is emitted, the existing
local fallback response is streamed and finalized with `source: "rules"` and
the provider error attached.

If the provider fails or disconnects after visible deltas have been emitted,
the server must not execute actions or apply memories from the incomplete
output. The `final` event replaces the partial draft with the existing local
fallback response and includes the provider error. This keeps the current
fail-closed behavior even though the user may briefly see partial model text.

Truncation is handled differently from failure. When the provider reports that
it hit the output token limit but produced usable text, the answer is kept:
`final` carries `source: "model"`, `truncated: true`, the provider error, and
the partial explanation plus a server note telling the user the reply was cut
short. Actions and memories from a truncated reply are still skipped, so the
turn stays fail-closed for side effects while the user keeps the analysis.

## Safe Visible-Text Filtering

Raw model output may contain user-facing explanation plus private control
blocks:

```text
<explanation>...</explanation>
<actions>...</actions>
<memories>...</memories>
```

The server must never stream action or memory JSON to a client.

Update the prompt to require the explanation first and to wrap it in
`<explanation>`. A stateful incremental filter processes model text:

1. Ignore the opening `<explanation>` tag when present.
2. Emit text inside the explanation.
3. Stop emitting at `</explanation>`, `<actions>`, or `<memories>`.
4. Keep enough trailing characters buffered to recognize a control tag split
   across provider chunks.
5. If a provider returns plain text without an explanation wrapper, emit it
   while applying the same split-tag protection.
6. Accumulate the complete raw message separately for the existing action and
   memory parsers.

The final persisted assistant message contains only the parsed explanation and
server-generated notes. Raw control blocks are never persisted as visible
message content.

## Server Orchestration

Split the existing turn orchestration into three explicit stages:

1. **Prepare** — validate input, authorize the conversation, load recent
   history, route the intent, and build Agent context.
2. **Generate** — stream the provider response, accumulate the raw message,
   filter visible text, and surface provider completion metadata.
3. **Finalize** — parse actions and memories, persist both messages, apply safe
   reversible actions and memories, refresh the summary, touch the
   conversation, and construct the canonical response.

The non-streaming handler reuses all three stages but collects generation
deltas internally and returns the existing JSON body. The streaming handler
maps generation deltas to NDJSON and maps finalization to the `final` event.
This avoids separate business logic for the two protocols.

Persist the user and assistant messages during finalization, matching current
behavior. A canceled or failed turn therefore does not leave a user message
without a corresponding finalized assistant message.

The request's abort signal is forwarded to the provider fetch. If the client
disconnects, provider generation is aborted and finalization does not execute.

## Web Client

The Web Agent panel sends `Accept: application/x-ndjson` and reads
`response.body` with a `ReadableStream` reader and a streaming `TextDecoder`.

On send:

1. Optimistically append the user message.
2. Append an empty local assistant message.
3. Append each `delta.text` to that assistant message.
4. Keep the composer disabled while the turn is active.
5. On `final`, replace draft content with `final.message`, attach adjustments,
   update conversation metadata, and clear the sending state.
6. On a terminal `error` or malformed/abrupt EOF, remove an empty draft or keep
   a non-empty draft marked as interrupted, then show a retryable error.

The existing rich Markdown renderer receives the current accumulated string.
No new Markdown library or typing animation is required.

## iOS Client

The Expo app adds a dedicated streaming Agent request rather than changing the
generic JSON API client.

It uses `fetch` from `expo/fetch`, which exposes a native
`response.body.getReader()` in the project's installed Expo SDK. The request
keeps the existing bearer token and one-time refresh behavior, then parses the
same NDJSON events as Web.

The Coach tab follows the same optimistic user message, empty assistant draft,
delta append, and final reconciliation flow as Web. The existing
`Coach 正在回复...` label may remain as status feedback, but it appears beside
the growing assistant response instead of being the only feedback.

The streaming request accepts callbacks or an async event iterator rather than
forcing TanStack Query to represent partial data as a single mutation result.
Conversation and memory queries are invalidated only after `final`.

## Shared NDJSON Parsing

Use a small parser with these responsibilities:

- Decode UTF-8 incrementally.
- Preserve an incomplete final line between chunks.
- Parse every completed non-empty line as JSON.
- Validate event discriminators and required fields.
- Reject unknown or malformed terminal events.
- Reject EOF without `final` or `error`.

The server event types and schemas belong in the shared contracts workspace so
Web, server, and mobile agree on the wire format. Runtime stream readers remain
platform-specific because Web uses global `fetch` while iOS uses `expo/fetch`.

## Error And Cancellation Semantics

- Authentication refresh on iOS happens before consuming a successful response
  body. A `401` may be retried once using the existing single-flight refresh.
- `400`, `404`, and `429` responses remain JSON and are parsed before attempting
  NDJSON consumption.
- A provider error before the response starts uses the existing fallback and a
  successful stream status.
- A provider error after streaming starts ends with a fallback `final` when the
  server can still write; otherwise the client detects abrupt EOF.
- Client cancellation aborts the provider call and skips finalization.
- No action or memory is executed until the provider reports a complete,
  non-truncated response. A truncated reply keeps its text but executes
  nothing.
- A malformed control block may produce warnings, as it does today, but cannot
  leak into visible deltas.

## Testing

Follow test-driven development with a red-green cycle for each layer.

### Provider And Stream Unit Tests

- OpenAI-compatible SSE chunks produce normalized text deltas.
- Anthropic SSE chunks produce normalized text deltas.
- UTF-8 characters and SSE records split across chunks are reconstructed.
- `[DONE]`, `message_stop`, finish reasons, non-2xx errors, provider `error`
  events, abrupt EOF, and truncation are handled correctly.
- The safe text filter never emits actions, memories, or a partial control tag.
- Plain-text model output still streams.
- The NDJSON parser handles multiple events in one chunk and one event split
  across chunks.

### Orchestration And API Tests

- Requests without the streaming `Accept` header keep the existing JSON result.
- Streaming requests return NDJSON headers and ordered `start`, `delta`, and
  `final` events.
- Pre-stream validation retains JSON error statuses.
- Finalization persists the canonical explanation and applies only complete
  action and memory proposals.
- Truncated or interrupted model streams do not execute actions or memories.
- Client abort propagates to the provider and skips persistence.

### Web Tests

- An empty assistant draft appears immediately.
- Multiple deltas update the same message in order.
- `final` replaces the draft and attaches adjustments.
- JSON validation errors and abrupt stream termination are visible and restore
  the composer state.

### iOS Tests

- The streaming request uses `expo/fetch`, bearer authentication, and the
  NDJSON `Accept` header.
- A token refresh retries once before stream consumption.
- Coach renders incremental deltas into one assistant message.
- `final` reconciles the message and invalidates conversation and memory data.
- Cancellation and malformed streams restore the send state without applying
  partial metadata.

## Acceptance Criteria

- On Web and iOS, a configured streaming-capable model visibly renders more
  than one incremental update before the final response under normal network
  conditions.
- Neither client displays `<actions>`, `<memories>`, their JSON payloads, or
  partial forms of those tags.
- Actions and memories execute only after a complete provider response.
- The final UI content and persisted assistant content match.
- Provider errors retain the current local-guidance fallback behavior.
- Existing JSON Agent callers remain compatible.
- Targeted provider, API, Web, and mobile tests pass, followed by the full Web
  and mobile test suites, TypeScript checks, and a production build.
