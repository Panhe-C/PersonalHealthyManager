import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { PageHeader } from "../../src/components/QuietHealth";
import { useGoalsQuery } from "../../src/api/hooks";
import { createGoal, pauseGoal, updateGoal, type GoalInput } from "../../src/api/goals";
import type { Goal } from "../../src/api/schemas";
import { radius, spacing, useTheme } from "../../src/theme/tokens";

const types: Array<{ value: Goal["type"]; label: string }> = [
  { value: "primary", label: "主目标" }, { value: "short_term_event", label: "短期赛事" }, { value: "long_term", label: "长期" }, { value: "secondary", label: "次要" }
];

export default function GoalSettingsScreen() {
  const query = useGoalsQuery(); const queryClient = useQueryClient(); const { tokens } = useTheme();
  const [editing, setEditing] = useState<Goal | null>(null); const [title, setTitle] = useState(""); const [type, setType] = useState<Goal["type"]>("primary"); const [priority, setPriority] = useState("10"); const [targetDate, setTargetDate] = useState("");
  const reset = () => { setEditing(null); setTitle(""); setType("primary"); setPriority("10"); setTargetDate(""); };
  const edit = (goal: Goal) => { setEditing(goal); setTitle(goal.title); setType(goal.type); setPriority(String(goal.priority)); setTargetDate(goal.targetDate?.slice(0, 10) ?? ""); };
  const mutation = useMutation({ mutationFn: async () => {
    const input: GoalInput = { title: title.trim(), type, priority: Number(priority), status: "active", ...(targetDate ? { targetDate } : {}), metrics: editing ? JSON.parse(editing.metricsJson) : {} };
    return editing ? updateGoal(editing.id, input) : createGoal(input);
  }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["goals"] }); reset(); Alert.alert("已保存", "目标已更新。"); }, onError: (error) => Alert.alert("保存失败", error instanceof Error ? error.message : "请检查输入。") });
  const inputStyle = [styles.input, { backgroundColor: tokens.panel, borderColor: tokens.line, color: tokens.inkStrong }];

  return <Screen><PageHeader title="目标管理" subtitle="主目标会直接影响训练计划优先级。" />
    <Card style={styles.form}><Text size="xl" weight="strong">{editing ? "编辑目标" : "新建目标"}</Text>
      <TextInput accessibilityLabel="目标名称" placeholder="例如：完成半程马拉松" value={title} onChangeText={setTitle} style={inputStyle} />
      <View style={styles.types}>{types.map((item) => <Pressable accessibilityRole="button" key={item.value} onPress={() => setType(item.value)} style={[styles.type, { borderColor: type === item.value ? tokens.sage : tokens.line, backgroundColor: type === item.value ? tokens.sageSoft : tokens.panel }]}><Text>{item.label}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="优先级" keyboardType="number-pad" placeholder="1-10" value={priority} onChangeText={setPriority} style={inputStyle} />
      <TextInput accessibilityLabel="目标日期" autoCapitalize="none" placeholder="YYYY-MM-DD（可选）" value={targetDate} onChangeText={setTargetDate} style={inputStyle} />
      <Button title={mutation.isPending ? "保存中…" : editing ? "保存修改" : "创建目标"} disabled={mutation.isPending || !title.trim()} onPress={() => mutation.mutate()} />
      {editing ? <Button title="取消编辑" variant="ghost" onPress={reset} /> : null}
    </Card>
    <View>{query.data?.map((goal) => <Card key={goal.id} style={styles.goal} onPress={() => edit(goal)}>
      <View style={styles.goalRow}><View style={{ flex: 1 }}><Text size="lg" weight="strong">{goal.title}</Text><Text size="sm" style={{ color: tokens.muted }}>{types.find((item) => item.value === goal.type)?.label} · 优先级 {goal.priority}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => Alert.alert("暂停目标", `暂停“${goal.title}”？`, [{ text: "取消", style: "cancel" }, { text: "暂停", style: "destructive", onPress: async () => { await pauseGoal(goal.id); void queryClient.invalidateQueries({ queryKey: ["goals"] }); } }])}><Text style={{ color: tokens.danger }}>暂停</Text></Pressable></View>
    </Card>)}</View>
  </Screen>;
}

const styles = StyleSheet.create({ form: { gap: spacing.md }, goal: { marginBottom: spacing.md }, goalRow: { alignItems: "center", flexDirection: "row", gap: spacing.md }, input: { borderRadius: radius.md, borderWidth: 1, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md }, type: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, types: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
