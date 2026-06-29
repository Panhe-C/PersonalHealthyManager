import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { useAuth } from "../../../../src/auth/AuthContext";

export default function SettingsTab() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Text size="xl" weight="strong">我的</Text>
      <Button title="登出" variant="ghost" onPress={signOut} />
      <Text>设置/MCP（M5 实现）</Text>
    </Screen>
  );
}
