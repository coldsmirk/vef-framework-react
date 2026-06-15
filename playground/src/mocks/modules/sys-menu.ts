import { faker } from "@faker-js/faker";

import { createTreeMock } from "../helpers/tree";

interface MenuRow {
  id: string;
  appId: string;
  parentId?: string | null;
  type: "D" | "M" | "V" | "P" | "R";
  typeName?: string;
  name: string;
  icon?: string | null;
  path?: string | null;
  permissionCode?: string | null;
  isActive: boolean;
  sortOrder: number;
  remark?: string | null;
}

// Three rooted dirs, each with a couple of leaves so the tree has shape.
const seeds: MenuRow[] = [
  {
    id: "menu-auth",
    appId: "app-default",
    parentId: null,
    type: "D",
    name: "权限管理",
    icon: "shield",
    path: "/auth",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "menu-auth-user",
    appId: "app-default",
    parentId: "menu-auth",
    type: "M",
    name: "用户管理",
    icon: "user",
    path: "/auth/user",
    isActive: true,
    sortOrder: 1,
    permissionCode: "sys.user.manage"
  },
  {
    id: "menu-auth-role",
    appId: "app-default",
    parentId: "menu-auth",
    type: "M",
    name: "角色管理",
    icon: "users",
    path: "/auth/role",
    isActive: true,
    sortOrder: 2
  },
  {
    id: "menu-md",
    appId: "app-default",
    parentId: null,
    type: "D",
    name: "主数据",
    icon: "database",
    path: "/md",
    isActive: true,
    sortOrder: 2
  },
  {
    id: "menu-md-org",
    appId: "app-default",
    parentId: "menu-md",
    type: "M",
    name: "组织管理",
    icon: "building",
    path: "/md/organization",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "menu-md-dept",
    appId: "app-default",
    parentId: "menu-md",
    type: "M",
    name: "部门管理",
    icon: "building-2",
    path: "/md/department",
    isActive: true,
    sortOrder: 2
  },
  {
    id: "menu-sys",
    appId: "app-default",
    parentId: null,
    type: "D",
    name: "系统",
    icon: "settings",
    path: "/sys",
    isActive: true,
    sortOrder: 3
  },
  {
    id: "menu-sys-app",
    appId: "app-default",
    parentId: "menu-sys",
    type: "M",
    name: "应用管理",
    icon: "app-window",
    path: "/sys/app",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "menu-sys-monitor",
    appId: "app-default",
    parentId: "menu-sys",
    type: "M",
    name: "系统监控",
    icon: "activity",
    path: "/sys/monitor",
    isActive: true,
    sortOrder: 2
  }
];

createTreeMock<MenuRow>({
  resource: "sys/menu",
  seed: seeds.length,
  searchField: "name",
  where: (items, params) => {
    const appId = typeof params.appId === "string" ? params.appId : undefined;
    return appId ? items.filter(item => item.appId === appId) : items;
  },
  factory: i => seeds[i]!
});

void faker;
