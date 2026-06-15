import type { PaginationParams, PaginationResult } from "@vef-framework-react/core";

import { faker } from "@faker-js/faker";

import { defineMock } from "../define-mock";
import { makeAudit, MOCK_USER } from "../helpers/audit";
import { applyKeyword, paginate } from "../helpers/paginate";

interface LoginLogRow {
  id: string;
  userId: string | null;
  username: string | null;
  userName: string | null;
  loginIp: string | null;
  userAgent: string;
  isOk: boolean;
  failReason: string | null;
  traceId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName: string;
  updatedByName: string;
}

const store: LoginLogRow[] = Array.from({ length: 40 }, (_, i) => {
  const isOk = faker.datatype.boolean({ probability: 0.85 });
  return {
    id: faker.string.uuid(),
    ...makeAudit(),
    userId: isOk ? MOCK_USER.id : null,
    username: isOk ? "admin" : faker.internet.username().toLowerCase(),
    userName: isOk ? MOCK_USER.name : null,
    loginIp: faker.internet.ip(),
    userAgent: faker.internet.userAgent(),
    isOk,
    failReason: isOk ? null : faker.helpers.arrayElement(["密码错误", "账户被锁定", "验证码错误"]),
    traceId: faker.string.uuid().slice(0, 16),
    // Spread dates a bit so the date range filter looks alive.
    createdAt: faker.date.recent({ days: 30 - (i % 30) }).toISOString()
  };
});

defineMock<{ keyword?: string }, PaginationResult<LoginLogRow>>(
  "sys/login_log",
  "find_page",
  ({ params, meta }) => {
    const rows = applyKeyword(store, params.keyword, ["username", "userName", "loginIp"]);
    return paginate(rows, meta as PaginationParams | undefined);
  }
);
