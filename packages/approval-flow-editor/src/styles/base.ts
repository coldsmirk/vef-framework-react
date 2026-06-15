import { css } from "@emotion/react";
import reactFlowBaseCss from "@xyflow/react/dist/base.css?raw";

/**
 * react-flow base styles wrapped in @layer for easy overriding.
 *
 * IMPORTANT: Must be injected via <Global styles={...} />, NOT via Emotion's
 * css prop. @layer is a top-level CSS at-rule — when Emotion scopes css prop
 * styles under a .css-xxx selector, the nested @layer becomes invalid CSS and
 * the browser ignores it, causing handles to lose their positioning styles.
 */
export const reactFlowGlobalBaseStyle = css`
  @layer react-flow {
    ${reactFlowBaseCss}
  }
`;
