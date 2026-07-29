import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { ArrowDown, Brain, History, Leaf, Pencil, Send, SquarePen, Trash2 } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "expo-router";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { ChoiceGroup } from "../../../../src/components/ChoiceGroup";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { EmptyState, Spinner } from "../../../../src/components/States";
import {
  createAgentConversation,
  createAgentMemory,
  deleteAgentConversation,
  deleteAgentMemory,
  sendAgentMessage,
  undoAgentAdjustment,
  updateAgentMemory,
  type MemoryDraft
} from "../../../../src/api/agent";
import { useAgentMemoriesQuery, useConversationDetailQuery, useConversationsQuery } from "../../../../src/api/hooks";
import { RichMessage } from "../../../../src/components/RichMessage";
import { getRecentMessagesForChat, mergeConversationMessages } from "../../../../src/coachMessages";
import { formatDateLabel } from "../../../../src/ui/format";
import { opacity, radius, spacing, useTheme } from "../../../../src/theme/tokens";
import type { AgentAdjustment, AgentMessage, Conversation, Memory } from "../../../../src/api/schemas";

const fallbackSuggestions = [
  "我昨晚没睡好，今天还适合跑吗？",
  "帮我把本周训练写入飞书日历",
  "今天午餐这些菜怎么选？"
];

const suggestionGroups = {
  recovery: ["我昨晚没睡好，今天还适合跑吗？", "今天改成恢复训练可以吗？", "看下最近 HRV 和静息心率"],
  training: ["拉取最新 COROS 数据后再分析", "给我下周跑步安排", "哪些训练需要降低强度？"],
  calendar: ["帮我把本周训练写入飞书日历", "查看明天有哪些训练空档", "生成下周训练日历草稿"],
  meal: ["今天午餐这些菜怎么选？", "训练日前后怎么吃？", "帮我按蛋白质优先选餐"],
  replan: ["按恢复状态调整本周计划", "把高强度训练挪到哪天？", "重新生成更保守的计划"]
};

const memoryKindOptions = [
  { value: "fact", label: "事实" },
  { value: "preference", label: "偏好" },
  { value: "routine", label: "习惯" },
  { value: "constraint", label: "限制" }
];
const memoryCategoryOptions = [
  { value: "training", label: "训练" },
  { value: "nutrition", label: "饮食" },
  { value: "recovery", label: "恢复" },
  { value: "schedule", label: "日程" },
  { value: "general", label: "通用" }
];
const emptyMemoryDraft: MemoryDraft = { kind: "preference", category: "general", content: "" };

