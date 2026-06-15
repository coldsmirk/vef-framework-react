import { faker } from "@faker-js/faker";

import { createCrudMock } from "../helpers/crud";
import { enrichWithDictNames } from "../helpers/dict-enrich";

interface ConfigDefinitionRow {
  id: string;
  category?: string | null;
  key: string;
  name: string;
  description?: string | null;
  valueType: string;
  isRequired: boolean;
  remark?: string | null;
  sortOrder: number;
  meta?: Record<string, unknown> | null;
}

const seeds: Array<Pick<ConfigDefinitionRow, "id" | "category" | "key" | "name" | "valueType" | "isRequired">> = [
  {
    id: "cfg-def-app-name",
    category: "SYSTEM",
    key: "app.name",
    name: "应用名称",
    valueType: "STRING",
    isRequired: true
  },
  {
    id: "cfg-def-app-version",
    category: "SYSTEM",
    key: "app.version",
    name: "应用版本",
    valueType: "STRING",
    isRequired: false
  },
  {
    id: "cfg-def-session-ttl",
    category: "SYSTEM",
    key: "session.ttl",
    name: "会话超时(秒)",
    valueType: "NUMBER",
    isRequired: true
  },
  {
    id: "cfg-def-feature-x",
    category: "BUSINESS",
    key: "feature.x.enabled",
    name: "实验功能 X",
    valueType: "BOOLEAN",
    isRequired: false
  },
  {
    id: "cfg-def-ui-theme",
    category: "UI",
    key: "ui.theme",
    name: "主题",
    valueType: "STRING",
    isRequired: false
  }
];

createCrudMock<ConfigDefinitionRow>({
  resource: "sys/config_definition",
  seed: seeds.length,
  searchFields: ["key", "name"],
  decorate: enrichWithDictNames({
    category: "sys.config_definition.category",
    valueType: "sys.config_definition.value_type"
  }),
  factory: i => {
    return {
      ...seeds[i]!,
      description: faker.lorem.sentence(),
      remark: null,
      sortOrder: i + 1,
      meta: null
    };
  }
});
