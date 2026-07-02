import type { FC } from "react";

import type { NodeKind } from "../types";

import { css, keyframes } from "@emotion/react";
import { globalCssVars, Tooltip } from "@vef-framework-react/components";
import { useReactFlow, useStore } from "@xyflow/react";
import { LayoutDashboard, Loader, Redo2, Undo2 } from "lucide-react";

import { NODE_DIMENSIONS } from "../constants";
import { useAutoLayout } from "../hooks/use-auto-layout";
import { handleDragStart } from "../hooks/use-drag-drop";
import { findFreePosition } from "../shared/node-placement";
import { getAddableSpecifications } from "../specifications";
import { useApprovalActions, useEditorStore, useEditorStoreApi } from "../store";
import { toolbarContainerStyle } from "../styles";
import { ValidationIndicator } from "./validation-indicator";

const toolbarItemStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: 6,
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "grab",
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorText,
  userSelect: "none",
  transition: `background-color ${globalCssVars.motionDurationMid}`,
  "&:hover": {
    background: globalCssVars.colorFillQuaternary
  },
  "&:active": {
    cursor: "grabbing"
  }
});

const dividerStyle = css({
  width: 1,
  alignSelf: "stretch",
  margin: "4px 2px",
  background: globalCssVars.colorBorderSecondary
});

const actionButtonStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 6,
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: globalCssVars.colorTextSecondary,
  transition: `background-color ${globalCssVars.motionDurationMid}, color ${globalCssVars.motionDurationMid}`,
  "&:hover:not(:disabled)": {
    background: globalCssVars.colorFillQuaternary,
    color: globalCssVars.colorText
  },
  "&:disabled": {
    cursor: "not-allowed",
    opacity: 0.5
  }
});

const spin = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" }
});

const spinnerStyle = css({
  animation: `${spin} 1s linear infinite`
});

// Passive status text, not a control: no fill or border, quiet tertiary
// color, so the counts read as ambient information at the toolbar's end
// rather than another button.
const graphStatsStyle = css({
  display: "flex",
  alignItems: "center",
  padding: "0 6px",
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  whiteSpace: "nowrap",
  userSelect: "none",
  fontVariantNumeric: "tabular-nums"
});

// Specifications are static — compute once at module level
const specs = getAddableSpecifications();

export const EditorToolbar: FC = () => {
  const { runLayout, isLayouting } = useAutoLayout();
  const { screenToFlowPosition } = useReactFlow();
  const domNode = useStore(s => s.domNode);
  const storeApi = useEditorStoreApi();
  const { addNode } = useApprovalActions();
  const undo = useEditorStore(s => s.undo);
  const redo = useEditorStore(s => s.redo);
  // Reactive availability flags — the engine derives them, so the buttons
  // re-render only when availability flips, not on every history push.
  const canUndo = useEditorStore(s => s.canUndo);
  const canRedo = useEditorStore(s => s.canRedo);
  // Length-only selectors: the counts re-render the toolbar on add/remove,
  // never on drag/position churn.
  const nodeCount = useEditorStore(s => s.nodes.length);
  const edgeCount = useEditorStore(s => s.edges.length);

  // Click-to-add drops the node at the viewport center (drag remains the
  // precise-placement path) and opens its config panel right away, so the
  // toolbar works without drag-and-drop — keyboard and touch included.
  const addAtViewportCenter = (type: NodeKind) => {
    const rect = domNode?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const center = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    const position = findFreePosition(
      {
        x: center.x - NODE_DIMENSIONS.width / 2,
        y: center.y - NODE_DIMENSIONS.height / 2
      },
      storeApi.getState().nodes
    );
    // The engine's addNode selects what it appends, so the config panel opens right away.
    addNode(type, position);
  };

  return (
    <div css={toolbarContainerStyle}>
      {specs.map(spec => {
        const Icon = spec.icon;
        return (
          <Tooltip key={spec.type} title="点击添加，或拖拽到画布">
            <button
              draggable
              css={toolbarItemStyle}
              type="button"
              onClick={() => addAtViewportCenter(spec.type)}
              onDragStart={event => handleDragStart(event, spec.type)}
            >
              <Icon size={16} style={{ color: spec.color }} />
              <span>{spec.label}</span>
            </button>
          </Tooltip>
        );
      })}

      <div css={dividerStyle} />

      <Tooltip title="撤销 (Ctrl/⌘+Z)">
        <button
          aria-label="撤销"
          css={actionButtonStyle}
          disabled={!canUndo}
          type="button"
          onClick={undo}
        >
          <Undo2 size={16} />
        </button>
      </Tooltip>

      <Tooltip title="重做 (Ctrl/⌘+Shift+Z)">
        <button
          aria-label="重做"
          css={actionButtonStyle}
          disabled={!canRedo}
          type="button"
          onClick={redo}
        >
          <Redo2 size={16} />
        </button>
      </Tooltip>

      <Tooltip title="自动布局">
        <button
          aria-label="自动布局"
          css={actionButtonStyle}
          disabled={isLayouting}
          type="button"
          onClick={runLayout}
        >
          {isLayouting
            ? <Loader css={spinnerStyle} size={16} />
            : <LayoutDashboard size={16} />}
        </button>
      </Tooltip>

      <ValidationIndicator />
      <div css={dividerStyle} />

      <Tooltip title={`${nodeCount} 个节点，${edgeCount} 条连线`}>
        <span css={graphStatsStyle}>
          {nodeCount}
          {" 节点 · "}
          {edgeCount}
          {" 连线"}
        </span>
      </Tooltip>
    </div>
  );
};
