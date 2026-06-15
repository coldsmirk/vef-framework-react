import { faker } from "@faker-js/faker";

import { createCrudMock } from "../helpers/crud";

interface IdMappingRow {
  id: string;
  tableName: string;
  externalApp: string;
  externalAppName?: string;
  fromId: string;
  toId: string;
}

const externalAppNames: Record<string, string> = {
  HIS: "HIS 系统",
  LIS: "检验系统",
  PACS: "影像系统"
};

createCrudMock<IdMappingRow>({
  resource: "md/id_mapping",
  seed: 18,
  searchFields: ["tableName", "fromId", "toId"],
  labelField: "fromId",
  factory: () => {
    const app = faker.helpers.arrayElement(["HIS", "LIS", "PACS"]);
    return {
      id: faker.string.uuid(),
      tableName: faker.helpers.arrayElement(["staff", "patient", "department", "drug"]),
      externalApp: app,
      externalAppName: externalAppNames[app],
      fromId: faker.string.alphanumeric({ length: 10, casing: "upper" }),
      toId: faker.string.uuid()
    };
  },
  decorate: row => { return { ...row, externalAppName: externalAppNames[row.externalApp] ?? row.externalApp }; }
});
