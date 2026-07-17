import type { PropsWithChildren, ReactNode } from "react";

import { globalCssVars } from "../_base";
import { Stack } from "../stack";
import { Text } from "../typography";

export interface LabeledProps extends PropsWithChildren {
  /**
   * Label shown above the control, matching the vertical form-item typography.
   */
  label: ReactNode;
  /**
   * Render the required marker before the label.
   */
  required?: boolean;
  /**
   * Secondary hint under the control.
   */
  hint?: ReactNode;
}

/**
 * A top label for controls that live outside the form system (key-value
 * editors, principal pickers, code editors), so they align with the vertical
 * form items around them.
 */
export function Labeled({
  label,
  required = false,
  hint,
  children
}: LabeledProps) {
  return (
    <Stack gap={6}>
      <Text>
        {required ? <Text type="danger">* </Text> : null}
        {label}
      </Text>

      {children}
      {hint ? <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">{hint}</Text> : null}
    </Stack>
  );
}
