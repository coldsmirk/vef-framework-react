import { defineMock } from "../define-mock";

interface ConfigDefinition {
  id: string;
  category: string;
  key: string;
  name: string;
  valueType: string;
  isRequired: boolean;
  description?: string | null;
  sortOrder: number;
}

interface Configs {
  configDefinitions: ConfigDefinition[];
  configValues: Record<string, unknown>;
}

const definitionsByCategory: Record<string, ConfigDefinition[]> = {
  SYSTEM: [
    {
      id: "cfg-def-app-name",
      category: "SYSTEM",
      key: "app.name",
      name: "应用名称",
      valueType: "STRING",
      isRequired: true,
      sortOrder: 1
    },
    {
      id: "cfg-def-app-version",
      category: "SYSTEM",
      key: "app.version",
      name: "应用版本",
      valueType: "STRING",
      isRequired: false,
      sortOrder: 2
    },
    {
      id: "cfg-def-session-ttl",
      category: "SYSTEM",
      key: "session.ttl",
      name: "会话超时(秒)",
      valueType: "NUMBER",
      isRequired: true,
      sortOrder: 3
    }
  ],
  BUSINESS: [
    {
      id: "cfg-def-feature-x",
      category: "BUSINESS",
      key: "feature.x.enabled",
      name: "实验功能 X",
      valueType: "BOOLEAN",
      isRequired: false,
      sortOrder: 1
    }
  ],
  UI: [
    {
      id: "cfg-def-ui-theme",
      category: "UI",
      key: "ui.theme",
      name: "主题",
      valueType: "STRING",
      isRequired: false,
      sortOrder: 1
    }
  ]
};

const valuesByCategory: Record<string, Record<string, unknown>> = {
  SYSTEM: {
    "app.name": "演示应用",
    "app.version": "1.0.0",
    "session.ttl": 3600
  },
  BUSINESS: { "feature.x.enabled": false },
  UI: { "ui.theme": "light" }
};

defineMock<{ category: string }, Configs>("sys/config", "find_by_category", ({ params }) => {
  return {
    configDefinitions: definitionsByCategory[params.category] ?? [],
    configValues: valuesByCategory[params.category] ?? {}
  };
});

defineMock<{ category: string; configValues: Record<string, unknown> }, null>("sys/config", "save", ({ params }) => {
  valuesByCategory[params.category] = { ...valuesByCategory[params.category], ...params.configValues };
  return null;
});
