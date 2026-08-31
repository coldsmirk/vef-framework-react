import type { FC, ReactNode } from "react";

import type { SelectionMode } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { useEditorPlugins } from "../../plugins";

/**
 * Hint wording for the three built-in picker slots, used when the caller names
 * no label of its own (the transfer-target pickers, which select users
 * directly rather than through a rule row).
 */
const PRINCIPAL_KIND_LABELS: Record<string, string> = {
  user: "用户",
  role: "角色",
  department: "部门"
};

const placeholderStyle = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextQuaternary,
  paddingBlock: globalCssVars.spacingXs
});

interface PrincipalPickerProps {
  /**
   * The rule's kind — the first key the picker registry is looked up by.
   */
  kind: string;
  /**
   * What the kind selects — the second key the registry is looked up by.
   * Omitted for a caller that already names a built-in picker slot directly.
   */
  selection?: SelectionMode;
  /**
   * Shown in the "no plugin" hint so it names the thing that cannot be picked.
   */
  label?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /**
   * Rendered instead of the "no plugin" hint when the host wired no picker for
   * this kind. For a list that selects principals the hint is the whole answer
   * — there is nothing else to offer — but where the value has another way in
   * (a condition on a built-in applicant subject falls back to free text), the
   * hint would leave the control unusable, so that caller passes its own.
   */
  fallback?: ReactNode;
}

/**
 * Renders the host-provided picker for one rule, or an inline hint when the
 * host did not supply one. The single source of truth for picker lookup and
 * graceful degradation — every list that selects principals goes through here
 * instead of rebuilding the map.
 *
 * Lookup is by kind first, then by selection mode. That is what lets the three
 * built-in pickers serve host kinds too: a kind that selects roles reuses the
 * `role` picker automatically, while a `custom` kind is expected to register a
 * picker under its own name.
 */
export const PrincipalPicker: FC<PrincipalPickerProps> = ({
  kind,
  selection,
  label,
  value,
  onChange,
  disabled,
  fallback
}) => {
  const { pickers } = useEditorPlugins();
  const Picker = pickers?.[kind] ?? (selection ? pickers?.[selection] : undefined);

  if (!Picker) {
    const name = label ?? PRINCIPAL_KIND_LABELS[kind] ?? kind;

    return fallback ?? <div css={placeholderStyle}>{`未提供${name}选择器插件`}</div>;
  }

  return <Picker disabled={disabled} value={value} onChange={onChange} />;
};
