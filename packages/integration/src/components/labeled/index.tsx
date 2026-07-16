import type { ReactNode } from "react";

import { globalCssVars, Stack, Text } from "@vef-framework-react/components";

export interface LabeledProps {
  /**
   * Label shown above the control, matching the vertical form-item typography.
   */
  label: ReactNode;
  /**
   * Secondary hint under the control.
   */
  hint?: ReactNode;
  children?: ReactNode;
}

/**
 * A top label for controls that are not form fields (key-value editors, code
 * editors in the console), so they align with vertical form items around them.
 */
export function Labeled({
  label,
  hint,
  children
}: LabeledProps) {
  return (
    <Stack gap={6}>
      <Text>{label}</Text>
      {children}
      {hint ? <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">{hint}</Text> : null}
    </Stack>
  );
}
