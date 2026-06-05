export type ModelProvider = "openai" | "anthropic" | "custom";

export type DataMcpConnectionId = "coros" | "calendar" | "meal_menu";

export type DataMcpConnection = {
  id: DataMcpConnectionId;
  label: string;
  enabled: boolean;
  serverName: string;
  capabilityName: string;
  endpoint: string;
  notes: string;
};

export type SettingsView = {
  modelProvider: ModelProvider;
  modelName: string;
  modelBaseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  dataMcpConnections: DataMcpConnection[];
};

export const modelProviders: Array<{
  value: ModelProvider;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
}> = [
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", defaultBaseUrl: "https://api.openai.com/v1" },
  {
    value: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-3-5-haiku-latest",
    defaultBaseUrl: "https://api.anthropic.com/v1"
  },
  { value: "custom", label: "Custom", defaultModel: "custom-model", defaultBaseUrl: "" }
];

export const defaultDataMcpConnections: DataMcpConnection[] = [
  {
    id: "coros",
    label: "COROS",
    enabled: true,
    serverName: "coros",
    capabilityName: "daily-health",
    endpoint: "",
    notes: "Workout, sleep, HRV, recovery, and training load."
  },
  {
    id: "calendar",
    label: "Calendar",
    enabled: true,
    serverName: "calendar",
    capabilityName: "agenda",
    endpoint: "",
    notes: "Schedule, free windows, and training event drafts."
  },
  {
    id: "meal_menu",
    label: "Meal Menu",
    enabled: true,
    serverName: "meal-menu",
    capabilityName: "today-menu",
    endpoint: "",
    notes: "Daily breakfast, lunch, dinner, and nutrition choices."
  }
];

export const defaultSettingsView: SettingsView = {
  modelProvider: "openai",
  modelName: "gpt-4o-mini",
  modelBaseUrl: "https://api.openai.com/v1",
  hasApiKey: false,
  apiKeyHint: null,
  dataMcpConnections: defaultDataMcpConnections
};
