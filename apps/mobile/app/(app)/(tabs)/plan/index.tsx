import { useEffect, useState } from "react";
import { useNavigation } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { CalendarCheck, Dumbbell, Utensils } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { useFeedback } from "../../../../src/components/Feedback";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { HairlineRow } from "../../../../src/components/QuietHealth";
import { ApiError } from "../../../../src/api/client";
import { useActivePlanQuery, useCalendarDraftsQuery } from "../../../../src/api/hooks";
import { generateActivePlan } from "../../../../src/api/training";
import { confirmCalendarDraft } from "../../../../src/api/calendar";
import { currentWeekStartIso, formatDateLabel, formatTaskWindow, parseJsonObject, weekDayNumbers } from "../../../../src/ui/format";
import { spacing, useTheme } from "../../../../src/theme/tokens";

const weekNames = ["一", "二", "三", "四", "五", "六", "日"];

export default function PlanTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useActivePlanQuery();
  const drafts = useCalendarDraftsQuery();
  const { notify } = useFeedback();
  const { tokens } = useTheme();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const navigation = useNavigation();
  const generateMutation = useMutation({
    mutationFn: () => generateActivePlan(currentWeekStartIso()),
    onSuccess: (plan) => {
      queryClient.setQueryData(["plan", "active"], plan);
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      notify({ title: "计划已生成", description: "本周训练和饮食建议已同步。" });
    },
    onError: (err) => {
      // A 409 means a prerequisite is missing and the message tells the user
      // what to set up, so it reads as guidance rather than a failure.
      if (err instanceof ApiError && err.status === 409) {
        notify({ tone: "neutral", title: "还差一步", description: err.message });
        return;
      }
      notify({ tone: "danger", title: "生成失败", description: err instanceof Error ? err.message : "请稍后重试。" });
    }
  });
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="生成或调整本周计划"
          hitSlop={11}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          <Text size="body" color={tokens.tint}>
            {generateMutation.isPending ? "生成中" : data ? "调整" : "生成"}
          </Text>
        </Pressable>
      )
    });
  }, [data, generateMutation, navigation, tokens.tint]);
  const confirmMutation = useMutation({
    mutationFn: confirmCalendarDraft,
    onSuccess: (draft) => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", "drafts"] });
      if (draft.status === "confirmed") {
        notify({ title: "已写入日历", description: "飞书日历已更新。" });
      } else {
        notify({ tone: "danger", title: "写入失败", description: draft.failureReason || "请稍后重试。" });
      }
    },
    onError: (err) => notify({ tone: "danger", title: "确认失败", description: err instanceof Error ? err.message : "请稍后重试。" })
  });
  const nutrition = parseJsonObject(data?.nutritionTargetsJson, {
    proteinTargetGrams: null,
    calorieTarget: "未设置",
    carbohydrateGuidance: "暂无碳水建议"
  });
  const primaryTask = data?.trainingTasks[0];
  const dayNumbers = weekDayNumbers(data?.weekStart ?? currentWeekStartIso());
  const weekDays = weekNames.map((name, index) => ({
    name,
    day: dayNumbers[index],
    active: index === 0
  }));

  return (
    <Screen>
      <View style={styles.weekStrip}>
        {weekDays.map((day) => (
          <View key={day.name} style={styles.dayItem}>
            <Text size="xs" style={{ color: tokens.muted }}>周{day.name}</Text>
            <View style={[styles.dayCircle, day.active && { backgroundColor: tokens.sage }]}>
              <Text size="lg" style={{ color: day.active ? "#fff" : tokens.inkStrong }}>{day.day}</Text>
            </View>
          </View>
        ))}
      </View>

      {isLoading ? <Spinner /> : error ? <EmptyState title="计划加载失败" description="请稍后重试或重新登录。" /> : data ? (
        <>
          <View style={styles.primarySession}>
            <Text size="lg" weight="medium" style={{ color: tokens.sage }}>星期一</Text>
            <View style={styles.sessionTitleRow}>
              <View style={[styles.sessionIcon, { borderColor: tokens.sage }]}><Dumbbell color={tokens.sage} size={24} strokeWidth={1.5} /></View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text size="xxl" weight="strong" style={{ color: tokens.inkStrong }}>{primaryTask?.title ?? data.summary}</Text>
                <Text size="lg" style={{ color: tokens.ink }}>{primaryTask ? `${primaryTask.durationMinutes} 分钟 · ${primaryTask.intensity}` : `${data.trainingTasks.length} 个训练任务`}</Text>
              </View>
            </View>
            {primaryTask ? <TrainingTimeline duration={primaryTask.durationMinutes} /> : null}
          </View>

          <View>
            <Text size="lg" weight="strong" style={[styles.sectionTitle, { color: tokens.sage }]}>训练安排</Text>
            {data.trainingTasks.slice(1).map((task) => (
              <View key={task.id}>
                <HairlineRow
                  title={task.title}
                  subtitle={`${formatDateLabel(task.date)} · ${formatTaskWindow(task.scheduledStart, task.scheduledEnd)} · ${task.intensity}`}
                  value={`${task.durationMinutes} 分`}
                  onPress={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
                />
                {expandedTaskId === task.id ? (
                  <View style={[styles.taskDetail, { borderBottomColor: tokens.line }]}>
                    {task.checklistItems.length ? task.checklistItems.map((item) => (
                      <Text key={item.id} size="sm" style={{ color: tokens.muted }}>· {item.label}</Text>
                    )) : <Text size="sm" style={{ color: tokens.muted }}>这个任务没有拆分步骤。</Text>}
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View>
            <Text size="lg" weight="strong" style={[styles.sectionTitle, { color: tokens.sage }]}>饮食</Text>
            <HairlineRow icon={<Utensils color={tokens.sage} size={21} strokeWidth={1.5} />} title="蛋白目标" subtitle={String(nutrition.carbohydrateGuidance)} value={typeof nutrition.proteinTargetGrams === "number" ? `${nutrition.proteinTargetGrams}g` : "未设置"} />
            <HairlineRow title="热量目标" value={String(nutrition.calorieTarget)} />
          </View>

          <View>
            <Text size="lg" weight="strong" style={[styles.sectionTitle, { color: tokens.sage }]}>日历草稿</Text>
            {drafts.data?.length ? drafts.data.map((draft) => (
              <HairlineRow
                key={draft.id}
                icon={<CalendarCheck color={draft.status === "failed" ? tokens.danger : tokens.sage} size={21} strokeWidth={1.5} />}
                title={draft.title}
                subtitle={`${formatTaskWindow(draft.startsAt, draft.endsAt)}${draft.failureReason ? ` · ${draft.failureReason}` : ""}`}
                value={confirmMutation.isPending && confirmMutation.variables === draft.id ? "写入中" : draft.status === "failed" ? "重试" : draft.operation === "cancel" ? "确认取消" : "确认"}
                onPress={() => confirmMutation.mutate(draft.id)}
              />
            )) : <Text size="sm" style={{ color: tokens.muted }}>没有待确认的日历变更。</Text>}
          </View>
        </>
      ) : (
        <View style={styles.emptyPlan}>
          <EmptyState title="暂无当前计划" description="生成后，这里会显示一周训练和饮食节奏。" />
          <Button title="生成本周计划" onPress={() => generateMutation.mutate()} disabled={generateMutation.isPending} />
        </View>
      )}
    </Screen>
  );
}

function TrainingTimeline({ duration }: { duration: number }) {
  const { tokens } = useTheme();
  const warmup = 5;
  const cooldown = 5;
  const steady = Math.max(5, duration - warmup - cooldown);
  return (
    <View style={styles.timeline}>
      <View style={styles.timelineTrack}>
        <View style={[styles.trackLine, { backgroundColor: tokens.sage }]} />
        {[0, 1, 2].map((index) => <View key={index} style={[styles.trackDot, { borderColor: tokens.sage, backgroundColor: tokens.bg }]} />)}
      </View>
      <View style={styles.timelineLabels}>
        <View><Text>热身</Text><Text size="sm" style={{ color: tokens.sage }}>{warmup} 分</Text></View>
        <View style={{ alignItems: "center" }}><Text>主体</Text><Text size="sm" style={{ color: tokens.sage }}>{steady} 分</Text></View>
        <View style={{ alignItems: "flex-end" }}><Text>放松</Text><Text size="sm" style={{ color: tokens.sage }}>{cooldown} 分</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayCircle: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 38 },
  dayItem: { alignItems: "center", flex: 1, gap: spacing.sm },
  emptyPlan: { gap: spacing.lg },
  primarySession: { gap: spacing.xl },
  sectionTitle: { marginBottom: spacing.xs },
  sessionIcon: { alignItems: "center", borderRadius: 34, borderWidth: 1, height: 64, justifyContent: "center", width: 64 },
  sessionTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.lg },
  taskDetail: { borderBottomWidth: 1, gap: spacing.xs, paddingBottom: spacing.md, paddingLeft: spacing.lg },
  timeline: { gap: spacing.sm },
  timelineLabels: { flexDirection: "row", justifyContent: "space-between" },
  timelineTrack: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.md },
  trackDot: { borderRadius: 8, borderWidth: 2, height: 16, width: 16, zIndex: 1 },
  trackLine: { height: 2, left: spacing.md, position: "absolute", right: spacing.md },
  weekStrip: { flexDirection: "row", marginHorizontal: -spacing.sm, paddingBottom: spacing.sm }
});
