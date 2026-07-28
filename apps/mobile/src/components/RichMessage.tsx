import { Fragment, useMemo } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { parseInline, parseRichMessage, type InlineSpan, type MessageBlock } from "../richMessage";
import { radius, spacing, useTheme, type ThemeTokens } from "../theme/tokens";

/** Past this many columns a table cannot share the width, so it scrolls instead. */
const SCROLL_COLUMN_THRESHOLD = 3;
const SCROLL_COLUMN_WIDTH = 116;

const monospace = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

function Inline({ text, color }: { text: string; color: string }) {
  const { tokens } = useTheme();
  const spans = useMemo(() => parseInline(text), [text]);

  return (
    <Text style={{ color }}>
      {spans.map((span, index) => (
        <SpanText key={index} span={span} tokens={tokens} />
      ))}
    </Text>
  );
}

function SpanText({ span, tokens }: { span: InlineSpan; tokens: ThemeTokens }) {
  if (span.code) {
    return <Text style={[styles.inlineCode, { backgroundColor: tokens.panelSoft, color: tokens.sageStrong, fontFamily: monospace }]}>{span.text}</Text>;
  }
  if (span.bold) return <Text weight="strong" style={{ color: tokens.inkStrong }}>{span.text}</Text>;
  return <Text>{span.text}</Text>;
}

function TableCard({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const { tokens } = useTheme();
  const scrolls = headers.length > SCROLL_COLUMN_THRESHOLD;
  const cellStyle = scrolls ? { width: SCROLL_COLUMN_WIDTH } : { flex: 1 };

  const grid = (
    <View style={[styles.table, { borderColor: tokens.line, backgroundColor: tokens.panel }, scrolls && styles.tableScrollable]}>
      <View style={[styles.tableRow, styles.tableHead, { backgroundColor: tokens.panelSoft, borderBottomColor: tokens.line }]}>
        {headers.map((header, index) => (
          <View key={index} style={cellStyle}>
            <Text size="xs" weight="medium" style={{ color: tokens.muted }}>{header}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={[styles.tableRow, rowIndex < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.line }]}
        >
          {row.map((cell, cellIndex) => (
            <View key={cellIndex} style={cellStyle}>
              {/* The leading column is almost always the row's label, so anchor the eye there. */}
              {cellIndex === 0 ? (
                <Text size="sm" weight="medium" style={{ color: tokens.inkStrong }}>{cell}</Text>
              ) : (
                <Inline text={cell} color={tokens.ink} />
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  if (!scrolls) return grid;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroller}>
      {grid}
    </ScrollView>
  );
}

function Block({ block }: { block: MessageBlock }) {
  const { tokens } = useTheme();

  switch (block.kind) {
    case "heading":
      return block.level === 1 ? (
        <View style={styles.headingRow}>
          <View style={[styles.headingAccent, { backgroundColor: tokens.sage }]} />
          <Text size="lg" weight="strong" style={{ color: tokens.inkStrong, flex: 1 }}>{block.text}</Text>
        </View>
      ) : (
        <Text size="md" weight="medium" style={{ color: tokens.sageStrong }}>{block.text}</Text>
      );

    case "paragraph":
      return <Inline text={block.text} color={tokens.ink} />;

    case "list":
      return (
        <View style={styles.list}>
          {block.items.map((item, index) => (
            <View key={index} style={styles.listItem}>
              <Text size="sm" weight="medium" style={[styles.listMarker, { color: tokens.sage }]}>
                {block.ordered ? `${index + 1}.` : "•"}
              </Text>
              <View style={styles.listBody}>
                <Inline text={item} color={tokens.ink} />
              </View>
            </View>
          ))}
        </View>
      );

    case "table":
      return <TableCard headers={block.headers} rows={block.rows} />;

    case "code":
      return (
        <View style={[styles.codeCard, { backgroundColor: tokens.panelSoft, borderColor: tokens.line }]}>
          <Text size="sm" style={{ color: tokens.ink, fontFamily: monospace }}>{block.text}</Text>
        </View>
      );

    case "divider":
      return <View style={[styles.divider, { backgroundColor: tokens.line }]} />;
  }
}

export function RichMessage({ content }: { content: string }) {
  const blocks = useMemo(() => parseRichMessage(content), [content]);
  return (
    <View style={styles.root}>
      {blocks.map((block, index) => (
        <Fragment key={index}>
          <Block block={block} />
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  codeCard: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  headingAccent: { borderRadius: 2, width: 3, alignSelf: "stretch", minHeight: 18 },
  headingRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  inlineCode: { borderRadius: radius.sm, fontSize: 14 },
  list: { gap: spacing.sm },
  listBody: { flex: 1 },
  listItem: { flexDirection: "row", gap: spacing.sm },
  listMarker: { minWidth: 16, textAlign: "right" },
  root: { gap: spacing.md },
  table: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  tableHead: { borderBottomWidth: 1 },
  tableRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tableScrollable: { minWidth: "100%" },
  tableScroller: { paddingRight: spacing.xs }
});
