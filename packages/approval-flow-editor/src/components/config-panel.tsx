import type { Transition, Variants } from "@vef-framework-react/core";
import type { FC } from "react";

import { globalCssVars, ScrollArea } from "@vef-framework-react/components";
import { AnimatePresence, motion } from "@vef-framework-react/core";
import { Trash2Icon } from "lucide-react";

import { isNodeKind } from "../constants";
import { XIcon } from "../icons";
import { getSpecification } from "../specifications";
import { anyNodeConfig, useApprovalActions, useEditorStore, useEditorUiStore } from "../store";
import {
  configPanelBodyStyle,
  configPanelCloseStyle,
  configPanelDeleteStyle,
  configPanelHeaderStyle,
  configPanelKindChipStyle,
  configPanelTitleStyle,
  configPanelWrapperStyle
} from "../styles";
import { AccentIconBadge } from "./accent-icon-badge";
import { BasicNodeConfig } from "./config/basic-node-config";

// Panel slide-in/out animation
const panelVariants: Variants = {
  hidden: { x: "110%", opacity: 0 },
  visible: { x: 0, opacity: 1 }
};

const panelTransition: Transition = {
  duration: 0.28,
  ease: [0.4, 0, 0.2, 1]
};

export const ConfigPanel: FC = () => {
  const selectedNodeId = useEditorStore(s => s.selectedNodeId);
  // Subscribe to the primitives the header needs instead of the node object:
  // dragging the selected node changes its object identity every frame, but
  // type / name / deletable stay stable, so the panel does not re-render.
  const nodeKind = useEditorStore(s => {
    const kind = s.selectedNodeId ? s.nodes.find(n => n.id === s.selectedNodeId)?.data.kind : undefined;
    return kind !== undefined && isNodeKind(kind) ? kind : undefined;
  });
  const nodeName = useEditorStore(s => s.selectedNodeId ? anyNodeConfig(s.nodes.find(n => n.id === s.selectedNodeId))?.name : undefined);
  const deletable = useEditorStore(s => s.selectedNodeId ? s.nodes.find(n => n.id === s.selectedNodeId)?.deletable !== false : false);
  const readonly = useEditorUiStore(s => s.readonly);
  const selectNode = useEditorStore(s => s.selectNode);
  const { removeNode } = useApprovalActions();

  const isVisible = !!selectedNodeId && !!nodeKind;
  const spec = nodeKind ? getSpecification(nodeKind) : undefined;
  const color = spec?.color ?? globalCssVars.colorPrimary;
  const Icon = spec?.icon;
  const ConfigComponent = spec?.configPanel ?? BasicNodeConfig;
  // The node's own name leads; the kind moves to a chip so five approval
  // nodes never show five identical "审批" headers.
  const trimmedName = nodeName?.trim();
  const title = trimmedName || spec?.label || "节点配置";
  const showKindChip = !!trimmedName && !!spec && trimmedName !== spec.label;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          animate="visible"
          css={configPanelWrapperStyle}
          exit="hidden"
          initial="hidden"
          transition={panelTransition}
          variants={panelVariants}
        >
          {/* Header */}
          <div css={configPanelHeaderStyle}>
            <div css={configPanelTitleStyle}>
              {Icon && (
                <AccentIconBadge color={color} variant={spec?.badgeVariant}>
                  <Icon height={14} width={14} />
                </AccentIconBadge>
              )}

              <span>{title}</span>
              {showKindChip && <span css={configPanelKindChipStyle}>{spec.label}</span>}
            </div>

            {!readonly && deletable && selectedNodeId && (
              <button
                aria-label="删除节点"
                css={configPanelDeleteStyle}
                title="删除节点"
                type="button"
                onClick={() => removeNode(selectedNodeId)}
              >
                <Trash2Icon size={15} />
              </button>
            )}

            <button
              aria-label="关闭"
              css={configPanelCloseStyle}
              title="关闭"
              type="button"
              onClick={() => selectNode(null)}
            >
              <XIcon height={16} width={16} />
            </button>
          </div>

          {/* Body */}
          <ScrollArea key={selectedNodeId} css={configPanelBodyStyle} scrollbarSize={10}>
            {selectedNodeId && <ConfigComponent nodeId={selectedNodeId} />}
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
