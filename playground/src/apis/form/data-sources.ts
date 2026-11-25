import type { DataSourceApi, FormServices } from "@vef-framework-react/form-editor";

import { HTTP_CLIENT } from "@vef-framework-react/core";
import { API_PATH, apiClient, createApiRequest } from "~api";

/**
 * The option / lookup APIs the playground offers its form designers — every one
 * served by {@link formServices}, which is what makes a pick resolve at runtime
 * as well as in the designer's preview.
 */
export const FORM_DATA_SOURCE_APIS: DataSourceApi[] = [
  {
    label: "用户列表",
    description: "系统用户，按姓名显示",
    group: "系统",
    resource: "sys/user",
    action: "find_options"
  },
  {
    label: "角色列表",
    group: "系统",
    resource: "sys/role",
    action: "find_options"
  },
  {
    label: "职员列表",
    description: "主数据职员，可按关键字过滤",
    group: "主数据",
    resource: "md/staff",
    action: "find_options",
    params: [
      {
        name: "keyword",
        label: "关键字",
        description: "匹配工号、姓名、电话或邮箱"
      }
    ]
  },
  {
    label: "职员查询",
    description: "按工号、姓名、电话或邮箱查询职员明细记录（输入 ERROR 可模拟失败）",
    group: "主数据",
    resource: "md/staff",
    action: "lookup",
    params: [
      {
        name: "keyword",
        label: "关键字",
        required: true,
        description: "支持精确工号（如 S010001）或前缀模糊查询（如 S0100）"
      }
    ],
    fields: [
      { path: "number", label: "工号" },
      { path: "name", label: "姓名" },
      { path: "gender", label: "性别" },
      { path: "genderName", label: "性别名称" },
      { path: "phoneNumber", label: "手机号" },
      { path: "email", label: "邮箱" },
      { path: "birthDate", label: "出生日期" },
      { path: "status", label: "在职状态" },
      { path: "statusName", label: "状态名称" }
    ]
  }
];

/**
 * Unified runtime services for playground forms (remote option sources and
 * `api_call` effect actions), forwarding the `AbortSignal` to cancel stale or
 * superseded requests directly at the HTTP transport layer.
 */
export const formServices: FormServices = {
  async request(request, { signal }) {
    const result = await apiClient[HTTP_CLIENT].post<unknown>(
      API_PATH,
      {
        data: createApiRequest(request.resource, request.action, request.version ?? "v1", request.params ?? {}),
        signal
      }
    );

    return result.data;
  }
};
