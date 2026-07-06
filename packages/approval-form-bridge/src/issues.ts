/**
 * Diagnostic code raised by the schema→approval projection. Error-severity
 * codes are contract-breaking (the Go deploy or runtime validation would
 * reject the result); warning-severity codes flag fidelity loss the host
 * should surface but may accept.
 */
export type ProjectionIssueCode
  = | "unmappable_field_type"
    | "unknown_field_type_unprojectable"
    | "nested_subform_unsupported"
    | "table_columns_empty"
    | "options_not_static"
    | "linkage_not_projected"
    | "cross_device_kind_mismatch";

/**
 * One projection diagnostic. Structurally aligned with form-editor's
 * `ValidationIssue` (`path` / `code` / `severity` / `message`) so hosts can
 * render both kinds through one list, but the code namespace is the bridge's
 * own — form-editor's `ValidationIssueCode` is a closed union.
 *
 * `path` is the field-key chain: `"amount"` for a top-level field,
 * `"items.price"` for a detail-table column.
 */
export interface ProjectionIssue {
  path: string;
  code: ProjectionIssueCode;
  severity: "error" | "warning";
  message: string;
}

export function issueUnmappableFieldType(path: string, type: string): ProjectionIssue {
  return {
    path,
    code: "unmappable_field_type",
    severity: "error",
    message: `字段 "${path}" 的控件类型 "${type}" 无法映射到审批表单契约(值形状与服务端校验不兼容)`
  };
}

export function issueUnknownFieldType(path: string, type: string): ProjectionIssue {
  return {
    path,
    code: "unknown_field_type_unprojectable",
    severity: "error",
    message: `字段 "${path}" 的控件类型 "${type}" 未注册,无法投影(审批表单数据是封闭契约,未投影的字段会导致提交被拒)`
  };
}

export function issueNestedSubform(path: string): ProjectionIssue {
  return {
    path,
    code: "nested_subform_unsupported",
    severity: "error",
    message: `明细表模板中嵌套了子表 "${path}",审批明细表仅支持单级`
  };
}

export function issueTableColumnsEmpty(path: string): ProjectionIssue {
  return {
    path,
    code: "table_columns_empty",
    severity: "error",
    message: `明细表 "${path}" 没有可投影的列`
  };
}

export function issueOptionsNotStatic(path: string): ProjectionIssue {
  return {
    path,
    code: "options_not_static",
    severity: "warning",
    message: `字段 "${path}" 的选项来源无法静态解析,投影结果不含选项(服务端将放行任意选项值)`
  };
}

export function issueLinkageNotProjected(path: string): ProjectionIssue {
  return {
    path,
    code: "linkage_not_projected",
    severity: "warning",
    message: `字段 "${path}" 配置了联动规则,审批服务端不理解联动(被联动隐藏的字段不提交值,可能与必填校验冲突)`
  };
}

export function issueCrossDeviceKindMismatch(path: string, pcKind: string, mobileKind: string): ProjectionIssue {
  return {
    path,
    code: "cross_device_kind_mismatch",
    severity: "warning",
    message: `字段 "${path}" 在 PC 与移动端映射到不同的类型("${pcKind}" / "${mobileKind}"),投影以 PC 为准`
  };
}
