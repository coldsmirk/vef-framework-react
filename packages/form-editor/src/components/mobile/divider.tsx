import type { FC } from "react";

import type { DividerField, FieldComponentProps } from "../../types";

import Divider from "antd-mobile/es/components/divider";

/**
 * Mobile read-only renderer for the section divider. Mirrors the PC divider:
 * non-keyed presentation with an optional inline title rendered as the
 * divider's children. The title position maps to antd-mobile's
 * `contentPosition`, defaulting to centered. The PC-only `dashed` rule has no
 * antd-mobile equivalent, so the mobile divider always renders solid.
 */
export const MobileDivider: FC<FieldComponentProps<DividerField, undefined>> = ({ field }) => field.title ? <Divider contentPosition={field.titlePlacement ?? "center"}>{field.title}</Divider> : <Divider />
;
