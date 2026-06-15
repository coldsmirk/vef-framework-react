import type { FC } from "react";

import type { FlowValidationError } from "../shared/flow-validation";
import type { FlowNode } from "../types";

import { css, keyframes } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { useReactFlow } from "@xyflow/react";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getSpecification } from "../specifications";
import { useEditorStore } from "../store";

const EMPTY_NODES: FlowNode[] = [];

const fadeIn = keyframes({
  from: { opacity: 0, transform: "translateY(-4px)" },
  to: { opacity: 1, transform: "translateY(0)" }
});

const wrapperStyle = css({
  position: "relative",
  display: "flex"
});

const triggerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 8px",
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: globalCssVars.colorErrorText,
  transition: `background-color ${globalCssVars.motionDurationMid}`,

  "&:hover": {
    background: globalCssVars.colorErrorBg
  }
});

const dropdownStyle = css({
  position: "absolute",
  top: "calc(100% + 10px)",
  left: 0,
  width: 320,
  maxHeight: 360,
  overflowY: "auto",
  padding: 4,
  background: globalCssVars.colorBgContainer,
  borderRadius: globalCssVars.borderRadiusLg,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  boxShadow: `0 6px 20px ${globalCssVars.colorFillContent}`,
  zIndex: 10,
  animation: `${fadeIn} ${globalCssVars.motionDurationMid} ease-out`
});

const itemStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 2,
  width: "100%",
  padding: "6px 8px",
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  textAlign: "left",
  fontSize: globalCssVars.fontSizeSm,
  transition: `background ${globalCssVars.motionDurationMid}`,

  "&:enabled": {
    cursor: "pointer"
  },

  "&:enabled:hover": {
    background: globalCssVars.colorFillQuaternary
  }
});

const itemMessageStyle = css({
  color: globalCssVars.colorText,
  lineHeight: 1.5
});

const itemScopeStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 4,
  color: globalCssVars.colorTextTertiary
});

const scopeDotStyle = css({
  width: 6,
  height: 6,
  borderRadius: "50%",
  flexShrink: 0
});

/**
 * Resolve the human label for an issue's scope: the offending node's name
 * (falling back to its kind label), or "流程" for graph-level problems.
 */
function describeScope(issue: FlowValidationError, nodes: FlowNode[]): { label: string; color: string } {
  if (!issue.nodeId) {
    return { label: "流程", color: globalCssVars.colorTextQuaternary };
  }

  const node = nodes.find(n => n.id === issue.nodeId);

  if (!node) {
    return { label: issue.nodeId, color: globalCssVars.colorTextQuaternary };
  }

  const spec = getSpecification(node.type);

  return { label: node.data.name?.trim() || spec.label, color: spec.color };
}

/**
 * Toolbar entry for live deploy-contract validation: shows the issue count and
 * opens a list where each node-scoped problem clicks through to its node
 * (selects it and pans the viewport there). Renders nothing while the flow is
 * deploy-ready, so a clean canvas stays clean.
 */
export const ValidationIndicator: FC = () => {
  const issues = useEditorStore(s => s.validationIssues);
  const selectNode = useEditorStore(s => s.selectNode);
  const { fitView } = useReactFlow();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Node names are only needed while the list is open; an inactive indicator
  // must not re-render on every graph edit.
  const nodes = useEditorStore(s => open ? s.nodes : EMPTY_NODES);

  // Close on outside click or Escape — same interaction contract as the zoom
  // preset dropdown.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !(event.target instanceof Node && wrapperRef.current.contains(event.target))) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (issues.length === 0) {
    return null;
  }

  const locateIssue = (issue: FlowValidationError) => {
    if (!issue.nodeId) {
      return;
    }

    selectNode(issue.nodeId);
    void fitView({
      nodes: [{ id: issue.nodeId }],
      duration: 300,
      padding: 0.4,
      maxZoom: 1.2
    });
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} css={wrapperStyle}>
      <button
        aria-expanded={open}
        aria-label={`${issues.length} 个配置问题`}
        css={triggerStyle}
        type="button"
        onClick={() => setOpen(prev => !prev)}
      >
        <TriangleAlertIcon size={15} />
        {issues.length}
      </button>

      {open && (
        <div css={dropdownStyle}>
          {/* Issues carry no stable identity; index keys are safe for this
              render-only snapshot list. */}
          {issues.map((issue, index) => {
            const scope = describeScope(issue, nodes);

            return (
              <button
                key={index}
                css={itemStyle}
                disabled={!issue.nodeId}
                type="button"
                onClick={() => locateIssue(issue)}
              >
                <span css={itemMessageStyle}>{issue.message}</span>

                <span css={itemScopeStyle}>
                  <span css={scopeDotStyle} style={{ background: scope.color }} />
                  {scope.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
