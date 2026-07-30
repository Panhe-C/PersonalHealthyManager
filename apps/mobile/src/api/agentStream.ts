import { fetch as expoFetch } from "expo/fetch";
import {
  AGENT_STREAM_MEDIA_TYPE,
  createAgentStreamParser,
  type AgentStreamEvent
} from "@hbm/contracts";
import { ApiError, getV1ApiUrl, getValidAccessToken, handleUnauthorized } from "./client";

type StreamAgentMessageOptions = {
  signal?: AbortSignal;
  onEvent: (event: AgentStreamEvent) => void;
};

async function readError(response: Response) {
  try {
    const body = JSON.parse(await response.text()) as { error?: string; code?: string };
    return new ApiError(body.error ?? `Request failed with ${response.status}`, response.status, body.code);
  } catch {
    return new ApiError(`Request failed with ${response.status}`, response.status);
  }
}

async function requestAgentStream(
  conversationId: string,
  message: string,
  signal: AbortSignal | undefined,
  forceRefresh: boolean
) {
  const accessToken = await getValidAccessToken(forceRefresh);
  if (forceRefresh && !accessToken) {
    await handleUnauthorized();
    throw new ApiError("Unauthorized", 401, "unauthorized");
  }

  const headers: Record<string, string> = {
    Accept: AGENT_STREAM_MEDIA_TYPE,
    "Content-Type": "application/json"
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  return expoFetch(getV1ApiUrl("/agent"), {
    method: "POST",
    headers,
    body: JSON.stringify({ conversationId, message }),
    signal
  });
}

export async function streamAgentMessage(
  conversationId: string,
  message: string,
  options: StreamAgentMessageOptions
) {
  let response = await requestAgentStream(conversationId, message, options.signal, false);
  if (response.status === 401) {
    response = await requestAgentStream(conversationId, message, options.signal, true);
  }
  if (!response.ok) {
    if (response.status === 401) await handleUnauthorized();
    throw await readError(response as Response);
  }
  if (!response.body) throw new ApiError("Streaming response body is unavailable", response.status, "stream_unavailable");

  const reader = response.body.getReader();
  const parser = createAgentStreamParser();
  const deliver = (events: AgentStreamEvent[]) => {
    for (const event of events) {
      options.onEvent(event);
      if (event.type === "error") throw new ApiError(event.error, 200, event.code);
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      deliver(parser.push(value));
    }
    deliver(parser.finish());
  } finally {
    reader.releaseLock();
  }
}
