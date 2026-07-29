import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { ChoiceGroup } from "../../../../src/components/ChoiceGroup";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { TextField } from "../../../../src/components/TextField";

import { useGoalsQuery } from "../../../../src/api/hooks";
import { createGoal, pauseGoal, updateGoal, type GoalInput } from "../../../../src/api/goals";
import type { Goal } from "../../../../src/api/schemas";
import { opacity, spacing, useTheme } from "../../../../src/theme/tokens";

const types: readonly { value: Goal["type"]; label: string }[] = [
  { value: "primary", label: "主目标" },
  { value: "short_term_event", label: "短期赛事" },
  { value: "long_term", label: "长期" },
  { value: "secondary", label: "次要" }
];

export default function GoalSettingsScreen() {
  const query = useGoalsQuery();
  const queryClient = useQueryClient();
  const { confirm, notify } = useFeedback();
  const { tokens } = useTheme();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Goal["type"]>("primary");
  const [priority, setPriority] = useState("10");
  const [targetDate, setTargetDate] = useState("");

  function reset() {
    setEditing(null);
    setTitle("");
    setType("primary");
    setPriority("10");
    setTargetDate("");
  }

  function edit(goal: Goal) {
    setEditing(goal);
    setTitle(goal.title);
    setType(goal.type);
    setPriority(String(goal.priority));
    setTargetDate(goal.targetDate?.slice(0, 10) ?? "");
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const input: GoalInput = {
        title: title.trim(),
        type,
        priority: Number(priority),
        status: "active",
        ...(targetDate ? { targetDate } : {}),
        metrics: editing ? JSON.parse(editing.metricsJson) : {}
      };
      return editing ? updateGoal(editing.id, input) : createGoal(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      reset();
      notify({ title: "目标已保存", description: "计划优先级会在下次生成时更新。" });
    },
    onError: (error) => notify({ tone: "danger", title: "保存失败", description: error instanceof Error ? error.message : "请检查输入。" })
  });

  async function pause(goal: Goal) {
    const confirmed = await confirm({
      title: `暂停「${goal.title}」？`,
      description: "暂停后这个目标不再影响训练计划，可以随时重新启用。",
      confirmLabel: "暂停",
      destructive: true
    });
    if (!confirmed) return;
    try {
      await pauseGoal(goal.id);
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      notify({ title: "目标已暂停" });
    } catch (error) {
      notify({ tone: "danger", title: "暂停失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    }
  }

  return (
    <Screen>
      <InsetGroup header={editing ? "编辑目标" : "新建目标"} footer="主目标会直接影响训练计划优先级。">
        <TextField label="目标名称" value={title} onChange={setTitle} placeholder="例如：完成半程马拉松" autoCapitalize="sentences" />
        <ChoiceGroup label="类型" options={types} value={type} onChange={setType} />
        <TextField label="优先级" value={priority} onChange={setPriority} keyboardType="number-pad" placeholder="1-10" />
        <TextField label="目标日期" value={targetDate} onChange={setTargetDate} placeholder="YYYY-MM-DD（可选）" />
        <Button
          title={mutation.isPending ? "保存中…" : editing ? "保存修改" : "创建目标"}
          disabled={mutation.isPending || !title.trim()}
          onPress={() => mutation.mutate()}
        />
        {editing ? <Button title="取消编辑" variant="plain" onPress={reset} /> : null}
      </InsetGroup>

      <InsetGroup header="现有目标" footer="点击一行进行编辑。">
        {query.isLoading ? <Spinner /> : query.error ? (
          <EmptyState title="目标加载失败" description="请确认后端服务。" />
        ) : query.data?.length ? query.data.map((goal) => (
          <Row
            key={goal.id}
            title={goal.title}
            subtitle={`${types.find((item) => item.value === goal.type)?.label ?? goal.type} · 优先级 ${goal.priority} · ${goal.status}`}
            onPress={() => edit(goal)}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`暂停 ${goal.title}`}
                onPress={() => pause(goal)}
                style={({ pressed }) => [styles.pauseAction, pressed && { opacity: opacity.pressed }]}
              >
                <Text size="subheadline" style={{ color: tokens.red }}>暂停</Text>
              </Pressable>
            }
          />
        )) : <EmptyState title="还没有目标" description="目标会影响计划和教练建议。" />}
      </InsetGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pauseAction: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm }
});
