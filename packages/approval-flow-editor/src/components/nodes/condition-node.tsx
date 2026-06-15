import type { NodeProps } from "@xyflow/react";

import type { ConditionBranchDefinition, ConditionNode as ConditionNodeType } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";

import { BaseNode } from "./base-node";

const branchDividerStyle = css({
  height: 1,
  background: globalCssVars.colorBorderSecondary
});

const branchStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "7px 14px",
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextSecondary,
  position: "relative",

  "&:not(:last-child)": {
    borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
  }
});

const branchLabelStyle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const branchDefaultBadgeStyle = css({
  fontSize: 10,
  color: globalCssVars.colorTextQuaternary,
  flexShrink: 0,
  marginLeft: 6
});

// Render exactly what the data holds — no fallback branches. Phantom handles
// rendered from a fallback would accept connections whose sourceHandle does not
// exist in the data, silently corrupting the definition. New condition nodes
// always carry branches (DEFAULT_NODE_DATA); a loaded definition without them
// renders branch-less and fails validation loudly.
const EMPTY_BRANCHES: ConditionBranchDefinition[] = [];

export const ConditionNode = memo(({
  id,
  data,
  selected
}: NodeProps<ConditionNodeType>) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const branches = data.branches ?? EMPTY_BRANCHES;
  // The handle set is defined by the branch ids and their order — immer
  // produces a fresh `branches` array on every label keystroke, but handles
  // only appear/disappear/move when this key changes. Geometry-only changes
  // (e.g. a label wrapping to a second line) are covered by the
  // ResizeObserver effect below.
  const branchIds = branches.map(branch => branch.id).join("|");

  // Re-measure handles when the branch handle set changes (handles are added/removed)
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        updateNodeInternals(id);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [branchIds, id, updateNodeInternals]);

  // Re-measure handles when the node resizes (e.g. label wrapping)
  useEffect(() => {
    const root = rootRef.current;

    if (!root || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateNodeInternals(id);
    });
    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, [id, updateNodeInternals]);

  return (
    <BaseNode
      ref={rootRef}
      description={data.description}
      label={data.name ?? "条件节点"}
      selected={selected}
      type="condition"
    >
      <Handle position={Position.Left} type="target" />
      {branches.length > 0 && <div css={branchDividerStyle} />}

      {branches.map(branch => (
        <div key={branch.id} css={branchStyle}>
          <span css={branchLabelStyle}>{branch.label}</span>
          {branch.isDefault && <span css={branchDefaultBadgeStyle}>默认</span>}
          <Handle id={branch.id} position={Position.Right} type="source" />
        </div>
      ))}
    </BaseNode>
  );
});

ConditionNode.displayName = "ConditionNode";