function memoryLabel(options: { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function uniqueSuggestions(items: string[]) {
  return Array.from(new Set(items)).slice(0, 3);
}

function buildSuggestions(messages: AgentMessage[]) {
  const recentText = messages
    .slice(-6)
    .map((item) => item.content)
    .join("\n")
    .toLowerCase();

  if (/飞书|日历|calendar|空档|写入|草稿|安排到|预约/.test(recentText)) return suggestionGroups.calendar;
  if (/睡|hrv|静息|压力|没睡好|恢复状态|恢复情况|recovery/.test(recentText)) {
    return uniqueSuggestions([...suggestionGroups.recovery, ...suggestionGroups.replan]);
  }
  if (/午餐|晚餐|早餐|菜|饮食|蛋白|碳水|meal|吃/.test(recentText)) return suggestionGroups.meal;
  if (/运动|训练|跑|跑步|强度|配速|coros|负荷|马拉松|周计划|计划/.test(recentText)) {
    return uniqueSuggestions([...suggestionGroups.training, ...suggestionGroups.replan]);
  }
  return fallbackSuggestions;
}

export default function CoachTab() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const conversationsQuery = useConversationsQuery();
  const memoriesQuery = useAgentMemoriesQuery();
  const { confirm } = useFeedback();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const { width: viewportWidth } = useWindowDimensions();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [addingMemory, setAddingMemory] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraft>(emptyMemoryDraft);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemoryDraft, setEditMemoryDraft] = useState<MemoryDraft>(emptyMemoryDraft);
  const [showCoachTools, setShowCoachTools] = useState(false);
  const [showConversationDrawer, setShowConversationDrawer] = useState(false);
  const autoCreateAttemptedRef = useRef(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const messageScrollRef = useRef<ElementRef<typeof ScrollView>>(null);

  const conversationDetailQuery = useConversationDetailQuery(selectedConversationId);
  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);
  const suggestions = useMemo(() => buildSuggestions(messages), [messages]);
  const visibleMessages = useMemo(() => getRecentMessagesForChat(messages), [messages]);
  const drawerWidth = Math.min(Math.round(viewportWidth * 0.82), 380);
  const drawerTranslateX = drawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0]
  });
  const openConversationDrawer = useCallback(() => {
    setShowConversationDrawer(true);
    drawerProgress.setValue(0);
    requestAnimationFrame(() => {
      Animated.timing(drawerProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    });
  }, [drawerProgress]);

  const createConversationMutation = useMutation({
    mutationFn: createAgentConversation,
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: ["agent", "conversations"] });
      setSelectedConversationId(conversation.id);
      setMessages(conversation.messages);
      setDraft("");
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "新建会话失败")
  });

  const deleteConversationMutation = useMutation({
    mutationFn: deleteAgentConversation,
    onSuccess: (_result, conversationId) => {
      const remaining = conversations.filter((item) => item.id !== conversationId);
      void queryClient.invalidateQueries({ queryKey: ["agent", "conversations"] });
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(remaining[0]?.id);
        if (!remaining[0]) setMessages([]);
      }
    },
    onError: (err) => setError(err instanceof Error ? err.message : "删除会话失败")
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: string; message: string }) => sendAgentMessage(conversationId, message),
    onSuccess: (response, variables) => {
      const assistantMessage: AgentMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: response.message,
        adjustments: response.adjustments
      };
      setMessages((items) => [...items, assistantMessage]);
      setError(null);
      if (response.conversation) {
        queryClient.setQueryData<Conversation[]>(["agent", "conversations"], (items) => [
          response.conversation as Conversation,
          ...(items ?? []).filter((item) => item.id !== response.conversation?.id)
        ]);
      }
      void queryClient.invalidateQueries({ queryKey: ["agent", "conversations", variables.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["agent", "memories"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "发送失败")
  });
  const hasMessageFeedback = visibleMessages.length > 0 || sendMutation.isPending;

  const undoMutation = useMutation({
    mutationFn: undoAgentAdjustment,
    onSuccess: (result) => {
      setMessages((items) =>
        items.map((message) => ({
          ...message,
          adjustments: message.adjustments?.map((adjustment) =>
            adjustment.id === result.id ? { ...adjustment, undoneAt: result.undoneAt } : adjustment
          )
        }))
      );
    },
    onError: (err) => setError(err instanceof Error ? err.message : "撤销失败")
  });

  const createMemoryMutation = useMutation({
    mutationFn: createAgentMemory,
    onSuccess: () => {
      setAddingMemory(false);
      setMemoryDraft(emptyMemoryDraft);
      void queryClient.invalidateQueries({ queryKey: ["agent", "memories"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "新增记忆失败")
  });

  const updateMemoryMutation = useMutation({
    mutationFn: ({ id, draft: nextDraft }: { id: string; draft: MemoryDraft }) => updateAgentMemory(id, nextDraft),
    onSuccess: () => {
      setEditingMemoryId(null);
      void queryClient.invalidateQueries({ queryKey: ["agent", "memories"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "编辑记忆失败")
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: deleteAgentMemory,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agent", "memories"] }),
    onError: (err) => setError(err instanceof Error ? err.message : "删除记忆失败")
  });

  useEffect(() => {
    navigation.setOptions({
      title: selectedConversation?.title ?? "新对话",
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="历史对话"
          hitSlop={11}
          onPress={openConversationDrawer}
          style={styles.headerAction}
        >
          <History color={tokens.tint} size={22} strokeWidth={1.9} />
        </Pressable>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="教练记忆"
            hitSlop={11}
            onPress={() => setShowCoachTools(true)}
            style={styles.headerAction}
          >
            <Brain color={tokens.tint} size={21} strokeWidth={1.9} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新对话"
            accessibilityState={{ disabled: createConversationMutation.isPending }}
            hitSlop={11}
            onPress={() => createConversationMutation.mutate()}
            disabled={createConversationMutation.isPending}
            style={styles.headerAction}
          >
            <SquarePen color={createConversationMutation.isPending ? tokens.labelTertiary : tokens.tint} size={22} strokeWidth={1.9} />
          </Pressable>
        </View>
      )
    });
  }, [createConversationMutation, navigation, openConversationDrawer, selectedConversation?.title, tokens]);

  useEffect(() => {
    if (!selectedConversationId && conversations[0]) setSelectedConversationId(conversations[0].id);
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (conversationDetailQuery.data) {
      setMessages((items) => mergeConversationMessages(conversationDetailQuery.data.messages, items));
    }
  }, [conversationDetailQuery.data]);

  useEffect(() => {
    if (
      !conversationsQuery.isLoading &&
      !conversationsQuery.error &&
      conversations.length === 0 &&
      !createConversationMutation.isPending &&
      !autoCreateAttemptedRef.current
    ) {
      autoCreateAttemptedRef.current = true;
      createConversationMutation.mutate();
    }
  }, [
    conversations.length,
    conversationsQuery.error,
    conversationsQuery.isLoading,
    createConversationMutation.isPending,
    createConversationMutation.mutate
  ]);

  function submitMessage(text = draft) {
    const content = text.trim();
    if (!content || !selectedConversationId || sendMutation.isPending) return;
    const userMessage: AgentMessage = { id: `local-user-${Date.now()}`, role: "user", content };
    setDraft("");
    setError(null);
    setMessages((items) => [...items, userMessage]);
    sendMutation.mutate({ conversationId: selectedConversationId, message: content });
  }

  /** The drawer is a Modal, so it closes before the confirm sheet opens to avoid stacked modals. */
  function requestDeleteConversation(conversation: Conversation) {
    closeConversationDrawer(async () => {
      const confirmed = await confirm({
        title: `删除「${conversation.title}」？`,
        description: "这个会话里的消息会一起删除，教练记忆不受影响。",
        confirmLabel: "删除",
        destructive: true
      });
      if (confirmed) deleteConversationMutation.mutate(conversation.id);
    });
  }

  function startEditMemory(memory: Memory) {
    setEditingMemoryId(memory.id);
    setEditMemoryDraft({ kind: memory.kind, category: memory.category, content: memory.content });
  }

  function closeConversationDrawer(onClosed?: () => void) {
    Animated.timing(drawerProgress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (!finished) return;
      setShowConversationDrawer(false);
      onClosed?.();
    });
  }

  return (
    <>
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {error ? (
            <View style={[styles.inlineError, { backgroundColor: tokens.dangerSoft, borderColor: tokens.red }]}>
              <Text size="subheadline" color={tokens.red}>{error}</Text>
            </View>
          ) : null}

          <View style={[styles.chatBody, { backgroundColor: tokens.bg }]}>
            <View style={styles.messageStage}>
              {conversationDetailQuery.isLoading || createConversationMutation.isPending ? (
                <Spinner />
              ) : !hasMessageFeedback ? (
                <EmptyState title="开始一个问题" description="可以问今天训练怎么安排，或从下方建议中直接选择。" />
              ) : (
                <ScrollView
                  ref={messageScrollRef}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                  style={styles.messageScroll}
                  contentContainerStyle={styles.messageList}
                  onContentSizeChange={() => messageScrollRef.current?.scrollToEnd({ animated: false })}
                >
                  {sendMutation.isPending ? <Text size="subheadline" color={tokens.labelSecondary}>Coach 正在回复...</Text> : null}
                  {visibleMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} onUndo={(adjustment) => undoMutation.mutate(adjustment.id)} />
                  ))}
                </ScrollView>
              )}
            </View>

            {visibleMessages.length === 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionList} style={styles.suggestionStrip}>
                {suggestions.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() => submitMessage(item)}
                    style={({ pressed }) => [styles.suggestionCard, { backgroundColor: tokens.surface, borderColor: tokens.separator }, pressed && styles.pressed]}
                  >
                    <Text size="subheadline" numberOfLines={1}>{item}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View style={[styles.composerDock, { backgroundColor: tokens.bg, borderTopColor: tokens.separator, paddingBottom: spacing.sm + tabBarHeight }]}>
            <TextInput
              multiline
              value={draft}
              onChangeText={setDraft}
              placeholder="问问你的教练…"
              placeholderTextColor={tokens.labelTertiary}
              style={[styles.input, { borderColor: tokens.separator, color: tokens.label, backgroundColor: tokens.surface }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="发送消息"
              onPress={() => submitMessage()}
              disabled={!draft.trim() || !selectedConversationId || sendMutation.isPending}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: draft.trim() && selectedConversationId && !sendMutation.isPending ? tokens.controlFill : tokens.fill },
                pressed && styles.pressed
              ]}
            >
              <Send
                color={draft.trim() && selectedConversationId && !sendMutation.isPending ? tokens.controlLabel : tokens.labelTertiary}
                size={18}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>

      <Modal visible={showCoachTools} transparent animationType="fade" onRequestClose={() => setShowCoachTools(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowCoachTools(false)}>
          <Pressable
            style={[
              styles.memorySheet,
              { backgroundColor: tokens.panel, borderColor: tokens.line, paddingBottom: Math.max(insets.bottom, spacing.lg) }
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: tokens.lineStrong }]} />
            <View style={styles.memoryTrayHeader}>
              <View style={styles.cardText}>
                <Text size="xl" weight="strong">教练记忆</Text>
                <Text size="sm" style={{ color: tokens.muted }}>管理 Coach 用来理解你的偏好与约束。</Text>
              </View>
              <Button
                title={addingMemory ? "取消" : "新增"}
                variant="ghost"
                onPress={() => {
                  setAddingMemory((value) => !value);
                  setMemoryDraft(emptyMemoryDraft);
                }}
              />
            </View>
            {addingMemory ? (
              <MemoryEditor
                draft={memoryDraft}
                onChange={setMemoryDraft}
                onCancel={() => setAddingMemory(false)}
                onSubmit={() => memoryDraft.content.trim() && createMemoryMutation.mutate(memoryDraft)}
                submitLabel={createMemoryMutation.isPending ? "保存中" : "保存"}
              />
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.memoryList}>
              {memoriesQuery.isLoading ? <Spinner /> : memoriesQuery.data?.length ? memoriesQuery.data.map((memory) => (
                <MemoryRow
                  key={memory.id}
                  memory={memory}
                  editing={editingMemoryId === memory.id}
                  draft={editMemoryDraft}
                  onStartEdit={() => startEditMemory(memory)}
                  onChange={setEditMemoryDraft}
                  onCancel={() => setEditingMemoryId(null)}
                  onSave={() => editMemoryDraft.content.trim() && updateMemoryMutation.mutate({ id: memory.id, draft: editMemoryDraft })}
                  onDelete={() => deleteMemoryMutation.mutate(memory.id)}
                />
              )) : (
                <EmptyState title="还没有记忆" description="告诉 Coach“记住……”，或手动新增偏好。" />
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showConversationDrawer} transparent animationType="none" onRequestClose={() => closeConversationDrawer()}>
        <View style={styles.drawerBackdrop}>
          <Animated.View
            style={[
              styles.conversationDrawer,
              {
                backgroundColor: tokens.panel,
                borderColor: tokens.line,
                paddingTop: Math.max(insets.top + spacing.md, spacing.xxl),
                paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl),
                transform: [{ translateX: drawerTranslateX }],
                width: drawerWidth
              }
            ]}
          >
            <View style={styles.drawerHeader}>
              <View style={styles.drawerTitleBlock}>
                <View style={styles.drawerTitleRow}>
                  <Text size="xl" weight="strong" numberOfLines={1}>历史对话</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="新建历史对话"
                    onPress={() => createConversationMutation.mutate()}
                    disabled={createConversationMutation.isPending}
                    style={({ pressed }) => [
                      styles.drawerNewButton,
                      { borderColor: tokens.line, backgroundColor: tokens.panelSoft },
                      pressed && styles.pressed
                    ]}
                  >
                    <SquarePen color={createConversationMutation.isPending ? tokens.muted : tokens.sage} size={17} />
                  </Pressable>
                </View>
                <Text size="sm" numberOfLines={2} style={{ color: tokens.muted }}>
                  从侧边栏切换，不占用教练页顶部空间。
                </Text>
              </View>
            </View>
            {conversationsQuery.isLoading ? <Spinner /> : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerConversationList}>
                {conversations.map((conversation) => {
                  const selected = conversation.id === selectedConversationId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={conversation.id}
                      onPress={() => {
                        setSelectedConversationId(conversation.id);
                        closeConversationDrawer();
                      }}
                      style={({ pressed }) => [
                        styles.drawerConversationItem,
                        { backgroundColor: selected ? tokens.sage : tokens.panelSoft, borderColor: selected ? tokens.sage : tokens.line },
                        pressed && styles.pressed
                      ]}
                    >
                      <View style={styles.drawerConversationText}>
                        <Text size="md" weight="strong" numberOfLines={1} style={{ color: selected ? "#fff" : tokens.ink }}>
                          {conversation.title}
                        </Text>
                        <Text size="xs" style={{ color: selected ? "#eef7ef" : tokens.muted }}>
                          {formatDateLabel(conversation.updatedAt)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`删除 ${conversation.title}`}
                        onPress={() => requestDeleteConversation(conversation)}
                        style={styles.drawerDeleteButton}
                      >
                        <Trash2 color={selected ? "#fff" : tokens.danger} size={16} />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Animated.View>
          <Pressable style={styles.drawerScrim} onPress={() => closeConversationDrawer()} />
        </View>
      </Modal>
    </>
  );
}

function MessageBubble({ message, onUndo }: { message: AgentMessage; onUndo: (adjustment: AgentAdjustment) => void }) {
  const { tokens } = useTheme();
  const isUser = message.role === "user";

  if (!isUser) {
    return (
      <View style={[styles.messageRow, styles.assistantMessageRow]}>
        <View style={[styles.assistantAvatar, { borderColor: tokens.tint }]}>
          <Leaf color={tokens.tint} size={19} strokeWidth={1.6} />
        </View>
        <View style={[styles.assistantContent, { backgroundColor: tokens.surface }]}>
          <RichMessage content={message.content} />
          {message.adjustments?.map((adjustment) => (
            <AdjustmentProposal key={adjustment.id} adjustment={adjustment} onUndo={onUndo} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.messageRow, styles.userMessageRow]}>
      <View
        style={[
          styles.userBubble,
          { backgroundColor: tokens.controlFill }
        ]}
      >
        <Text color={tokens.controlLabel}>{message.content}</Text>
      </View>
    </View>
  );
}

function AdjustmentProposal({ adjustment, onUndo }: { adjustment: AgentAdjustment; onUndo: (adjustment: AgentAdjustment) => void }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.proposalCard, { borderTopColor: tokens.line }]}>
      <Text size="lg" weight="strong" style={{ color: tokens.inkStrong }}>调整今日训练</Text>
      <View style={styles.planComparison}>
        <View style={styles.planRow}>
          <Text size="sm" style={{ color: tokens.muted, width: 58 }}>调整前</Text>
          <Text size="sm" style={{ color: tokens.ink, flex: 1 }}>本次对话前的计划</Text>
        </View>
        <ArrowDown color={tokens.sage} size={24} strokeWidth={1.6} style={styles.planArrow} />
        <View style={styles.planRow}>
          <Text size="sm" style={{ color: tokens.sage, width: 58 }}>调整后</Text>
          <Text weight="medium" style={{ color: tokens.inkStrong, flex: 1 }}>{adjustment.label}</Text>
        </View>
      </View>
      {adjustment.undoneAt ? (
        <Text style={{ color: tokens.muted, textAlign: "center" }}>调整已撤销</Text>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => onUndo(adjustment)} style={({ pressed }) => [styles.proposalAction, { backgroundColor: tokens.clay }, pressed && styles.pressed]}>
          <Text weight="medium" style={{ color: "#fff", textAlign: "center" }}>撤销调整</Text>
        </Pressable>
      )}
    </View>
  );
}

function MemoryEditor({
  draft,
  onCancel,
  onChange,
  onSubmit,
  submitLabel
}: {
  draft: MemoryDraft;
  onCancel: () => void;
  onChange: (draft: MemoryDraft) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const { tokens } = useTheme();
  return (
    <InsetGroup header="编辑记忆">
      <ChoiceGroup
        label="类型"
        options={memoryKindOptions}
        value={draft.kind}
        onChange={(kind) => onChange({ ...draft, kind })}
      />
      <ChoiceGroup
        label="分类"
        options={memoryCategoryOptions}
        value={draft.category}
        onChange={(category) => onChange({ ...draft, category })}
      />
      <TextInput
        multiline
        value={draft.content}
        onChangeText={(content) => onChange({ ...draft, content })}
        placeholder="要记住的内容"
        placeholderTextColor={tokens.labelTertiary}
        style={[styles.input, { borderColor: tokens.separator, color: tokens.label, backgroundColor: tokens.surface }]}
      />
      <View style={styles.rowActions}>
        <Button title={submitLabel} onPress={onSubmit} disabled={!draft.content.trim()} />
        <Button title="取消" variant="ghost" onPress={onCancel} />
      </View>
    </InsetGroup>
  );
}

function MemoryRow({
  draft,
  editing,
  memory,
  onCancel,
  onChange,
  onDelete,
  onSave,
  onStartEdit
}: {
  draft: MemoryDraft;
  editing: boolean;
  memory: Memory;
  onCancel: () => void;
  onChange: (draft: MemoryDraft) => void;
  onDelete: () => void;
  onSave: () => void;
  onStartEdit: () => void;
}) {
  const { tokens } = useTheme();
  if (editing) {
    return <MemoryEditor draft={draft} onChange={onChange} onCancel={onCancel} onSubmit={onSave} submitLabel="保存" />;
  }
  return (
    <InsetGroup>
      <Row
        title={memory.content}
        subtitle={`${memoryLabel(memoryKindOptions, memory.kind)} · ${memoryLabel(memoryCategoryOptions, memory.category)} · ${memory.source} · ${Math.round(memory.confidence * 100)}%`}
        trailing={(
          <View style={styles.memoryActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="编辑记忆" onPress={onStartEdit} style={styles.iconButton}>
              <Pencil color={tokens.tint} size={16} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="删除记忆" onPress={onDelete} style={styles.iconButton}>
              <Trash2 color={tokens.red} size={16} />
            </Pressable>
          </View>
        )}
      />
    </InsetGroup>
  );
}

const styles = StyleSheet.create({
  assistantAvatar: { alignItems: "center", borderRadius: 24, borderWidth: 1, height: 46, justifyContent: "center", width: 46 },
  assistantContent: { borderRadius: radius.bubble, flex: 1, gap: spacing.lg, padding: spacing.md },
  assistantMessageRow: { alignItems: "flex-start", gap: spacing.md, justifyContent: "flex-start" },
  cardText: { flex: 1, gap: spacing.xs },
  chatBody: { flex: 1 },
  composerDock: {
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  conversationDrawer: {
    borderRightWidth: 1,
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    gap: spacing.md,
    height: "100%",
    paddingHorizontal: spacing.lg,
    width: "82%"
  },
  drawerBackdrop: { flex: 1, flexDirection: "row" },
  drawerConversationItem: {
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 76,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    paddingVertical: spacing.md
  },
  drawerConversationList: { gap: spacing.sm, paddingBottom: spacing.xl, paddingTop: spacing.xs },
  drawerConversationText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  drawerDeleteButton: { alignItems: "center", borderRadius: radius.sm, height: 40, justifyContent: "center", width: 40 },
  drawerHeader: { marginBottom: spacing.sm },
  drawerNewButton: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  drawerScrim: { backgroundColor: "rgba(0, 0, 0, 0.28)", flex: 1 },
  drawerTitleBlock: { gap: spacing.xs },
  drawerTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  headerAction: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  headerActions: { alignItems: "center", flexDirection: "row" },
  iconButton: { alignItems: "center", justifyContent: "center", minHeight: 36, minWidth: 36 },
  inlineError: { borderWidth: 1, borderLeftWidth: 0, borderRightWidth: 0, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  input: {
    borderRadius: radius.bubble,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 17,
    maxHeight: 110,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  memoryActions: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  memoryList: { gap: spacing.sm, paddingBottom: spacing.md },
  memorySheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, gap: spacing.md, maxHeight: "78%", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  memoryTrayHeader: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  messageBubble: { borderRadius: radius.bubble, gap: spacing.xs, maxWidth: "88%", padding: spacing.md },
  messageList: { flexGrow: 1, gap: spacing.md, justifyContent: "flex-end", padding: spacing.md },
  messageRow: { flexDirection: "row" },
  messageScroll: { flex: 1 },
  messageStage: { flex: 1 },
  planArrow: { alignSelf: "center" },
  planComparison: { gap: spacing.md },
  planRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md },
  pressed: { opacity: opacity.pressed },
  proposalAction: { borderRadius: radius.md, minHeight: 50, justifyContent: "center", paddingHorizontal: spacing.lg },
  proposalCard: { borderTopWidth: 1, gap: spacing.lg, paddingTop: spacing.lg },
  rowActions: { flexDirection: "row", gap: spacing.sm },
  screen: { flex: 1 },
  sendButton: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  sheetBackdrop: { backgroundColor: "rgba(18, 24, 20, 0.34)", flex: 1, justifyContent: "flex-end" },
  sheetHandle: { alignSelf: "center", borderRadius: 2, height: 4, marginBottom: spacing.sm, width: 40 },
  suggestionCard: { borderRadius: radius.lg, borderWidth: 1, maxWidth: 240, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  suggestionList: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  suggestionStrip: { flexGrow: 0 },
  userBubble: { borderRadius: radius.bubble, maxWidth: "82%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  userMessageRow: { justifyContent: "flex-end" }
});
