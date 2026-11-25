import type { ReactElement } from "react";

import { css } from "@emotion/react";
import { Spin } from "@vef-framework-react/components";

import { useFieldBusy } from "../../runtime/effects";

const busyWrapCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  lineHeight: 0,
  pointerEvents: "none"
});

/**
 * Subtle busy spinner rendered for the enclosing field while one of its own
 * effect sequences has an in-flight `api_call`. Subscribes directly to the
 * sequence controller via {@link useFieldBusy} so toggling busy state never
 * re-renders the field's control or shell.
 *
 * Uses the framework's `<Spin size="small" />` and sits in a dedicated inline
 * slot (next to the field label in `FieldShell` / `Switch`, or in the reserved
 * bottom status strip of `CellFieldFrame`) so it never collides with control
 * suffixes such as select chevrons, date icons, number steppers, `allowClear`,
 * password eye toggles, or unit suffixes on PC, mobile, or table cells.
 */
export function FieldBusyIndicator(): ReactElement | null {
  const busy = useFieldBusy();

  if (!busy) {
    return null;
  }

  return (
    <span
      aria-label="加载中"
      css={busyWrapCss}
      data-field-busy="true"
      role="status"
    >
      <Spin size="small" />
    </span>
  );
}
