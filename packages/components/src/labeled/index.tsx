import type { PropsWithChildren, ReactNode } from "react";

import { useId } from "react";

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
  /**
   * Id of the labeled control, for the native label-click association. When
   * omitted (composite children have no single control id), the group
   * labelling still names the children for assistive tech.
   */
  htmlFor?: string;
}

const visuallyHiddenCss = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  clipPath: "inset(50%)",
  overflow: "hidden",
  whiteSpace: "nowrap"
} as const;

/**
 * A top label for controls that live outside the form system (key-value
 * editors, principal pickers, code editors), so they align with the vertical
 * form items around them. The children are arbitrary, so the accessible name
 * rides on a labelled group (plus the native association when `htmlFor` is
 * given) instead of prop injection.
 */
export function Labeled({
  label,
  required = false,
  hint,
  htmlFor,
  children
}: LabeledProps) {
  const labelId = useId();
  const hintId = useId();

  return (
    <Stack aria-describedby={hint ? hintId : undefined} aria-labelledby={labelId} gap={6} role="group">
      <label htmlFor={htmlFor} id={labelId}>
        <Text>
          {required
            ? (
                <>
                  <Text aria-hidden type="danger">* </Text>
                  <span css={visuallyHiddenCss}>（必填）</span>
                </>
              )
            : null}

          {label}
        </Text>
      </label>

      {children}
      {hint ? <Text id={hintId} style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">{hint}</Text> : null}
    </Stack>
  );
}
