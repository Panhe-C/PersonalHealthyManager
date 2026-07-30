import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("coach layout", () => {
  it("uses a native header instead of a hand-rolled one", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

    expect(source).toContain("navigation.setOptions");
    expect(source).toContain("headerLeft");
    expect(source).toContain("headerRight");
    expect(source).not.toContain("styles.headerLayer");
    expect(source).not.toContain("styles.coachHeader");
    expect(source).not.toContain("styles.chatToolbar");
    expect(source).not.toContain('size="display"');
  });

  it("renders recent messages inside an independently scrollable chat pane", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

    expect(source).toContain("messageScrollRef");
    expect(source).toContain("nestedScrollEnabled");
    expect(source).toContain("onContentSizeChange");
    expect(source).toContain("scrollToEnd");
    expect(source).toContain("messageStage: { flex: 1 }");
    expect(source).not.toContain("messageStage: { height:");
    expect(source).not.toContain("messageStage: { minHeight:");
  });

  it("opens memory management in a bottom sheet instead of expanding the page", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

    expect(source).toContain('accessibilityLabel="教练记忆"');
    expect(source).toContain("visible={showCoachTools}");
    expect(source).toContain("styles.sheetBackdrop");
    expect(source).toContain("styles.memorySheet");
    expect(source).not.toContain("styles.coachToolsTray");
  });

  it("uses icon-only top actions and slides conversation history in from the left", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

    expect(source).toContain("History");
    expect(source).toContain("SquarePen");
    expect(source).toContain('accessibilityLabel="历史对话"');
    expect(source).toContain('accessibilityLabel="新对话"');
    expect(source).toContain("Animated.View");
    expect(source).toContain("drawerTranslateX");
    expect(source).toContain('animationType="none"');
    expect(source).not.toContain('animationType="slide"');
    expect(source).not.toContain(">历史</Text>");
    expect(source).not.toContain("新对话</Text>");
  });

  it("keeps the history drawer header clear of the device safe area", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

    expect(source).toContain("useSafeAreaInsets");
    expect(source).toContain("paddingTop: Math.max(insets.top + spacing.md");
    expect(source).toContain("styles.drawerTitleRow");
    expect(source).toContain("styles.drawerNewButton");
    expect(source).toContain('accessibilityLabel="新对话"');
    expect(source).not.toContain("<Button title={createConversationMutation.isPending ? \"新建中\" : \"新建\"}");
  });

  it("keeps the chat stage and composer docked below the header", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach/index.tsx", import.meta.url), "utf8");

    const bodyIndex = source.indexOf("styles.chatBody");
    const messagesIndex = source.indexOf("styles.messageScroll");
    const composerIndex = source.indexOf("styles.composerDock");

    expect(source).toContain("KeyboardAvoidingView");
    expect(source).toContain("Platform.OS");
    expect(source).toContain("showConversationDrawer");
    expect(bodyIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeLessThan(messagesIndex);
    expect(messagesIndex).toBeLessThan(composerIndex);
  });
});
