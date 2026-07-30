const OPEN_EXPLANATION = "<explanation>";
const CONTROL_MARKERS = ["</explanation>", "<actions>", "<memories>"] as const;

type Mode = "detect" | "wrapped" | "plain" | "done";

function possibleMarkerSuffixLength(value: string): number {
  const maxLength = Math.min(
    value.length,
    Math.max(...CONTROL_MARKERS.map((marker) => marker.length))
  );

  for (let length = maxLength; length > 0; length -= 1) {
    const suffix = value.slice(-length).toLowerCase();
    if (CONTROL_MARKERS.some((marker) => marker.startsWith(suffix))) return length;
  }

  return 0;
}

export function createVisibleTextFilter() {
  let mode: Mode = "detect";
  let buffer = "";

  function emitSafeText(): string {
    if (mode !== "wrapped" && mode !== "plain") return "";
    const lower = buffer.toLowerCase();
    const markerIndex = CONTROL_MARKERS.reduce((earliest, marker) => {
      const index = lower.indexOf(marker);
      return index >= 0 && (earliest < 0 || index < earliest) ? index : earliest;
    }, -1);

    if (markerIndex >= 0) {
      const visible = buffer.slice(0, markerIndex);
      buffer = "";
      mode = "done";
      return visible;
    }

    const heldLength = possibleMarkerSuffixLength(buffer);
    const visible = heldLength > 0 ? buffer.slice(0, -heldLength) : buffer;
    buffer = heldLength > 0 ? buffer.slice(-heldLength) : "";
    return visible;
  }

  function detectMode(): string {
    if (mode !== "detect") return emitSafeText();
    const trimmed = buffer.trimStart();
    const leadingLength = buffer.length - trimmed.length;
    const lower = trimmed.toLowerCase();

    if (!trimmed) return "";
    if (OPEN_EXPLANATION.startsWith(lower)) return "";

    if (lower.startsWith(OPEN_EXPLANATION)) {
      buffer = buffer.slice(leadingLength + OPEN_EXPLANATION.length);
      mode = "wrapped";
      return emitSafeText();
    }

    mode = "plain";
    return emitSafeText();
  }

  return {
    push(rawDelta: string): string {
      if (!rawDelta || mode === "done") return "";
      buffer += rawDelta;
      return detectMode();
    },

    finish(): string {
      if (mode === "done") return "";
      if (mode === "detect") {
        const trimmed = buffer.trimStart();
        if (!trimmed || OPEN_EXPLANATION.startsWith(trimmed.toLowerCase())) {
          buffer = "";
          return "";
        }
        mode = "plain";
      }

      const visible = emitSafeText();
      buffer = "";
      return visible;
    }
  };
}
