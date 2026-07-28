import { Children, isValidElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

/** Row padding (16) + icon slot (28) + gap (8), so separators clear the icon. */
export const SEPARATOR_INSET = 52;

/**
 * iOS inset grouped list section: a rounded surface card with hairline
 * separators between its rows. The separators live here rather than on the rows
 * so the last row never draws one, which is what UITableView insetGrouped does.
 */
export function InsetGroup({
  header,
  footer,
  insetSeparators = false,
  children
}: {
  header?: string;
  footer?: string;
  insetSeparators?: boolean;
  children: ReactNode;
}) {
  const { tokens } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.group}>
      {header ? (
        <Text size="footnote" color={tokens.labelSecondary} style={styles.header}>
          {header}
        </Text>
      ) : null}

      <View style={[styles.card, { backgroundColor: tokens.surface }]}>
        {rows.map((row, index) => (
          <View key={row.key ?? index}>
            {row}
            {index < rows.length - 1 ? (
              <View
                testID="inset-separator"
                style={[
                  styles.separator,
                  { backgroundColor: tokens.separator, marginLeft: insetSeparators ? SEPARATOR_INSET : 0 }
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>

      {footer ? (
        <Text size="footnote" color={tokens.labelSecondary} style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: "hidden" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  group: { marginHorizontal: spacing.lg },
  header: { paddingBottom: spacing.xs, paddingHorizontal: spacing.lg },
  separator: { height: StyleSheet.hairlineWidth }
});
