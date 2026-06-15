import type { FormLayout } from "antd/es/form/Form";

import { useMemo } from "react";

import { showWarningMessage } from "../../_base";

const MIN_LABEL_WIDTH = 60;
const MAX_LABEL_WIDTH = 120;

/**
 * Computes the label width for a form field.
 * Returns undefined for vertical layout or when no labelWidth is provided.
 * Clamps the value between 60 and 120 pixels.
 */
export function useLabelWidth(layout?: FormLayout, labelWidth?: number): number | undefined {
  return useMemo(() => {
    if (layout === "vertical" || !labelWidth) {
      return;
    }

    if (labelWidth < MIN_LABEL_WIDTH || labelWidth > MAX_LABEL_WIDTH) {
      showWarningMessage(`The labelWidth of Form component must be between ${MIN_LABEL_WIDTH} and ${MAX_LABEL_WIDTH}.`);
    }

    return Math.min(Math.max(labelWidth, MIN_LABEL_WIDTH), MAX_LABEL_WIDTH);
  }, [layout, labelWidth]);
}
