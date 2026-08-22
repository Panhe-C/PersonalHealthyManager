import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { CheckCircle2, Circle, Compass, Dumbbell, Target, CalendarCheck2, Sparkles } from "lucide-react-native";
import { getOnboardingState, completeOnboarding } from "../src/api/onboarding";
import { markOnboardingBypassed } from "../src/auth/OnboardingGate";
import type { OnboardingStateResponse } from "@hbm/contracts";
import { Button } from "../src/components/Button";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { spacing, useTheme } from "../src/theme/tokens";

const STEP_DEFS = [
  {
    key: "bodyProfile" as const,
    icon: Dumbbell,
    title: "填写身体资料",
    hint: "身高、体重、训练经验和偏好。计划引擎据此安排强度。",
    cta: "去填写"
  },
  {
    key: "goal" as const,
    icon: Target,
    title: "添加一个目标",
    hint: "至少一个进行中的目标。最高优先级目标主导本周计划。",
    cta: "去添加"
  },
  {
    key: "calendarSnapshot" as const,
    icon: CalendarCheck2,
    title: "同步本周日程",
    hint: "导入日历或使用示例数据，让计划避开忙碌时段。",
    cta: "去同步"
  },
  {
    key: "plan" as const,
    icon: Sparkles,
    title: "生成本周计划",
    hint: "前两步完成后即可生成。可随时重新生成。",
    cta: "去生成"
  }
];

export default function OnboardingScreen() {
  const { tokens } = useTheme();
  const [state, setState] = useState<OnboardingStateResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    getOnboardingState()
      .then(setState)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await completeOnboarding(true);
      markOnboardingBypassed();
      router.replace("/(app)/(tabs)/today");
    } catch {
      setBusy(false);
    }
  }, []);

  const skip = useCallback(() => {
    markOnboardingBypassed();
    router.replace("/(app)/(tabs)/today");
  }, []);

  if (loadFailed) {
    return (
      <Screen>
        <View style={styles.header}>
          <Compass color={tokens.tint} size={28} />
          <Text size="title1" weight="strong" style={styles.pageTitle}>新手引导</Text>
          <Text size="subheadline" color={tokens.labelSecondary}>
            加载引导状态失败，请检查网络后重试。
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="重试" onPress={load} />
          <Button title="稍后再说，先看看" variant="plain" onPress={skip} />
        </View>
      </Screen>
    );
  }

  if (!state) return null;

  const allDone = STEP_DEFS.every((step) => state.steps[step.key]);

  return (
    <Screen>
      <View style={styles.header}>
        <Compass color={tokens.tint} size={28} />
        <Text size="title1" weight="strong" style={styles.pageTitle}>新手引导</Text>
        <Text size="subheadline" color={tokens.labelSecondary}>
          按顺序完成后即可生成本周计划。每步可跳过，稍后在对应页面继续。
        </Text>
      </View>

      <View style={styles.steps}>
        {STEP_DEFS.map((step, index) => {
          const done = state.steps[step.key];
          const Icon = step.icon;
          return (
            <View key={step.key} style={[styles.step, done && styles.stepDone]}>
              <View style={styles.stepIcon}>
                {done ? <CheckCircle2 color={tokens.tint} size={20} /> : <Circle color={tokens.labelSecondary} size={20} />}
              </View>
              <View style={styles.stepBody}>
                <View style={styles.stepTitle}>
                  <Icon color={tokens.labelSecondary} size={14} />
                  <Text weight="strong">{index + 1}. {step.title}</Text>
                </View>
                <Text size="footnote" color={tokens.labelSecondary}>{step.hint}</Text>
              </View>
              <Text size="footnote" weight="strong" color={done ? tokens.tint : tokens.labelSecondary}>
                {done ? "已完成" : step.cta}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.disclaimer}>
        <Text size="footnote" color={tokens.labelSecondary}>
          健康身体管家提供训练与恢复建议，但不构成医疗诊断或治疗处方。如有伤病、慢性病或服药情况，请以医生意见为准。
        </Text>
      </View>

      <View style={styles.actions}>
        <Button title={busy ? "保存中…" : allDone ? "我已完成，进入应用" : "我已知悉，开始使用"} onPress={finish} disabled={busy} />
        <Button title="稍后再说，先看看" variant="plain" onPress={skip} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  pageTitle: { fontSize: 30, letterSpacing: -0.5, lineHeight: 36, marginTop: 2 },
  steps: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: "rgba(120,120,120,0.06)"
  },
  stepDone: { backgroundColor: "rgba(63,124,92,0.10)" },
  stepIcon: { width: 24, alignItems: "center" },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  disclaimer: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  actions: { gap: spacing.md, paddingTop: spacing.lg }
});
