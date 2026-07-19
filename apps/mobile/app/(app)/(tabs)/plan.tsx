import { Alert, Pressable, StyleSheet, View } from "react-native";
import { CalendarCheck, Dumbbell, Utensils } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../src/components/Screen";
import { Text } from "../../../src/components/Text";
import { Button } from "../../../src/components/Button";
import { EmptyState, Spinner } from "../../../src/components/States";
import { HairlineRow, PageHeader } from "../../../src/components/QuietHealth";
import { useActivePlanQuery, useCalendarDraftsQuery } from "../../../src/api/hooks";
import { generateActivePlan } from "../../../src/api/training";
import { confirmCalendarDraft } from "../../../src/api/calendar";
import { currentWeekStartIso, formatDateLabel, formatTaskWindow, parseJsonObject, weekDayNumbers } from "../../../src/ui/format";
import { spacing, useTheme } from "../../../src/theme/tokens";

const weekNames = ["一", "二", "三", "四", "五", "六", "日"];

export default function PlanTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useActivePlanQuery();
  const drafts = useCalendarDraftsQuery();
  const { tokens } = useTheme();
  const generateMutation = useMutation({
    mutationFn: () => generateActivePlan(currentWeekStartIso()),
    onSuccess: (plan) => {
      queryClient.setQueryData(["plan", "active"], plan);
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      Alert.alert("计划已生成", "本周训练和饮食建议已同步到 App。");
    },
    onError: (err) => Alert.alert("生成失败", err instanceof Error ? err.message : "请稍后重试。")
  });
  const confirmMutation = useMutation({
    mutationFn: confirmCalendarDraft,
    onSuccess: (draft) => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", "drafts"] });
      Alert.alert(draft.status === "confirmed" ? "已写入日历" : "写入失败", draft.failureReason || "飞书日历已更新。");
    },
    onError: (err) => Alert.alert("确认失败", err instanceof Error ? err.message : "请稍后重试。")
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
      <PageHeader
        title="本周计划"
        subtitle={data ? `${formatDateLabel(data.weekStart)} – ${formatDateLabel(data.weekEnd)}` : "训练与饮食节奏"}
        action={<Pressable onPress={() => generateMutation.mutate()} disabled={generateMutation.isPending}><Text weight="medium" style={{ color: tokens.clay }}>{generateMutation.isPending ? "生成中" : data ? "调整" : "生成"}</Text></Pressable>}
      />

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
              <HairlineRow
                key={task.id}
                title={task.title}
                subtitle={`${formatDateLabel(task.date)} · ${formatTaskWindow(task.scheduledStart, task.scheduledEnd)} · ${task.intensity}`}
                value={`${task.durationMinutes} 分`}
                onPress={() => Alert.alert(task.title, task.checklistItems.map((item) => `• ${item.label}`).join("\n"))}
              />
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
  timeline: { gap: spacing.sm },
  timelineLabels: { flexDirection: "row", justifyContent: "space-between" },
  timelineTrack: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.md },
  trackDot: { borderRadius: 8, borderWidth: 2, height: 16, width: 16, zIndex: 1 },
  trackLine: { height: 2, left: spacing.md, position: "absolute", right: spacing.md },
  weekStrip: { flexDirection: "row", marginHorizontal: -spacing.sm, paddingBottom: spacing.sm }
});
