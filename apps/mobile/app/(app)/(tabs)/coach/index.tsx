import { useCallback, useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ArrowDown, Brain, History, Leaf, Pencil, Send, SquarePen, Trash2 } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FLOATING_TAB_BAR_CLEARANCE } from "../../../../src/navigation/tabBarMetrics";
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
  undoAgentAdjustment,
  updateAgentMemory,
  type MemoryDraft
} from "../../../../src/api/agent";
import { streamAgentMessage } from "../../../../src/api/agentStream";
import { useAgentMemoriesQuery, useConversationDetailQuery, useConversationsQuery } from "../../../../src/api/hooks";
import { RichMessage } from "../../../../src/components/RichMessage";
import {
  appendAssistantDelta,
  canSubmitCoachMessage,
  finalizeAssistantMessage,
  getRecentMessagesForChat,
  mergeConversationMessages
} from "../../../../src/coachMessages";
import { formatDateLabel } from "../../../../src/ui/format";
import { cardShadow, opacity, radius, spacing, useTheme } from "../../../../src/theme/tokens";
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
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraft>(emptyMemoryDraft);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemoryDraft, setEditMemoryDraft] = useState<MemoryDraft>(emptyMemoryDraft);
  const [showCoachTools, setShowCoachTools] = useState(false);
  const [showConversationDrawer, setShowConversationDrawer] = useState(false);
  const autoCreateAttemptedRef = useRef(false);
  const messageScrollRef = useRef<ElementRef<typeof ScrollView>>(null);
  const activeSendRef = useRef<{ controller: AbortController; conversationId: string } | null>(null);

  const conversationDetailQuery = useConversationDetailQuery(selectedConversationId);
  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);
  const suggestions = useMemo(() => buildSuggestions(messages), [messages]);
  const visibleMessages = useMemo(() => getRecentMessagesForChat(messages), [messages]);
  // The history sheet uses the same native-fade Modal as the memory sheet —
  // no hand-rolled slide, which is what smeared during close.
  const openConversationDrawer = useCallback(() => setShowConversationDrawer(true), []);

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
  const conversationMutationPending =
    createConversationMutation.isPending || deleteConversationMutation.isPending;

  const hasMessageFeedback = visibleMessages.length > 0 || sending;

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

  useEffect(() => () => activeSendRef.current?.controller.abort(), []);

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

  async function submitMessage(text = draft) {
    const content = text.trim();
    if (!selectedConversationId || !canSubmitCoachMessage({
      content,
      conversationId: selectedConversationId,
      sending,
      conversationMutationPending
    })) return;
    const timestamp = Date.now();
    const conversationId = selectedConversationId;
    const userMessage: AgentMessage = { id: `local-user-${timestamp}`, role: "user", content };
    const assistantMessageId = `local-assistant-${timestamp}`;
    const assistantMessage: AgentMessage = { id: assistantMessageId, role: "assistant", content: "" };
    const controller = new AbortController();
    let hasVisibleDelta = false;
    let completed = false;

    activeSendRef.current = { controller, conversationId };
    setSending(true);
    setDraft("");
    setError(null);
    setMessages((items) => [...items, userMessage, assistantMessage]);

    try {
      await streamAgentMessage(conversationId, content, {
        signal: controller.signal,
        onEvent: (event) => {
          if (activeSendRef.current?.controller !== controller) return;
          if (event.type === "delta") {
            hasVisibleDelta = true;
            setMessages((items) => appendAssistantDelta(items, assistantMessageId, event.text));
          }
          if (event.type === "final") {
            completed = true;
            setMessages((items) => finalizeAssistantMessage(items, assistantMessageId, event));
            queryClient.setQueryData<Conversation[]>(["agent", "conversations"], (items) => [
              event.conversation as Conversation,
              ...(items ?? []).filter((item) => item.id !== event.conversation.id)
            ]);
          }
        }
      });
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["agent", "conversations", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["agent", "memories"] });
    } catch (err) {
      if (activeSendRef.current?.controller !== controller) return;
      if (!hasVisibleDelta && !completed) {
        setMessages((items) => items.filter((item) => item.id !== assistantMessageId));
      }
      if (!(err instanceof Error && err.name === "AbortError")) {
        setError(hasVisibleDelta ? "回复中断，请重试。" : err instanceof Error ? err.message : "发送失败");
      }
    } finally {
      if (activeSendRef.current?.controller === controller) {
        activeSendRef.current = null;
        setSending(false);
      }
    }
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

  /** The sheet is a Modal, so it closes before the confirm sheet opens to avoid stacked modals. */
  function closeConversationDrawer(onClosed?: () => void) {
    setShowConversationDrawer(false);
    onClosed?.();
  }

  return (
    <>
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {error ? (
            <View style={[styles.inlineError, { backgroundColor: tokens.redFill, borderColor: tokens.red }]}>
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
                {sending ? <Text size="subheadline" color={tokens.labelSecondary}>Coach 正在回复...</Text> : null}
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

          <View style={[styles.composerDock, { backgroundColor: tokens.bg, borderTopColor: tokens.separator, paddingBottom: spacing.sm + insets.bottom + FLOATING_TAB_BAR_CLEARANCE }]}>
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
              disabled={!canSubmitCoachMessage({
                content: draft,
                conversationId: selectedConversationId,
                sending,
                conversationMutationPending
              })}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: canSubmitCoachMessage({
                    content: draft,
                    conversationId: selectedConversationId,
                    sending,
                    conversationMutationPending
                  })
                    ? tokens.controlFill
                    : tokens.fill
                },
                pressed && styles.pressed
              ]}
            >
              <Send
                color={
                  canSubmitCoachMessage({
                    content: draft,
                    conversationId: selectedConversationId,
                    sending,
                    conversationMutationPending
                  })
                    ? tokens.controlLabel
                    : tokens.labelTertiary
                }
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
              { backgroundColor: tokens.surface, borderColor: tokens.separator, paddingBottom: Math.max(insets.bottom, spacing.lg) },
              cardShadow(isDark ? "dark" : "light")
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: tokens.separatorOpaque }]} />
            <View style={styles.memoryTrayHeader}>
              <View style={styles.cardText}>
                <Text size="title2" weight="strong">教练记忆</Text>
                <Text size="subheadline" style={{ color: tokens.labelSecondary }}>管理 Coach 用来理解你的偏好与约束。</Text>
              </View>
              <Button
                title={addingMemory ? "取消" : "新增"}
                variant="plain"
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

      <Modal visible={showConversationDrawer} transparent animationType="fade" onRequestClose={() => closeConversationDrawer()}>
        <Pressable style={styles.sheetBackdrop} onPress={() => closeConversationDrawer()}>
          <Pressable
            style={[
              styles.memorySheet,
              { backgroundColor: tokens.surface, borderColor: tokens.separator, paddingBottom: Math.max(insets.bottom, spacing.lg) },
              cardShadow(isDark ? "dark" : "light")
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: tokens.separatorOpaque }]} />
            <View style={styles.drawerTitleRow}>
              <Text size="title2" weight="strong" numberOfLines={1}>历史对话</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="新对话"
                onPress={() => createConversationMutation.mutate()}
                disabled={createConversationMutation.isPending || sending}
                style={({ pressed }) => [
                  styles.drawerNewButton,
                  { backgroundColor: tokens.fill },
                  pressed && styles.pressed
                ]}
              >
                <SquarePen color={createConversationMutation.isPending || sending ? tokens.labelSecondary : tokens.tint} size={17} />
              </Pressable>
            </View>
            {conversationsQuery.isLoading ? <Spinner /> : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerConversationList}>
                {conversations.map((conversation) => {
                  const selected = conversation.id === selectedConversationId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={conversation.id}
                      disabled={sending}
                      onPress={() => {
                        setSelectedConversationId(conversation.id);
                        closeConversationDrawer();
                      }}
                      style={({ pressed }) => [
                        styles.drawerConversationItem,
                        selected ? { backgroundColor: tokens.fill } : null,
                        pressed && styles.pressed
                      ]}
                    >
                      {/* Left accent bar marks the open conversation; the
                          placeholder twin keeps unselected rows aligned. */}
                      <View style={[styles.drawerSelectedBar, selected ? { backgroundColor: tokens.tint } : null]} />
                      <View style={styles.drawerConversationText}>
                        <Text size="body" weight="strong" numberOfLines={1} style={{ color: tokens.label }}>
                          {conversation.title}
                        </Text>
                        <Text size="caption" style={{ color: tokens.labelSecondary }}>
                          {formatDateLabel(conversation.updatedAt)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`删除 ${conversation.title}`}
                        disabled={sending}
                        onPress={() => requestDeleteConversation(conversation)}
                        style={styles.drawerDeleteButton}
                      >
                        <Trash2 color={tokens.labelTertiary} size={16} />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function MessageBubble({ message, onUndo }: { message: AgentMessage; onUndo: (adjustment: AgentAdjustment) => void }) {
  const { tokens, isDark } = useTheme();
  const isUser = message.role === "user";

  // The streaming flow appends an empty assistant placeholder up front; keep
  // it invisible until the first delta lands, so there is no blank bubble.
  if (!isUser && message.content.trim() === "" && !message.adjustments?.length) {
    return null;
  }

  if (!isUser) {
    return (
      <View style={[styles.messageRow, styles.assistantMessageRow]}>
        <View style={[styles.assistantAvatar, { borderColor: tokens.tint }]}>
          <Leaf color={tokens.tint} size={19} strokeWidth={1.6} />
        </View>
        <View style={[styles.assistantContent, { backgroundColor: tokens.surface }, cardShadow(isDark ? "dark" : "light")]}>
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
    <View style={[styles.proposalCard, { borderTopColor: tokens.separator }]}>
      <Text size="title3" weight="strong" style={{ color: tokens.label }}>调整今日训练</Text>
      <View style={styles.planComparison}>
        <View style={styles.planRow}>
          <Text size="subheadline" style={{ color: tokens.labelSecondary, width: 58 }}>调整前</Text>
          <Text size="subheadline" style={{ color: tokens.label, flex: 1 }}>本次对话前的计划</Text>
        </View>
        <ArrowDown color={tokens.tint} size={24} strokeWidth={1.6} style={styles.planArrow} />
        <View style={styles.planRow}>
          <Text size="subheadline" style={{ color: tokens.tint, width: 58 }}>调整后</Text>
          <Text weight="medium" style={{ color: tokens.label, flex: 1 }}>{adjustment.label}</Text>
        </View>
      </View>
      {adjustment.undoneAt ? (
        <Text style={{ color: tokens.labelSecondary, textAlign: "center" }}>调整已撤销</Text>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => onUndo(adjustment)} style={({ pressed }) => [styles.proposalAction, { backgroundColor: tokens.tint }, pressed && styles.pressed]}>
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
        <Button title="取消" variant="plain" onPress={onCancel} />
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
  drawerConversationItem: {
    alignItems: "center",
    borderRadius: radius.card,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 64,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm
  },
  drawerConversationList: { gap: spacing.xs, paddingBottom: spacing.xl, paddingTop: spacing.xs },
  drawerConversationText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  drawerDeleteButton: { alignItems: "center", borderRadius: radius.sm, height: 40, justifyContent: "center", width: 40 },
  drawerNewButton: { alignItems: "center", borderRadius: 21, height: 42, justifyContent: "center", width: 42 },
  drawerSelectedBar: { borderRadius: 2, height: 24, width: 3 },
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
  memorySheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 1, gap: spacing.md, maxHeight: "78%", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
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
  sendButton: { alignItems: "center", borderRadius: radius.pill, height: 32, justifyContent: "center", width: 32 },
  sheetBackdrop: { backgroundColor: "rgba(18, 24, 20, 0.34)", flex: 1, justifyContent: "flex-end" },
  sheetHandle: { alignSelf: "center", borderRadius: 2, height: 4, marginBottom: spacing.sm, width: 40 },
  suggestionCard: { borderRadius: radius.sheet, borderWidth: 1, maxWidth: 240, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  suggestionList: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  suggestionStrip: { flexGrow: 0 },
  userBubble: { borderRadius: radius.bubble, maxWidth: "82%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  userMessageRow: { justifyContent: "flex-end" }
});
