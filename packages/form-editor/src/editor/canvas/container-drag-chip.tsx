import type { ReactElement } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { currentLayer } from "../../engine/schema/presentation";
import { findNode, isContainerNode, nodeDefinition, nodeDisplayName } from "../../engine/schema/walk";
import { EditorIcon } from "../../icons";
import { useFieldRegistry } from "../../store/engine-provider";
import { useFormEditorStore } from "../../store/form-store";

// A compact floating pill: icon + label, elevated so it reads as picked-up.
// It replaces the default lift of a container's whole nested subtree, which
// would occlude the drop zones the designer is aiming at. `pointer-events:none`
// because it is a drag ghost the overlay positions under the cursor.
const chipCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  maxWidth: 240,
  padding: "6px 12px",
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgElevated,
  border: `1px solid ${globalCssVars.colorPrimaryBorder}`,
  boxShadow: globalCssVars.shadowLg,
  color: globalCssVars.colorText,
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  lineHeight: 1.4,
  cursor: "grabbing",
  pointerEvents: "none",
  userSelect: "none"
});

const iconCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: 6,
  flexShrink: 0,
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextSecondary,

  "& > svg": {
    width: 16,
    height: 16
  }
});

const iconImgCss = css({
  width: 16,
  height: 16,
  objectFit: "contain"
});

const labelCss = css({
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis"
});

/**
 * The drag ghost for a container move: a compact icon + label chip. Resolves the
 * container by id from the active device's layer and names it as the rest of
 * the designer does ({@link nodeDisplayName}), with its registry definition's
 * icon (a fixed-row subform takes the 矩阵表格 preset's). Renders nothing if the
 * id no longer resolves to a container (a torn-down drag), so the overlay stays
 * empty rather than throwing.
 */
export function ContainerDragChip({ nodeId }: { nodeId: string }): ReactElement | null {
  const node = useFormEditorStore(s => findNode(currentLayer(s.schema, s.device), nodeId));
  const registry = useFieldRegistry();

  if (node === undefined || !isContainerNode(node)) {
    return null;
  }

  const definition = nodeDefinition(node, registry);
  const label = nodeDisplayName(node, registry);

  return (
    <div css={chipCss}>
      <span css={iconCss}>
        {definition?.config.iconUrl
          ? <img alt="" css={iconImgCss} src={definition.config.iconUrl} />
          : <EditorIcon name={definition?.config.icon ?? "square"} />}
      </span>

      <span css={labelCss}>{label}</span>
    </div>
  );
}
