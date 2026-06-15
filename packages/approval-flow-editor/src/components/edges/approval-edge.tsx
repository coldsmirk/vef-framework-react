import type { EdgeProps } from "@xyflow/react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { XIcon } from "lucide-react";
import { memo } from "react";

import { useEditorStore } from "../../store";

const deleteButtonStyle = css({
  width: 18,
  height: 18,
  padding: 0,
  borderRadius: "50%",
  background: globalCssVars.colorError,
  color: globalCssVars.colorWhite,
  border: `1px solid ${globalCssVars.colorBgContainer}`,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: 0,
  pointerEvents: "none",
  transition: `opacity ${globalCssVars.motionDurationMid}`,

  "&[data-visible]": {
    opacity: 1,
    pointerEvents: "all"
  }
});

const edgeLabelStyle = css({
  position: "absolute",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transform: "translate(-50%, -50%)",
  zIndex: 1000
});

export const ApprovalEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd
}: EdgeProps) => {
  const readonly = useEditorStore(s => s.readonly);
  const isHovered = useEditorStore(s => s.hoveredEdgeId === id);
  const removeEdge = useEditorStore(s => s.removeEdge);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  });

  return (
    <>
      <BaseEdge markerEnd={markerEnd} path={edgePath} style={style} />

      {!readonly && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            css={edgeLabelStyle}
            style={{ left: labelX, top: labelY }}
          >
            <button
              aria-label="删除连线"
              css={deleteButtonStyle}
              data-visible={isHovered || undefined}
              title="删除连线"
              type="button"
              onClick={() => removeEdge(id)}
            >
              <XIcon size={10} strokeWidth={2.5} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ApprovalEdge.displayName = "ApprovalEdge";
