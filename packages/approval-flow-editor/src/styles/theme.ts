import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

/**
 * Corner radius shared by the node card and the focus ring drawn on its
 * xyflow wrapper, so the two outlines always coincide.
 */
const nodeBorderRadius = 10;

/**
 * VEF theme overrides for react-flow
 */
export const editorThemeStyle = css({
  ".react-flow": {
    // Effectively-opaque equivalent of colorTextQuaternary flattened onto the
    // canvas background. The edge stroke also paints the arrow marker, whose
    // glyph is a stroke drawn ON TOP of its own fill — with a translucent
    // color the overlapping perimeter compounds to a darker alpha than the
    // interior and the solid arrow reads as a hollow outline. Flattening via
    // color-mix keeps the rendered color identical (and dark-mode adaptive)
    // while making the self-overlap invisible, like xyflow's own opaque
    // default (#b1b1b7).
    "--xy-edge-stroke-default": `color-mix(in srgb, ${globalCssVars.colorText} 28%, ${globalCssVars.colorBgLayout})`,
    // A selected edge gets the primary border tint so selection is visible
    // (previously identical to the default stroke = no feedback). Adapts to dark
    // mode via the token.
    "--xy-edge-stroke-selected-default": globalCssVars.colorPrimaryBorder,
    "--xy-edge-stroke-width-default": 2,
    "--xy-connectionline-stroke-default": `color-mix(in srgb, ${globalCssVars.colorText} 28%, ${globalCssVars.colorBgLayout})`,
    "--xy-connectionline-stroke-width-default": 2,
    "--xy-node-border-default": "none",
    "--xy-background-color-default": globalCssVars.colorBgLayout,
    "--xy-minimap-background-color-default": globalCssVars.colorBgContainer,
    "--xy-minimap-mask-background-color-default": globalCssVars.colorFillQuaternary,
    "--xy-minimap-node-background-color-default": globalCssVars.colorFill,
    "--xy-controls-button-background-color-default": globalCssVars.colorBgContainer,
    "--xy-controls-button-border-color-default": globalCssVars.colorBorder,
    "--xy-controls-button-color-default": globalCssVars.colorText
  },

  ".react-flow__minimap": {
    borderRadius: globalCssVars.borderRadiusLg,
    border: `1px solid ${globalCssVars.colorBorderSecondary}`,
    overflow: "hidden"
  },

  // Replace the browser focus outline with a token-driven focus ring. xyflow
  // nodes are keyboard-focusable (tabindex), so dropping the outline without a
  // visible :focus-visible replacement would strand keyboard navigation.
  ".react-flow__node": {
    outline: "none",
    borderRadius: nodeBorderRadius
  },

  ".react-flow__node:focus-visible": {
    boxShadow: `0 0 0 2px ${globalCssVars.colorPrimaryBorder}`
  },

  // Handle (connection point) styles — matching jdm-editor
  ".react-flow__handle": {
    width: 7,
    height: 7,
    borderRadius: "50%",
    border: `1px solid ${globalCssVars.colorPrimaryBorder}`,
    background: globalCssVars.colorPrimaryBg,
    zIndex: 20,
    cursor: "crosshair",
    opacity: 0.75,
    transition: `background ${globalCssVars.motionDurationMid}, opacity ${globalCssVars.motionDurationMid}, transform ${globalCssVars.motionDurationMid}`,

    // Invisible hit area for easier interaction
    "&::after": {
      content: "\"\"",
      position: "absolute",
      display: "block",
      width: 16,
      height: 16,
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      borderRadius: "50%"
    },

    "&:hover, &.react-flow__handle-connecting, &.connectingfrom, &.connectingto": {
      background: globalCssVars.colorPrimaryBgHover,
      opacity: 1
    }
  },

  // Left handle: preserve xyflow translate + add scale on hover
  ".react-flow__handle-left": {
    "&::after": {
      transform: "translate(-75%, -50%)"
    },
    "&:hover, &.react-flow__handle-connecting, &.connectingfrom, &.connectingto": {
      transform: "translate(-50%, -50%) scale(2)"
    }
  },

  // Right handle: preserve xyflow translate + add scale on hover
  ".react-flow__handle-right": {
    "&::after": {
      transform: "translate(-25%, -50%)"
    },
    "&:hover, &.react-flow__handle-connecting, &.connectingfrom, &.connectingto": {
      transform: "translate(50%, -50%) scale(2)"
    }
  }
});

/**
 * Full width style
 */
export const fullWidthStyle = css({
  width: "100%"
});

/**
 * Editor container layout
 */
export const editorLayoutStyle = css({
  width: "100%",
  height: "100%",
  display: "flex",
  position: "relative",
  overflow: "hidden"
});

/**
 * Canvas area (ReactFlow container)
 */
