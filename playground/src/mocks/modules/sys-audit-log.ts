import type { PaginationParams, PaginationResult } from "@vef-framework-react/core";

import { faker } from "@faker-js/faker";

import { defineMock } from "../define-mock";
import { makeAudit, MOCK_USER } from "../helpers/audit";
import { applyKeyword, paginate } from "../helpers/paginate";

interface AuditLogRow {
  id: string;
  userId: string;
  userAgent: string;
  userName: string;
  apiResource: string;
  apiAction: string;
  apiVersion: string;
  requestIp: string;
  requestId: string;
  requestParams: Record<string, unknown>;
  requestMeta: Record<string, unknown>;
  resultCode: number;
  resultMessage: string;
  resultData: Record<string, unknown> | null;
  elapsedTime: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName: string;
  updatedByName: string;
}

const resources = ["sys/user", "sys/role", "md/staff", "md/department", "sys/config"];
const actions = ["find_page", "create", "update", "delete", "find_options"];

const store: AuditLogRow[] = Array.from({ length: 60 }, () => {
  return {
    id: faker.string.uuid(),
    ...makeAudit(),
    userId: MOCK_USER.id,
    userName: MOCK_USER.name,
    userAgent: faker.internet.userAgent(),
    apiResource: faker.helpers.arrayElement(resources),
    apiAction: faker.helpers.arrayElement(actions),
    apiVersion: "v1",
    requestIp: faker.internet.ip(),
    requestId: faker.string.uuid(),
    requestParams: {},
    requestMeta: {},
    resultCode: faker.helpers.weightedArrayElement([
      { weight: 90, value: 0 },
      { weight: 8, value: 1001 },
      { weight: 2, value: 500 }
    ]),
    resultMessage: "ok",
    resultData: null,
    elapsedTime: faker.number.int({ min: 10, max: 800 })
  };
});

defineMock<{ keyword?: string }, PaginationResult<AuditLogRow>>(
  "sys/audit_log",
  "find_page",
  ({ params, meta }) => {
    const rows = applyKeyword(store, params.keyword, ["apiResource", "apiAction", "userName", "requestIp"]);
    return paginate(rows, meta as PaginationParams | undefined);
  }
);
