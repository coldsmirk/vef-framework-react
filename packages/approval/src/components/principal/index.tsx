import type { SelectionMode } from "@vef-framework-react/approval-flow-editor";

import { Select } from "@vef-framework-react/components";

import { useApprovalPlugins } from "../../plugins";

const FALLBACK_PLACEHOLDERS: Record<string, string> = {
  user: "输入用户 ID，回车添加",
  role: "输入角色 ID，回车添加",
  department: "输入部门 ID，回车添加"
};

export interface PrincipalSelectProps {
  /**
   * The rule's kind — the first key the picker registry is looked up by.
   */
  kind: string;
  /**
   * What the kind selects — the fallback registry key, so a host kind picking
   * roles reuses the `role` picker. Omitted for the callers that name a
   * built-in slot directly.
   */
  selection?: SelectionMode;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /**
   * Cap the selection at this many entries (enforced on change).
   */
  maxCount?: number;
}

/**
 * A principal selection field: renders the host's picker from
 * `ApprovalProvider` when one is wired for the kind (or for what the kind
 * selects), else degrades to a plain id-tags input so the surrounding dialog
 * stays functional.
 */
export function PrincipalSelect({
  kind,
  selection,
  value,
  onChange,
  disabled,
  maxCount
}: PrincipalSelectProps) {
  const { pickers } = useApprovalPlugins();
  const Picker = pickers?.[kind] ?? (selection ? pickers?.[selection] : undefined);

  const handleChange = (ids: string[]): void => {
    onChange(maxCount === undefined ? ids : ids.slice(0, maxCount));
  };

  if (Picker) {
    return <Picker disabled={disabled} value={value} onChange={handleChange} />;
  }

  return (
    <Select<string[]>
      allowClear
      disabled={disabled}
      mode="tags"
      open={false}
      placeholder={FALLBACK_PLACEHOLDERS[kind] ?? (selection ? FALLBACK_PLACEHOLDERS[selection] : undefined) ?? "输入 ID，回车添加"}
      style={{ width: "100%" }}
      value={value}
      onChange={handleChange}
    />
  );
}
