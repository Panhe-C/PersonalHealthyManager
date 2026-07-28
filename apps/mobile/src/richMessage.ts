/**
 * Turns an assistant reply into renderable blocks.
 *
 * The model already answers in Markdown, so the job here is to preserve that
 * structure rather than flatten it. Block structure and inline formatting are
 * parsed separately: blocks decide layout, spans decide typography, and the
 * renderer never has to look at raw Markdown.
 *
 * The grammar deliberately mirrors the web `RichMessageContent` in
 * `components/AgentPanel.tsx` so the same reply reads the same on both clients.
 */

export type InlineSpan = { text: string; bold?: boolean; code?: boolean };

export type MessageBlock =
  | { kind: "heading"; level: 1 | 2; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "code"; text: string }
  | { kind: "divider" };

/**
 * Models sometimes run a heading onto the end of the previous line. Break those
 * apart first so the line-oriented parser below sees one construct per line.
 */
function normalizeMarkdown(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+---[ \t]+(#{1,6}[ \t]+)/g, "\n---\n$1")
    .replace(/([^\n])([ \t]+#{2,6}[ \t]+)/g, "$1\n$2");
}

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) spans.push({ text: text.slice(cursor, match.index) });
    if (match[1] !== undefined) spans.push({ text: match[1], bold: true });
    else if (match[2] !== undefined) spans.push({ text: match[2], code: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) spans.push({ text: text.slice(cursor) });
  return spans.length > 0 ? spans : [{ text }];
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableRow(line: string): boolean {
  const value = line.trim();
  return value.startsWith("|") && value.endsWith("|") && splitTableRow(value).length > 1;
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

const bulletPattern = /^[-*+]\s+/;
const orderedPattern = /^\d+[.)]\s+/;

export function parseRichMessage(content: string): MessageBlock[] {
  const lines = normalizeMarkdown(content).split("\n");
  const blocks: MessageBlock[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) blocks.push({ kind: "paragraph", text });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "divider" });
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", level: heading[1].length <= 2 ? 1 : 2, text: heading[2].trim() });
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph();
      const fenced: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        fenced.push(lines[index]);
        index += 1;
      }
      blocks.push({ kind: "code", text: fenced.join("\n") });
      continue;
    }

    if (isTableRow(line) && lines[index + 1] && isTableDivider(lines[index + 1])) {
      flushParagraph();
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) {
        const cells = splitTableRow(lines[index]);
        rows.push(headers.map((_, cell) => cells[cell] ?? ""));
        index += 1;
      }
      index -= 1;

      // A header with no data rows is not a table worth drawing; the prompt asks
      // the model to avoid it, but degrade to plain text rather than an empty grid.
      if (rows.length === 0) blocks.push({ kind: "paragraph", text: headers.join(" · ") });
      else blocks.push({ kind: "table", headers, rows });
      continue;
    }

    const ordered = orderedPattern.test(line);
    if (ordered || bulletPattern.test(line)) {
      flushParagraph();
      const pattern = ordered ? orderedPattern : bulletPattern;
      const items: string[] = [];
      while (index < lines.length && pattern.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(pattern, ""));
        index += 1;
      }
      index -= 1;
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}
