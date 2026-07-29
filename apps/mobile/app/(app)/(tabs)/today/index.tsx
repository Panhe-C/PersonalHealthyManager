import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Footprints, HeartPulse, Moon } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { CheckRow } from "../../../../src/components/CheckRow";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { TextField } from "../../../../src/components/TextField";
import { MetricStrip, ReadinessRing } from "../../../../src/components/QuietHealth";
import { useTodayOverviewQuery } from "../../../../src/api/hooks";
import { completeTrainingTask } from "../../../../src/api/training";
import { formatDateLabel, formatDuration, formatTaskWindow, percentLabel } from "../../../../src/ui/format";
import { radius, spacing, useTheme } from "../../../../src/theme/tokens";
import type { TodayOverview } from "../../../../src/api/schemas";

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
      {isLoading ? <Spinner /> : error ? (
        <EmptyState title="今日数据加载失败" description="请确认后端和登录状态仍然可用。" />
      ) : data ? (
        <>
          <View style={[styles.heroCard, { backgroundColor: tokens.surface }]}>
            <Text size="footnote" color={tokens.labelSecondary}>{formatDateLabel(data.date)}</Text>
            <ReadinessRing value={recovery} label={recovery >= 75 ? "准备就绪" : recovery >= 50 ? "适度训练" : "优先恢复"} />
            <View style={[styles.heroDivider, { backgroundColor: tokens.separator }]} />
            <MetricStrip items={[
              { label: "睡眠", value: formatDuration(sleepMinutes), icon: <Moon color={tokens.labelSecondary} size={18} strokeWidth={1.8} /> },
              { label: "恢复", value: percentLabel(recovery), icon: <HeartPulse color={tokens.labelSecondary} size={18} strokeWidth={1.8} /> },
              { label: "活动", value: activityMinutes ? `${activityMinutes} 分` : "—", icon: <Footprints color={tokens.labelSecondary} size={18} strokeWidth={1.8} /> }
            ]} />
          </View>

          <InsetGroup header="今日重点">
            <Row
              title={focusTask ? focusTask.title : "留出恢复空间"}
              subtitle={focusTask
                ? `${formatTaskWindow(focusTask.scheduledStart, focusTask.scheduledEnd)} · ${focusTask.intensity}`
                : data.primaryGoal?.title ?? "今天没有安排训练任务"}
              value={focusTask ? `${focusTask.durationMinutes} 分` : undefined}
            />
            {focusTask ? <Row title="训练类型" value={focusTask.trainingType} /> : null}
          </InsetGroup>

          {focusTask ? <TodayChecklist task={focusTask} /> : (
            <InsetGroup>
              <Row title={data.activePlanId ? "当前周计划已连接" : "尚未生成计划"} subtitle={data.activePlanId ? undefined : "生成计划后，今日重点会显示在这里"} />
            </InsetGroup>
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
  const { notify } = useFeedback();
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
      notify({ title: "已记录", description: "训练完成情况已同步到计划。" });
    },
    onError: (err) => notify({ tone: "danger", title: "提交失败", description: err instanceof Error ? err.message : "请稍后重试。" })
  });

  return (
    <>
      <InsetGroup header="训练清单" footer={alreadyRecorded ? "本次训练已记录。" : "点按可在完成、跳过、待办之间切换。"}>
        {task.checklistItems.map((item) => (
          <CheckRow
            key={item.id}
            label={item.label}
            status={statuses[item.id] ?? item.status}
            disabled={alreadyRecorded || completionMutation.isPending}
            onPress={() => setStatuses((items) => ({
              ...items,
              [item.id]: nextChecklistStatus(statuses[item.id] ?? item.status)
            }))}
          />
        ))}
        <TextField
          label="实际负荷"
          value={actualLoad}
          onChange={setActualLoad}
          placeholder="可选"
          keyboardType="number-pad"
          editable={!alreadyRecorded && !completionMutation.isPending}
        />
      </InsetGroup>

      <Button
        title={alreadyRecorded ? "已记录" : completionMutation.isPending ? "提交中" : "提交完成"}
        disabled={alreadyRecorded || completionMutation.isPending}
        onPress={() => completionMutation.mutate()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    alignItems: "center",
    borderRadius: radius.md,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg
  },
  heroDivider: { alignSelf: "stretch", height: StyleSheet.hairlineWidth }
});
