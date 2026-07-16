import type { AuthTokens } from "@vef-framework-react/core";
import type {
  LoginParams,
  LoginResult,
  ResolveChallengeParams,
  UserInfo,
  UserMenu
} from "@vef-framework-react/starter";

import { faker } from "@faker-js/faker";

import { defineMock, MockBusinessError } from "../define-mock";
import { MOCK_USER } from "../helpers/audit";

const TOKEN_EXPIRED_CODE = 1002;

function buildTokens(): AuthTokens {
  return {
    accessToken: `mock-access-${faker.string.alphanumeric(24)}`,
    refreshToken: `mock-refresh-${faker.string.alphanumeric(24)}`
  };
}

function leaf(name: string, path: string, icon?: string): UserMenu {
  return {
    type: "menu",
    name,
    path,
    icon
  };
}

function dir(name: string, path: string, icon: string, children: UserMenu[]): UserMenu {
  return {
    type: "directory",
    name,
    path,
    icon,
    children
  };
}

const MENUS: UserMenu[] = [
  leaf("首页", "/", "home"),
  dir("权限管理", "/auth", "shield", [
    leaf("用户管理", "/auth/user", "user"),
    leaf("角色管理", "/auth/role", "users"),
    leaf("菜单管理", "/auth/menu", "menu")
  ]),
  dir("主数据", "/md", "database", [
    leaf("组织管理", "/md/organization", "building"),
    leaf("部门管理", "/md/department", "building-2"),
    leaf("员工管理", "/md/staff", "user-round"),
    leaf("行政区划", "/md/district", "map"),
    leaf("ID 映射", "/md/id-mapping", "link")
  ]),
  dir("集成引擎", "/sys/integration", "cable", [
    leaf("集成契约", "/sys/integration-contract", "file-code"),
    leaf("外部系统", "/sys/integration-system", "server"),
    leaf("集成适配器", "/sys/integration-adapter", "plug"),
    leaf("集成路由", "/sys/integration-route", "route"),
    leaf("集成控制台", "/sys/integration-console", "terminal")
  ]),
  dir("系统", "/sys", "settings", [
    leaf("应用管理", "/sys/app", "app-window"),
    leaf("字典管理", "/sys/dictionary", "book"),
    leaf("字典项管理", "/sys/dictionary-item", "book-open"),
    leaf("字典演示", "/sys/dictionary-demo", "sparkles"),
    leaf("配置定义", "/sys/config-definition", "list"),
    leaf("配置管理", "/sys/config", "sliders"),
    leaf("流水号规则", "/sys/serial-no-rule", "hash"),
    leaf("登录日志", "/sys/login-log", "log-in"),
    leaf("审计日志", "/sys/audit-log", "scroll-text"),
    leaf("系统监控", "/sys/monitor", "activity"),
    leaf("表单设计器", "/sys/form-editor", "file-pen"),
    leaf("审批流设计器", "/sys/approval-flow-editor", "git-branch"),
    leaf("可编辑表格", "/sys/editable-table-demo", "table"),
    leaf("文件预览", "/sys/file-preview-demo", "eye")
  ]),
  dir("审批中心", "/approval", "workflow", [
    leaf("发起审批", "/approval/initiate", "send"),
    leaf("任务中心", "/approval/task-center", "clipboard-check"),
    leaf("我的申请", "/approval/my-instances", "file-text"),
    leaf("流程管理", "/approval/flow", "git-branch"),
    leaf("流程分类", "/approval/category", "folder-tree"),
    leaf("审批委托", "/approval/delegation", "user-check"),
    leaf("审批管理台", "/approval/admin", "gauge")
  ])
];

function buildUserInfo(): UserInfo {
  return {
    id: MOCK_USER.id,
    name: MOCK_USER.name,
    gender: "unknown",
    permissionTokens: ["*"],
    menus: MENUS,
    details: {}
  };
}

// Backend error code for password-policy violations (`security.ErrCodePasswordPolicyViolation`).
const PASSWORD_POLICY_VIOLATION_CODE = 1050;

defineMock<LoginParams, LoginResult>("security/auth", "login", ({ params }) => {
  // Demo account for the forced password-change challenge
  // (`security.PasswordChangeChallengeProvider`): first login must set a new
  // password before tokens are issued.
  if (params.principal === "rookie" && params.credentials === "rookie") {
    return {
      challengeToken: `mock-challenge-${faker.string.alphanumeric(24)}`,
      challenge: {
        type: "password_change",
        data: { reason: "first_login" },
        required: true
      }
    };
  }

  if (params.principal !== "admin" || params.credentials !== "admin") {
    throw new MockBusinessError(1001, "用户名或密码错误");
  }

  return { message: "登录成功", tokens: buildTokens() };
});

defineMock<ResolveChallengeParams, LoginResult>("security/auth", "resolve_challenge", ({ params }) => {
  if (params.type === "password_change") {
    const newPassword = typeof params.response === "string" ? params.response : "";

    if (newPassword.length < 8) {
      throw new MockBusinessError(PASSWORD_POLICY_VIOLATION_CODE, "密码长度不能少于 8 位");
    }
  }

  return {
    message: "登录成功",
    tokens: buildTokens()
  };
});

defineMock<void, null>("security/auth", "logout", () => null);

defineMock<{ appId?: string }, UserInfo>("security/auth", "get_user_info", () => buildUserInfo());

defineMock<AuthTokens, AuthTokens>("security/auth", "refresh", ({ params }) => {
  if (!params.refreshToken) {
    throw new MockBusinessError(TOKEN_EXPIRED_CODE, "refresh token 无效");
  }

  return buildTokens();
});
