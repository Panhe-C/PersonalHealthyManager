export type SseEvent = {
  event?: string;
  data: string;
};

function parseRecord(record: string): SseEvent | null {
  let event: string | undefined;
  const data: string[] = [];

  for (const line of record.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    let value = separator >= 0 ? line.slice(separator + 1) : "";
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }

  if (data.length === 0) return null;
  return event ? { event, data: data.join("\n") } : { data: data.join("\n") };
}

export async function* readSseEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  try {
    while (true) {
      signal?.throwIfAborted();
      const result = await reader.read();
      signal?.throwIfAborted();
      if (result.done) {
        completed = true;
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      let separator = /\r?\n\r?\n/.exec(buffer);
      while (separator) {
        const record = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const event = parseRecord(record);
        if (event) yield event;
        separator = /\r?\n\r?\n/.exec(buffer);
      }
    }

    buffer += decoder.decode();
    const finalEvent = parseRecord(buffer);
    if (finalEvent) yield finalEvent;
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
