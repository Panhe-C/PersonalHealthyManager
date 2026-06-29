import { Screen } from "../../../src/components/Screen";
import { Text } from "../../../src/components/Text";
import { Card } from "../../../src/components/Card";
import { Spinner } from "../../../src/components/States";
import { useProfileQuery } from "../../../src/api/hooks";

export default function TodayTab() {
  const { data, isLoading, error } = useProfileQuery();
  return (
    <Screen>
      <Text size="xl" weight="strong">今日</Text>
      {isLoading ? <Spinner /> : error ? <Text>加载失败</Text> : (
        <Card>
          <Text weight="medium">后端连通探针</Text>
          <Text size="sm">profile 已加载: {data ? "是" : "无"}</Text>
        </Card>
      )}
    </Screen>
  );
}
