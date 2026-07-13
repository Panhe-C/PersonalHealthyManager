import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Check, Circle, Footprints, HeartPulse, Moon } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../src/components/Screen";
import { Text } from "../../../src/components/Text";
import { Button } from "../../../src/components/Button";
import { EmptyState, Spinner } from "../../../src/components/States";
import { MetricStrip, PageHeader, ReadinessRing } from "../../../src/components/QuietHealth";
import { useTodayOverviewQuery } from "../../../src/api/hooks";
import { completeTrainingTask } from "../../../src/api/training";
import { formatDateLabel, formatDuration, formatTaskWindow, percentLabel } from "../../../src/ui/format";
import { radius, spacing, useTheme } from "../../../src/theme/tokens";
import type { TodayOverview } from "../../../src/api/schemas";

type TodayTask = TodayOverview["todayTasks"][number];
type ChecklistStatus = TodayTask["checklistItems"][number]["status"];

export default function TodayTab() {
  const { data, isLoading, error } = useTodayOverviewQuery();
  const { tokens } = useTheme();
  const recovery = typeof data?.latestRecovery?.recoveryPercent === "number" ? data.latestRecovery.recoveryPercent : 0;
  const sleepMinutes = typeof data?.latestSleep?.durationMinutes === "number" ? data.latestSleep.durationMinutes : null;
  const activityMinutes = data?.todayTasks.reduce((sum, task) => sum + task.durationMinutes, 0) ?? 0;
  const focusTask = data?.todayTasks[0];

  return (
    <Screen>
      <PageHeader title="早上好" subtitle={data ? formatDateLabel(data.date) : "正在读取今日状态"} />

      {isLoading ? <Spinner /> : error ? <EmptyState title="今日数据加载失败" description="请确认后端和登录状态仍然可用。" /> : data ? (
        <>
          <View style={styles.readinessRing}>
            <ReadinessRing value={recovery} label={recovery >= 75 ? "准备就绪" : recovery >= 50 ? "适度训练" : "优先恢复"} />
          </View>

          <MetricStrip items={[
            { label: "睡眠", value: formatDuration(sleepMinutes), icon: <Moon color={tokens.ink} size={20} strokeWidth={1.5} /> },
            { label: "恢复", value: percentLabel(recovery), icon: <HeartPulse color={tokens.ink} size={20} strokeWidth={1.5} /> },
            { label: "活动", value: activityMinutes ? `${activityMinutes} 分` : "—", icon: <Footprints color={tokens.ink} size={20} strokeWidth={1.5} /> }
          ]} />

          <View style={styles.focusSection}>
            <Text style={{ color: tokens.muted }}>今日重点</Text>
            <Text size="xxl" weight="strong" style={{ color: tokens.inkStrong }}>
              {focusTask ? `${focusTask.title} · ${focusTask.durationMinutes} 分钟` : "留出恢复空间"}
            </Text>
            <Text style={{ color: tokens.muted }}>
              {focusTask ? `${formatTaskWindow(focusTask.scheduledStart, focusTask.scheduledEnd)} · ${focusTask.intensity}` : data.primaryGoal?.title ?? "今天没有安排训练任务"}
            </Text>
            {focusTask ? <Button title="开始训练" onPress={() => Alert.alert(focusTask.title, `${focusTask.durationMinutes} 分钟 · ${focusTask.trainingType}`)} /> : null}
          </View>

          {focusTask ? <TodayChecklist task={focusTask} /> : (
            <View style={[styles.emptyLine, { borderTopColor: tokens.line }]}>
              <Text style={{ color: tokens.muted }}>{data.activePlanId ? "当前周计划已连接" : "生成计划后，今日重点会显示在这里"}</Text>
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function nextChecklistStatus(status: ChecklistStatus): ChecklistStatus {
  if (status === "pending") return "completed";
  if (status === "completed") return "skipped";
  return "pending";
}

function TodayChecklist({ task }: { task: TodayTask }) {
  const queryClient = useQueryClient();
  const { tokens } = useTheme();
  const [actualLoad, setActualLoad] = useState("");
  const [statuses, setStatuses] = useState<Record<string, ChecklistStatus>>(
    () => Object.fromEntries(task.checklistItems.map((item) => [item.id, item.status])) as Record<string, ChecklistStatus>
  );
  const alreadyRecorded = task.status !== "planned" && task.status !== "pending";
  const completionMutation = useMutation({
    mutationFn: () => completeTrainingTask(task.id, {
      actualLoad: actualLoad.trim() ? Number(actualLoad) : undefined,
      items: task.checklistItems.map((item) => ({ id: item.id, label: item.label, status: statuses[item.id] ?? item.status }))
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      void queryClient.invalidateQueries({ queryKey: ["plan", "active"] });
      Alert.alert("已记录", "训练完成情况已同步。");
    },
    onError: (err) => Alert.alert("提交失败", err instanceof Error ? err.message : "请稍后重试。")
  });

  return (
    <View style={styles.checklist}>
      {task.checklistItems.map((item) => {
        const status = statuses[item.id] ?? item.status;
        return (
          <Pressable
            accessibilityRole="button"
            disabled={alreadyRecorded || completionMutation.isPending}
            key={item.id}
            onPress={() => setStatuses((items) => ({ ...items, [item.id]: nextChecklistStatus(status) }))}
            style={({ pressed }) => [styles.checkRow, { borderTopColor: tokens.line }, pressed && styles.pressed]}
          >
            <View style={[styles.checkCircle, { borderColor: status === "completed" ? tokens.sage : tokens.ink, backgroundColor: status === "completed" ? tokens.sage : "transparent" }]}>
              {status === "completed" ? <Check color="#fff" size={16} /> : status === "skipped" ? <Circle color={tokens.muted} size={8} fill={tokens.muted} /> : null}
            </View>
            <Text style={{ flex: 1, color: status === "skipped" ? tokens.muted : tokens.ink }}>{item.label}</Text>
          </Pressable>
        );
      })}
      <View style={[styles.completionRow, { borderTopColor: tokens.line }]}>
        <TextInput
          keyboardType="number-pad"
          value={actualLoad}
          editable={!alreadyRecorded && !completionMutation.isPending}
          onChangeText={setActualLoad}
          placeholder="实际负荷（可选）"
          placeholderTextColor={tokens.muted}
          style={[styles.loadInput, { color: tokens.ink, borderColor: tokens.line }]}
        />
        <Button title={alreadyRecorded ? "已记录" : completionMutation.isPending ? "提交中" : "提交完成"} disabled={alreadyRecorded || completionMutation.isPending} onPress={() => completionMutation.mutate()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  checkCircle: { alignItems: "center", borderRadius: 18, borderWidth: 1.5, height: 32, justifyContent: "center", width: 32 },
  checkRow: { alignItems: "center", borderTopWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 62 },
  checklist: { marginTop: -spacing.sm },
  completionRow: { alignItems: "center", borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, paddingTop: spacing.md },
  emptyLine: { borderTopWidth: 1, paddingTop: spacing.lg },
  focusSection: { gap: spacing.sm, marginTop: spacing.sm },
  loadInput: { borderRadius: radius.md, borderWidth: 1, flex: 1, minHeight: 48, paddingHorizontal: spacing.md },
  pressed: { opacity: 0.55 },
  readinessRing: { paddingVertical: spacing.xs }
});
