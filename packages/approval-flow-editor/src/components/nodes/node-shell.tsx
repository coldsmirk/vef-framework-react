import type { CSSProperties, ReactNode, RefObject } from "react";

import type { NodeKind } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { useNodeId } from "@xyflow/react";

import { getSpecification } from "../../specifications";
import { useEditorUiStore } from "../../store";
import { nodeContainerStyle } from "../../styles";

interface NodeShellProps {
  type: NodeKind;
  selected?: boolean;
  children: ReactNode;
}

/**
 * CSSProperties extended to allow the node's accent CSS custom properties.
 * React's CSSProperties has no index signature, so custom `--*` keys need an
 * explicit type rather than an `as` assertion.
 */
type NodeAccentStyle = CSSProperties & Record<`--vef-node-accent-${string}`, string>;

const issueBadgeStyle = css({
  position: "absolute",
  top: -8,
  right: -8,
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  borderRadius: 999,
  background: globalCssVars.colorError,
  color: globalCssVars.colorWhite,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: "14px",
  textAlign: "center",
  border: `2px solid ${globalCssVars.colorBgContainer}`,
  zIndex: 25,
  pointerEvents: "none"
});

/**
 * Shared node container — provides selection ring and accent color CSS variables
 */
export function NodeShell({
  ref,
  type,
  selected,
  children
}: NodeShellProps & { ref?: RefObject<HTMLDivElement | null> }) {
  const spec = getSpecification(type);
  const readonly = useEditorUiStore(s => s.readonly);
  const nodeId = useNodeId();
  // Subscribe only to this node's own issue count — a problem on another node
  // must not re-render this one.
  const issueCount = useEditorUiStore(s => (nodeId ? s.nodeIssueCounts[nodeId] : undefined) ?? 0);
  const invalid = issueCount > 0;

  // A node with validation problems swaps its accent to the error tokens, so
  // the standing border, the selection ring and the badge all read as "broken"
  // while the kind identity stays on the icon badge.
  const color = invalid ? globalCssVars.colorError : spec.color;

  // Derive the translucent glow with color-mix rather than appending a hex alpha
  // suffix: the accent color may be a CSS variable reference (e.g. approval's
  // globalCssVars.colorPrimary -> "var(--vef-color-primary)") and `${varRef}20`
  // is invalid CSS, which would silently drop the selection glow. The accent
  // badge tint lives in AccentIconBadge, which derives its own color-mix.
  const accentStyle: NodeAccentStyle = {
    "--vef-node-accent-color": color,
    "--vef-node-accent-glow": `color-mix(in srgb, ${color} 13%, transparent)`
  };

  return (
    <div
      ref={ref}
      css={nodeContainerStyle}
      data-invalid={invalid || undefined}
      data-readonly={readonly || undefined}
      data-selected={selected || undefined}
      style={accentStyle}
    >
      {children}

      {invalid && (
        <span css={issueBadgeStyle} title={`${issueCount} 个配置问题`}>
          {issueCount}
        </span>
      )}
    </div>
  );
}
