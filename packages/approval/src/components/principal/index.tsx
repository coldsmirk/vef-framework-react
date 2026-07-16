import type { PrincipalKind } from "@vef-framework-react/approval-flow-editor";

import { Select } from "@vef-framework-react/components";

import { useApprovalPlugins } from "../../plugins";

const FALLBACK_PLACEHOLDERS: Record<PrincipalKind, string> = {
  user: "输入用户 ID，回车添加",
  role: "输入角色 ID，回车添加",
  department: "输入部门 ID，回车添加"
};

export interface PrincipalSelectProps {
  kind: PrincipalKind;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /**
   * Cap the selection at this many entries (enforced on change).
   */
  maxCount?: number;
}

/**
 * A principal (user / role / department) selection field: renders the host's
 * picker from `ApprovalProvider` when one is wired for the kind, else
 * degrades to a plain id-tags input so the surrounding dialog stays
 * functional.
 */
export function PrincipalSelect({
  kind,
  value,
  onChange,
  disabled,
  maxCount
}: PrincipalSelectProps) {
  const { pickers } = useApprovalPlugins();
  const Picker = pickers?.[kind];

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
      placeholder={FALLBACK_PLACEHOLDERS[kind]}
      style={{ width: "100%" }}
      value={value}
      onChange={handleChange}
    />
  );
}
