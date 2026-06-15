import { css } from "@emotion/react";
import { globalCssVars, Radio } from "@vef-framework-react/components";

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

            {permissions.map(permission => (
              <td key={permission.value}>
                <Radio
                  aria-label={`${field.label}：${permission.label}`}
                  checked={(value[field.key] ?? permissions[0]?.value) === permission.value}
                  disabled={disabled}
                  onChange={() => handleChange(field.key, permission.value)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
