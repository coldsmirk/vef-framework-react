import { faker } from "@faker-js/faker";

import { createCrudMock } from "../helpers/crud";

interface AppRow {
  id: string;
  name: string;
  icon?: string | null;
  url?: string | null;
  isActive: boolean;
  sortOrder: number;
  remark?: string | null;
  meta?: Record<string, unknown> | null;
}

createCrudMock<AppRow>({
  resource: "sys/app",
  seed: 8,
  searchFields: ["name"],
  factory: i => {
    return {
      id: i === 0 ? "app-default" : faker.string.uuid(),
      name: ["默认应用", "运营后台", "客户门户", "财务系统", "BI 看板", "移动端", "API 网关", "审批中心"][i] ?? `应用 ${i + 1}`,
      icon: null,
      url: i === 0 ? "/" : `/apps/${i}`,
      isActive: true,
      sortOrder: i + 1,
      remark: null,
      meta: null
    };
  }
});
