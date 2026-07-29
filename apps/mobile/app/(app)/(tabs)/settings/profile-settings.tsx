import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { ChoiceGroup } from "../../../../src/components/ChoiceGroup";
import { useFeedback } from "../../../../src/components/Feedback";
import { Section } from "../../../../src/components/Section";
import { TextField } from "../../../../src/components/TextField";

import { useProfileQuery } from "../../../../src/api/hooks";
import { saveProfile } from "../../../../src/api/profile";
import { spacing, useTheme } from "../../../../src/theme/tokens";

type Sex = "male" | "female" | "other";
type Experience = "beginner" | "intermediate" | "advanced";

type Draft = {
  height: string;
  weight: string;
  bodyFat: string;
  heartRate: string;
  sex: Sex;
  experience: Experience;
  injuries: string;
  diet: string;
  training: string;
};

const empty: Draft = {
  height: "",
  weight: "",
  bodyFat: "",
  heartRate: "",
  sex: "male",
  experience: "intermediate",
  injuries: "",
  diet: "",
  training: ""
};

const sexOptions: readonly { value: Sex; label: string }[] = [
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "other", label: "其他" }
];

const experienceOptions: readonly { value: Experience; label: string }[] = [
  { value: "beginner", label: "初级" },
  { value: "intermediate", label: "中级" },
  { value: "advanced", label: "高级" }
];

const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

const asOption = <Value extends string>(options: readonly { value: Value }[], raw: string, fallback: Value): Value =>
  options.find((option) => option.value === raw)?.value ?? fallback;

export default function ProfileSettingsScreen() {
  const query = useProfileQuery();
  const queryClient = useQueryClient();
  const { notify } = useFeedback();
  const { tokens } = useTheme();
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ height?: string; weight?: string }>({});

  useEffect(() => {
    if (!query.data) return;
    setDraft({
      height: String(query.data.heightCm),
      weight: String(query.data.weightKg),
      bodyFat: query.data.bodyFatPercent == null ? "" : String(query.data.bodyFatPercent),
      heartRate: query.data.restingHeartRateBpm == null ? "" : String(query.data.restingHeartRateBpm),
      sex: asOption(sexOptions, query.data.sex, "male"),
      experience: asOption(experienceOptions, query.data.trainingExperience, "intermediate"),
      injuries: JSON.parse(query.data.injuriesJson).join(", "),
      diet: JSON.parse(query.data.dietaryPreferencesJson).join(", "),
      training: JSON.parse(query.data.trainingPreferencesJson).join(", ")
    });
  }, [query.data]);

  const change = (key: "height" | "weight" | "bodyFat" | "heartRate" | "injuries" | "diet" | "training") => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function submit() {
    const heightCm = Number(draft.height);
    const weightKg = Number(draft.weight);
    const nextErrors = {
      height: Number.isFinite(heightCm) && heightCm > 0 ? undefined : "请填写有效身高",
      weight: Number.isFinite(weightKg) && weightKg > 0 ? undefined : "请填写有效体重"
    };
    setErrors(nextErrors);
    if (nextErrors.height || nextErrors.weight) return;

    setBusy(true);
    try {
      const saved = await saveProfile({
        heightCm,
        weightKg,
        bodyFatPercent: draft.bodyFat ? Number(draft.bodyFat) : undefined,
        restingHeartRateBpm: draft.heartRate ? Number(draft.heartRate) : undefined,
        sex: draft.sex,
        trainingExperience: draft.experience,
        injuries: list(draft.injuries),
        dietaryPreferences: list(draft.diet),
        trainingPreferences: list(draft.training)
      });
      queryClient.setQueryData(["profile"], saved);
      notify({ title: "个人资料已保存", description: "计划与教练会立即使用新的资料。" });
    } catch (error) {
      notify({ tone: "danger", title: "保存失败", description: error instanceof Error ? error.message : "请检查输入。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={{ color: tokens.muted }}>这些资料决定训练强度上限和饮食建议。</Text>

      <Section title="身体数据">
        <View style={styles.row}>
          <TextField label="身高 cm" value={draft.height} onChange={change("height")} keyboardType="decimal-pad" error={errors.height} />
          <TextField label="体重 kg" value={draft.weight} onChange={change("weight")} keyboardType="decimal-pad" error={errors.weight} />
        </View>
        <View style={styles.row}>
          <TextField label="体脂 %" value={draft.bodyFat} onChange={change("bodyFat")} keyboardType="decimal-pad" placeholder="可选" />
          <TextField label="静息心率" value={draft.heartRate} onChange={change("heartRate")} keyboardType="number-pad" placeholder="可选" />
        </View>
      </Section>

      <Section title="训练背景">
        <ChoiceGroup
          label="性别"
          options={sexOptions}
          value={draft.sex}
          onChange={(sex) => setDraft((current) => ({ ...current, sex }))}
        />
        <ChoiceGroup
          label="训练经验"
          options={experienceOptions}
          value={draft.experience}
          onChange={(experience) => setDraft((current) => ({ ...current, experience }))}
        />
      </Section>

      <Section title="限制与偏好" description="用逗号分隔多个条目。">
        <TextField label="伤病或限制" value={draft.injuries} onChange={change("injuries")} placeholder="例如：左膝半月板，腰椎间盘" />
        <TextField label="饮食偏好" value={draft.diet} onChange={change("diet")} placeholder="例如：高蛋白，少辣" />
        <TextField label="训练偏好" value={draft.training} onChange={change("training")} placeholder="例如：早晨跑步，不做力量" />
      </Section>

      <Button title={busy ? "保存中…" : "保存个人资料"} disabled={busy} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md }
});
