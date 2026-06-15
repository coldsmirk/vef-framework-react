import type { FC } from "react";

import type { PrincipalKind } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { useEditorPlugins } from "../../plugins";

const PRINCIPAL_KIND_LABELS: Record<PrincipalKind, string> = {
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
  kind: PrincipalKind;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Renders the host-provided picker for a principal kind (user / role /
 * department), or an inline hint when the host did not supply one. The single
 * source of truth for picker lookup and graceful degradation — every list that
 * selects principals goes through here instead of rebuilding the map.
 */
export const PrincipalPicker: FC<PrincipalPickerProps> = ({
  kind,
  value,
  onChange,
  disabled
}) => {
  const { pickers } = useEditorPlugins();
  const Picker = pickers?.[kind];

  if (!Picker) {
    return <div css={placeholderStyle}>{`未提供${PRINCIPAL_KIND_LABELS[kind]}选择器插件`}</div>;
  }

  return <Picker disabled={disabled} value={value} onChange={onChange} />;
};
