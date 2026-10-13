import type { DataSourceApi, DataSourceResolver, ResolvedDataSourceRequest } from "@vef-framework-react/form-editor";

import { API_PATH, apiClient, createApiRequest } from "~api";

/**
 * The option APIs the playground offers its form designers — every one served
 * by {@link formDataSourceResolver}, which is what makes a pick resolve at
 * runtime as well as in the designer's preview.
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
  }
];

const fetchFormOptionRows = apiClient.createQueryFn(
  "fetch_form_option_rows",
  ({ post }) => async (request: ResolvedDataSourceRequest) => {
    const result = await post<Array<Record<string, unknown>>>(
      API_PATH,
      { data: createApiRequest(request.resource, request.action, request.version ?? "v1", request.params ?? {}) }
    );

    return result.data;
  }
);

/**
 * Resolves a form's remote option source through the playground's RPC client.
 * Bound parameters arrive already evaluated, so this only fetches and maps
 * each row by the source's mapping (blank keys never reach it — the form
 * runtime normalizes the mapping first).
 */
export const formDataSourceResolver: DataSourceResolver = {
  async resolve(request, mapping) {
    const rows = await apiClient.fetchQuery({
      queryKey: [fetchFormOptionRows.key, request] as const,
      queryFn: fetchFormOptionRows
    });

    return rows.map(row => {
      return {
        label: String(row[mapping?.labelKey ?? "label"] ?? ""),
        value: row[mapping?.valueKey ?? "value"] as string | number
      };
    });
  }
};
