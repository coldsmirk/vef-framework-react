import type { ComponentProps, FC } from "react";

import type { AlertBlockField, FieldComponentProps } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import NoticeBar from "antd-mobile/es/components/notice-bar";

type NoticeBarColor = NonNullable<ComponentProps<typeof NoticeBar>["color"]>;

/**
 * Map the PC alert type onto NoticeBar's color scale. antd-mobile has no
 * dedicated "warning" tone, so it maps to `"alert"` — its amber/attention
 * variant — the closest visual match.
 */
const colorByAlertType: Record<NonNullable<AlertBlockField["alertType"]>, NoticeBarColor> = {
  info: "info",
  success: "success",
  warning: "alert",
  error: "error"
};

const messageCss = css({
  fontWeight: 500
});

const descriptionCss = css({
  marginTop: 2,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: globalCssVars.lineHeightSm
});

/**
 * Mobile read-only renderer for the inline alert. Mirrors the PC alert: a
 * non-keyed banner whose tone comes from `field.alertType` (defaulting to
 * `"info"`). NoticeBar exposes a single `content` slot, so the message and the
 * optional description are stacked inside it. `closeable` maps from
 * `field.closable`; `field.showIcon === false` hides the leading icon by passing
 * `null` (an absent value keeps NoticeBar's default icon). The PC-only `banner`
 * mode has no NoticeBar equivalent.
 */
export const MobileAlertBlock: FC<FieldComponentProps<AlertBlockField, undefined>> = ({ field }) => (
  <NoticeBar
    wrap
    closeable={field.closable}
    color={colorByAlertType[field.alertType ?? "info"]}
    icon={field.showIcon === false ? null : undefined}
    content={(
      <div>
        <div css={messageCss}>{field.message ?? ""}</div>
        {field.description ? <div css={descriptionCss}>{field.description}</div> : null}
      </div>
    )}
  />
);
