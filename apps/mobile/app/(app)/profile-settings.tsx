import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Button } from "../../src/components/Button";
import { PageHeader } from "../../src/components/QuietHealth";
import { useProfileQuery } from "../../src/api/hooks";
import { saveProfile } from "../../src/api/profile";
import { radius, spacing, useTheme } from "../../src/theme/tokens";

type Draft = { height: string; weight: string; bodyFat: string; heartRate: string; sex: string; experience: string; injuries: string; diet: string; training: string };
const empty: Draft = { height: "", weight: "", bodyFat: "", heartRate: "", sex: "male", experience: "intermediate", injuries: "", diet: "", training: "" };
const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export default function ProfileSettingsScreen() {
  const query = useProfileQuery();
  const queryClient = useQueryClient();
  const { tokens } = useTheme();
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!query.data) return;
    setDraft({
      height: String(query.data.heightCm), weight: String(query.data.weightKg), bodyFat: query.data.bodyFatPercent == null ? "" : String(query.data.bodyFatPercent),
      heartRate: query.data.restingHeartRateBpm == null ? "" : String(query.data.restingHeartRateBpm), sex: query.data.sex, experience: query.data.trainingExperience,
      injuries: JSON.parse(query.data.injuriesJson).join(", "), diet: JSON.parse(query.data.dietaryPreferencesJson).join(", "), training: JSON.parse(query.data.trainingPreferencesJson).join(", ")
    });
  }, [query.data]);
  const change = (key: keyof Draft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const inputStyle = [styles.input, { backgroundColor: tokens.panel, borderColor: tokens.line, color: tokens.inkStrong }];

  async function submit() {
    const heightCm = Number(draft.height); const weightKg = Number(draft.weight);
    if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return Alert.alert("资料不完整", "请填写有效的身高和体重。");
    setBusy(true);
    try {
      const saved = await saveProfile({ heightCm, weightKg, bodyFatPercent: draft.bodyFat ? Number(draft.bodyFat) : undefined, restingHeartRateBpm: draft.heartRate ? Number(draft.heartRate) : undefined, sex: draft.sex, trainingExperience: draft.experience, injuries: list(draft.injuries), dietaryPreferences: list(draft.diet), trainingPreferences: list(draft.training) });
      queryClient.setQueryData(["profile"], saved);
      Alert.alert("已保存", "个人资料已同步到计划与教练上下文。");
    } catch (error) { Alert.alert("保存失败", error instanceof Error ? error.message : "请检查输入。"); }
    finally { setBusy(false); }
  }

  return <Screen><PageHeader title="个人资料" subtitle="逗号分隔多个限制或偏好。" />
    <View style={styles.two}><Field label="身高 cm" value={draft.height} onChange={change("height")} style={inputStyle} numeric /><Field label="体重 kg" value={draft.weight} onChange={change("weight")} style={inputStyle} numeric /></View>
    <View style={styles.two}><Field label="体脂 %" value={draft.bodyFat} onChange={change("bodyFat")} style={inputStyle} numeric /><Field label="静息心率" value={draft.heartRate} onChange={change("heartRate")} style={inputStyle} numeric /></View>
    <Field label="性别" value={draft.sex} onChange={change("sex")} style={inputStyle} placeholder="male / female / other" />
    <Field label="训练经验" value={draft.experience} onChange={change("experience")} style={inputStyle} placeholder="beginner / intermediate / advanced" />
    <Field label="伤病或限制" value={draft.injuries} onChange={change("injuries")} style={inputStyle} />
    <Field label="饮食偏好" value={draft.diet} onChange={change("diet")} style={inputStyle} />
    <Field label="训练偏好" value={draft.training} onChange={change("training")} style={inputStyle} />
    <Button title={busy ? "保存中…" : "保存个人资料"} disabled={busy} onPress={submit} />
  </Screen>;
}

function Field({ label, value, onChange, style, numeric, placeholder }: { label: string; value: string; onChange: (value: string) => void; style: object[]; numeric?: boolean; placeholder?: string }) {
  return <View style={styles.field}><Text weight="medium">{label}</Text><TextInput accessibilityLabel={label} keyboardType={numeric ? "decimal-pad" : "default"} placeholder={placeholder} value={value} onChangeText={onChange} style={style} /></View>;
}
const styles = StyleSheet.create({ field: { flex: 1, gap: spacing.sm }, input: { borderRadius: radius.md, borderWidth: 1, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md }, two: { flexDirection: "row", gap: spacing.md } });
