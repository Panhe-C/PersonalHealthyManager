import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("coach layout", () => {
  it("uses a full-screen chat structure with a bottom-docked composer", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach.tsx", import.meta.url), "utf8");

    const headerIndex = source.indexOf("styles.headerLayer");
    const bodyIndex = source.indexOf("styles.chatBody");
    const messagesIndex = source.indexOf("styles.messageScroll");
    const composerIndex = source.indexOf("styles.composerDock");
    const drawerIndex = source.indexOf("styles.conversationDrawer");

    expect(source).toContain("SafeAreaView");
    expect(source).toContain("KeyboardAvoidingView");
    expect(source).toContain("Platform.OS");
    expect(source).toContain('edges={["top"]}');
    expect(source).not.toContain("<Screen");
    expect(source).not.toContain("styles.screenContent");
    expect(source).not.toContain("styles.mobileChatShell");
    expect(headerIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(-1);
    expect(messagesIndex).toBeGreaterThan(-1);
    expect(composerIndex).toBeGreaterThan(-1);
    expect(drawerIndex).toBeGreaterThan(-1);
    expect(source).toContain("showConversationDrawer");
    expect(source).not.toContain("styles.conversationRail");
    expect(source).not.toContain('title="最近消息"');
    expect(source).not.toContain('title="建议问题"');
    expect(headerIndex).toBeLessThan(bodyIndex);
    expect(bodyIndex).toBeLessThan(messagesIndex);
    expect(messagesIndex).toBeLessThan(composerIndex);
  });

  it("renders recent messages inside an independently scrollable chat pane", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach.tsx", import.meta.url), "utf8");

    expect(source).toContain("messageScrollRef");
    expect(source).toContain("nestedScrollEnabled");
    expect(source).toContain("onContentSizeChange");
    expect(source).toContain("scrollToEnd");
    expect(source).toContain("messageStage: { flex: 1 }");
    expect(source).not.toContain("messageStage: { height:");
    expect(source).not.toContain("messageStage: { minHeight:");
  });

  it("opens memory management in a bottom sheet instead of expanding the page", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach.tsx", import.meta.url), "utf8");

    expect(source).toContain('accessibilityLabel="教练记忆"');
    expect(source).toContain("visible={showCoachTools}");
    expect(source).toContain("styles.sheetBackdrop");
    expect(source).toContain("styles.memorySheet");
    expect(source).not.toContain("styles.coachToolsTray");
  });

  it("uses icon-only top actions and slides conversation history in from the left", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach.tsx", import.meta.url), "utf8");

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
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach.tsx", import.meta.url), "utf8");

    expect(source).toContain("useSafeAreaInsets");
    expect(source).toContain("paddingTop: Math.max(insets.top + spacing.md");
    expect(source).toContain("styles.drawerTitleRow");
    expect(source).toContain("styles.drawerNewButton");
    expect(source).toContain('accessibilityLabel="新建历史对话"');
    expect(source).not.toContain("<Button title={createConversationMutation.isPending ? \"新建中\" : \"新建\"}");
  });

  it("matches the approved action-oriented Coach demo", () => {
    const source = readFileSync(new URL("../app/(app)/(tabs)/coach.tsx", import.meta.url), "utf8");

    expect(source).toContain("styles.coachHeader");
    expect(source).toContain("styles.chatToolbar");
    expect(source).toContain("styles.assistantContent");
    expect(source).toContain("styles.proposalCard");
    expect(source).toContain("styles.planComparison");
    expect(source).toContain("styles.sendButton");
    expect(source).toContain("ArrowDown");
    expect(source).toContain("Send");
    expect(source).toContain('placeholder="问问你的教练…"');
    expect(source).toContain("visibleMessages.length === 0");
    expect(source).not.toContain('<PageHeader title="教练"');
  });
});
