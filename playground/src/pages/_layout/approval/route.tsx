import type { ApprovalPlugins, PickerProps, PrincipalKind } from "@vef-framework-react/approval";
import type { FC, ReactNode } from "react";

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ApprovalProvider } from "@vef-framework-react/approval";
import { Select } from "@vef-framework-react/components";

interface MockOption {
  label: string;
  value: string;
}

const MOCK_OPTIONS: Record<PrincipalKind, MockOption[]> = {
  user: [
    { label: "张三", value: "u_1" },
    { label: "李四", value: "u_2" },
    { label: "王五", value: "u_3" }
  ],
  role: [
    { label: "部门经理", value: "r_1" },
    { label: "财务主管", value: "r_2" },
    { label: "系统管理员", value: "r_3" }
  ],
  department: [
    { label: "研发部", value: "d_1" },
    { label: "销售部", value: "d_2" },
    { label: "财务部", value: "d_3" }
  ]
};

const PLACEHOLDERS: Record<PrincipalKind, string> = {
  user: "选择用户",
  role: "选择角色",
  department: "选择部门"
};

function createMockPicker(kind: PrincipalKind): FC<PickerProps> {
  return function MockPicker({
    disabled,
    value,
    onChange
  }) {
    return (
      <Select
        allowClear
        disabled={disabled}
        mode="multiple"
        options={MOCK_OPTIONS[kind]}
        placeholder={PLACEHOLDERS[kind]}
        style={{ width: "100%" }}
        value={value}
        onChange={onChange}
      />
    );
  };
}

/**
 * Mock user / role / department pickers for the playground. A real host
 * supplies its own components satisfying `PickerProps`, resolving against its
 * organization structure.
 */
const APPROVAL_PLUGINS: ApprovalPlugins = {
  pickers: {
    user: createMockPicker("user"),
    role: createMockPicker("role"),
    department: createMockPicker("department")
  }
};

export const Route = createFileRoute("/_layout/approval")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return (
    <ApprovalProvider plugins={APPROVAL_PLUGINS}>
      <Outlet />
    </ApprovalProvider>
  );
}
