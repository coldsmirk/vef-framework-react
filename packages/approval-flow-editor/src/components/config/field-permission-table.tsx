import { css } from "@emotion/react";
import { globalCssVars, Radio, Tooltip } from "@vef-framework-react/components";
import { TriangleAlertIcon } from "lucide-react";

import { useEditorPlugins } from "../../plugins";

const tableStyle = css({
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,

  "th, td": {
    padding: "8px 6px",
    textAlign: "center",
    borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
  },

  th: {
    fontWeight: 600,
    color: globalCssVars.colorTextSecondary,
    fontSize: 12,
    background: globalCssVars.colorFillQuaternary
  },

  "td:first-of-type": {
    textAlign: "left",
    fontWeight: 500
  }
});

const emptyStyle = css({
  fontSize: 13,
  color: globalCssVars.colorTextQuaternary,
  padding: "8px 0"
});

const permissionCellStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 4
});

const warningIconStyle = css({
  display: "inline-flex",
  color: globalCssVars.colorWarningText,
  cursor: "help"
});

interface FieldPermissionTableProps<T extends string = string> {
  permissions: Array<{ label: string; value: T }>;
  value: Record<string, T>;
  onChange: (value: Record<string, T>) => void;
  disabled?: boolean;
}

export function FieldPermissionTable<T extends string>({
  permissions,
  value,
  onChange,
  disabled
}: FieldPermissionTableProps<T>) {
  const plugins = useEditorPlugins();
  const { formFields } = plugins;

  if (!formFields || formFields.length === 0) {
    return <div css={emptyStyle}>请先配置表单字段</div>;
  }

  const handleChange = (fieldKey: string, permission: T) => {
    onChange({ ...value, [fieldKey]: permission });
  };

  return (
    <table css={tableStyle}>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>字段</th>
          {permissions.map(p => <th key={p.value}>{p.label}</th>)}
        </tr>
      </thead>

      <tbody>
        {formFields.map(field => (
          <tr key={field.key}>
            <td>{field.label}</td>

            {permissions.map(permission => {
              const isChecked = (value[field.key] ?? permissions[0]?.value) === permission.value;
              // Deadlock hint: a linkage-hideable field set to `required` can be
              // hidden at approval time, and the backend's linkage-blind
              // required check would then reject the approve forever. Non-
              // blocking (the combination is legitimate when the approver can
              // edit the controlling field), so it stays a per-row tooltip and
              // never enters validateFlowDefinition's publish gate.
              const warnRequiredHidden = permission.value === "required" && isChecked && field.hasConditionalVisibility === true;

              return (
                <td key={permission.value}>
                  <span css={permissionCellStyle}>
                    <Radio
                      aria-label={`${field.label}：${permission.label}`}
                      checked={isChecked}
                      disabled={disabled}
                      onChange={() => handleChange(field.key, permission.value)}
                    />

                    {warnRequiredHidden && (
                      <Tooltip title={`字段「${field.label}」存在联动隐藏规则，设为必填后若在审批时被隐藏将无法通过审批`}>
                        <span aria-label="必填与联动隐藏冲突提示" css={warningIconStyle} role="img">
                          <TriangleAlertIcon size={14} />
                        </span>
                      </Tooltip>
                    )}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