export const canvasStyle = css({
  flex: 1,
  height: "100%"
});

/**
 * Toolbar area
 */
export const toolbarContainerStyle = css({
  position: "absolute",
  top: 12,
  left: 12,
  zIndex: 5,
  display: "flex",
  gap: 6,
  padding: "6px 10px",
  background: globalCssVars.colorBgContainer,
  borderRadius: globalCssVars.borderRadiusLg,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  boxShadow: `0 2px 8px ${globalCssVars.colorFillContent}`
});

/* -- Floating Config Panel ------------------------------------------------- */

/**
 * Floating config panel — positioned over canvas, animated via motion
 */
export const configPanelWrapperStyle = css({
  position: "absolute",
  top: globalCssVars.spacingSm,
  right: globalCssVars.spacingSm,
  bottom: globalCssVars.spacingSm,
  width: 420,
  zIndex: 10,
  display: "flex",
  flexDirection: "column",
  background: globalCssVars.colorBgContainer,
  borderRadius: globalCssVars.borderRadiusLg,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  boxShadow: `0 4px 20px ${globalCssVars.colorFillContent}`,
  overflow: "hidden"
});

/**
 * Config panel header
 */
export const configPanelHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "16px 20px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  flexShrink: 0
});

/**
 * Config panel header title area
 */
export const configPanelTitleStyle = css({
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.spacingXs,
  fontWeight: 600,
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorText
});

/**
 * Config panel close button
 */
export const configPanelCloseStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorTextTertiary,
  cursor: "pointer",
  flexShrink: 0,
  transition: `background ${globalCssVars.motionDurationMid} ease, color ${globalCssVars.motionDurationMid} ease`,

  "&:hover": {
    background: globalCssVars.colorFillQuaternary,
    color: globalCssVars.colorTextSecondary
  }
});

/**
 * Config panel delete-node button — same chrome as the close button with a
 * danger hover, matching the trash affordance used by the list rows.
 */
export const configPanelDeleteStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorTextTertiary,
  cursor: "pointer",
  flexShrink: 0,
  transition: `background ${globalCssVars.motionDurationMid} ease, color ${globalCssVars.motionDurationMid} ease`,

  "&:hover": {
    background: globalCssVars.colorErrorBg,
    color: globalCssVars.colorErrorText
  }
});

/**
 * Node-kind chip next to the panel title, shown when the node has a custom
 * name so the kind stays readable.
 */
export const configPanelKindChipStyle = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 400,
  color: globalCssVars.colorTextTertiary,
  background: globalCssVars.colorFillQuaternary,
  borderRadius: globalCssVars.borderRadiusSm,
  padding: "1px 6px",
  flexShrink: 0
});

/**
 * Config panel scrollable body (ScrollArea wrapper)
 */
export const configPanelBodyStyle = css({
  flex: 1,
  minHeight: 0
});

/**
 * Section within config panel
 */
export const configSectionStyle = css({
  padding: "16px 20px",

  "&:not(:last-child)": {
    borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
  }
});

/**
 * Section content padding (rendered inside Collapse panel)
 */
export const configSectionContentStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingMd,
  paddingTop: globalCssVars.spacingMd
});

/**
 * Form field wrapper
 */
export const formFieldStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingXs
});

/**
 * Form field label
 */
export const formFieldLabelStyle = css({
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorTextSecondary,
  lineHeight: 1
});

/* -- Shared Node Styles ---------------------------------------------------- */

/**
 * Node container — positioning context for handles, visual card style
 */
export const nodeContainerStyle = css({
  position: "relative",
  display: "flex",
  cursor: "grab",
  minWidth: 180,
  maxWidth: 260,
  borderRadius: nodeBorderRadius,
  background: globalCssVars.colorBgContainer,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorText,
  transition: `box-shadow ${globalCssVars.motionDurationMid}, border-color ${globalCssVars.motionDurationMid}`,
  boxShadow: `0 1px 4px ${globalCssVars.colorFillContent}`,

  // Readonly nodes are not draggable; drop the grab cursor and hover-lift so the
  // chrome does not signal interactivity that does not exist.
  "&[data-readonly]": {
    cursor: "default"
  },

  "&:not([data-readonly]):hover": {
    boxShadow: `0 2px 10px ${globalCssVars.colorFillContentHover}`
  },

  // Validation problems re-tint the accent variables to the error tokens (see
  // NodeShell), so the standing border and the selection ring both read as
  // "broken" through the same accent plumbing.
  "&[data-invalid]": {
    borderColor: "var(--vef-node-accent-color)"
  },

  "&[data-selected]": {
    borderColor: "var(--vef-node-accent-color)",
    boxShadow: `0 0 0 2px var(--vef-node-accent-glow), 0 2px 10px ${globalCssVars.colorFillContentHover}`
  }
});
