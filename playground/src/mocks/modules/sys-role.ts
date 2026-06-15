import type { DataOption, PaginationParams, PaginationResult } from "@vef-framework-react/core";

import { faker } from "@faker-js/faker";

import { defineMock } from "../define-mock";
import { createCrudMock } from "../helpers/crud";
import { applyKeyword, paginate } from "../helpers/paginate";

interface RoleRow {
  id: string;
  orgId: string;
  name: string;
  isActive: boolean;
  remark?: string | null;
}

createCrudMock<RoleRow>({
  resource: "sys/role",
  seed: 12,
  searchFields: ["name"],
  factory: i => {
    return {
      id: faker.string.uuid(),
      orgId: "org-root",
      name: ["系统管理员", "部门主管", "普通用户", "审核员", "访客", "财务", "运营", "客服", "开发者", "测试", "产品", "HR"][i] ?? `角色 ${i + 1}`,
      isActive: i !== 4,
      remark: i === 0 ? "拥有全部权限" : null
    };
  }
});

// Role permissions: hard-coded permission options and per-role grants.
const PERMISSION_OPTIONS: DataOption[] = [
  { label: "用户管理", value: "sys.user.manage" },
  { label: "角色管理", value: "sys.role.manage" },
  { label: "菜单管理", value: "sys.menu.manage" },
  { label: "组织管理", value: "md.organization.manage" },
  { label: "部门管理", value: "md.department.manage" },
  { label: "员工管理", value: "md.staff.manage" }
];

defineMock<void, DataOption[]>("sys/menu", "find_permission_options", () => PERMISSION_OPTIONS);

const rolePermissions = new Map<string, Record<string, { granted: boolean; dataScope?: string; dataScopeTargets?: unknown[]; customFilter?: unknown }>>();

defineMock<{ roleId: string }, Record<string, unknown>>(
  "sys/role",
  "find_permissions",
  ({ params }) => rolePermissions.get(params.roleId) ?? {}
);

defineMock<{ roleId: string; permissions: Record<string, unknown> }, null>(
  "sys/role",
  "save_role_permissions",
  ({ params }) => {
    rolePermissions.set(params.roleId, params.permissions as Record<string, { granted: boolean }>);
    return null;
  }
);

// Role users: simulate an assignment store. find_users / find_available_users
// share the same backing pool.
interface RoleUserRow {
  userId: string;
  username: string;
  name: string;
  gender: string;
  isActive: boolean;
  isLocked: boolean;
  deptId?: string | null;
  deptName?: string | null;
}

const userPool: RoleUserRow[] = Array.from({ length: 30 }, () => {
  return {
    userId: faker.string.uuid(),
    username: faker.internet.username().toLowerCase(),
    name: faker.person.fullName(),
    gender: faker.helpers.arrayElement(["male", "female"]),
    isActive: faker.datatype.boolean({ probability: 0.85 }),
    isLocked: false,
    deptId: null,
    deptName: null
  };
});

const roleUserAssignments = new Map<string, Set<string>>();

defineMock<{ roleId: string; keyword?: string }, PaginationResult<RoleUserRow>>(
  "sys/role",
  "find_users",
  ({ params, meta }) => {
    const assigned = roleUserAssignments.get(params.roleId) ?? new Set<string>();
    const rows = userPool.filter(u => assigned.has(u.userId));
    const filtered = applyKeyword(rows, params.keyword, ["username", "name"]);
    return paginate(filtered, meta as PaginationParams | undefined);
  }
);

defineMock<{ roleId: string; keyword?: string }, PaginationResult<RoleUserRow>>(
  "sys/role",
  "find_available_users",
  ({ params, meta }) => {
    const assigned = roleUserAssignments.get(params.roleId) ?? new Set<string>();
    const rows = userPool.filter(u => !assigned.has(u.userId));
    const filtered = applyKeyword(rows, params.keyword, ["username", "name"]);
    return paginate(filtered, meta as PaginationParams | undefined);
  }
);

defineMock<{ roleId: string; userIds: string[] }, null>("sys/role", "add_users", ({ params }) => {
  const set = roleUserAssignments.get(params.roleId) ?? new Set<string>();

  for (const id of params.userIds) {
    set.add(id);
  }

  roleUserAssignments.set(params.roleId, set);
  return null;
});

defineMock<{ roleId: string; userIds: string[] }, null>("sys/role", "remove_users", ({ params }) => {
  const set = roleUserAssignments.get(params.roleId);

  if (set) {
    for (const id of params.userIds) {
      set.delete(id);
    }
  }

  return null;
});
