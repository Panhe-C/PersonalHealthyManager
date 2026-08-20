import { NextResponse } from "next/server";
import { withUser } from "@/src/auth/api";
import { createStreamingAgentResponseForUser } from "@/src/services/agent";
import {
  finalizeAgentMessage,
  handlePreparedAgentMessage,
  prepareAgentMessage
} from "@/src/services/agentOrchestration";
import { consumeRateLimit, rateLimitHeaders } from "@/src/security/rateLimit";
import {
  AGENT_STREAM_MEDIA_TYPE,
  encodeAgentStreamEvent,
  type AgentFinalPayload,
  type AgentStreamEvent
} from "@hbm/contracts";

export const POST = withUser(async (user, request: Request) => {
  const limit = consumeRateLimit({ key: `agent:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many agent requests", code: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }
  const body = await request.json().catch(() => null);
  const prepared = await prepareAgentMessage(user.id, body);
  if (!prepared.ok) {
    return NextResponse.json(prepared.result.body, {
      status: prepared.result.status,
      headers: rateLimitHeaders(limit)
    });
  }

  if (!request.headers.get("accept")?.includes(AGENT_STREAM_MEDIA_TYPE)) {
    const result = await handlePreparedAgentMessage(prepared.value);
    return NextResponse.json(result.body, {
      status: result.status,
      headers: rateLimitHeaders(limit)
    });
  }

  const abortController = new AbortController();
  const abortFromRequest = () => abortController.abort(request.signal.reason);
  if (request.signal.aborted) abortFromRequest();
  else request.signal.addEventListener("abort", abortFromRequest, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: AgentStreamEvent) => {
        controller.enqueue(encodeAgentStreamEvent(event));
      };
      const close = () => {
        try {
          controller.close();
        } catch {
          // The client may already have canceled the stream.
        }
      };

      try {
        enqueue({ type: "start", requestId: crypto.randomUUID() });
        const onDelta = (text: string) => enqueue({ type: "delta", text } as AgentStreamEvent);
        const modelResponse = prepared.value.attachments.length
          ? await createStreamingAgentResponseForUser(
              user.id,
              prepared.value.content,
              prepared.value.history,
              prepared.value.context,
              onDelta,
              abortController.signal,
              prepared.value.attachments
            )
          : await createStreamingAgentResponseForUser(
              user.id,
              prepared.value.content,
              prepared.value.history,
              prepared.value.context,
              onDelta,
              abortController.signal
            );
        abortController.signal.throwIfAborted();
        const result = await finalizeAgentMessage(prepared.value, modelResponse);
        enqueue({
          type: "final",
          ...(result.body as AgentFinalPayload)
        });
        close();
      } catch (error) {
        if (!abortController.signal.aborted) {
          const message = error instanceof Error ? error.message : "Agent stream failed.";
          try {
            enqueue({ type: "error", error: message, code: "stream_interrupted" });
          } catch {
            // The client disconnected before the terminal event could be sent.
          }
        }
        close();
      } finally {
        request.signal.removeEventListener("abort", abortFromRequest);
      }
    },
    cancel(reason) {
      abortController.abort(reason);
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": `${AGENT_STREAM_MEDIA_TYPE}; charset=utf-8`,
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      ...rateLimitHeaders(limit)
    }
  });
});
