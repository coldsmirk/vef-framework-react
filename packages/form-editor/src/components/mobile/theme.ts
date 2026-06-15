import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

// Baseline `--adm-*` custom properties (a `:root` block only — no element
// reset). Importing the component subpaths under `components/mobile/` never
// pulls antd-mobile's global reset (`antd-mobile/es/global`), so this file is
// the single place that seeds the full variable set every control depends on.
import "antd-mobile/es/global/theme-default.css";

/**
 * Bridge antd-mobile's themeable variables onto the VEF theme tokens so mobile
 * controls track the PC primary color, radius, fonts, and surfaces from one
 * source of truth.
 *
 * The doubled `:root:root` selector — the convention antd-mobile itself uses to
 * raise specificity — outranks the single-`:root` defaults from
 * `theme-default.css` regardless of stylesheet insertion order. The mapped
 * `--vef-*` references already adapt to dark mode through antd's `cssVar`
 * algorithm, so dark mode needs no branch here. Defined at `:root` (not a scoped
 * node) on purpose: antd-mobile popups portal to `document.body`, so a subtree
 * scope would not reach them, whereas `--adm-*` are inert for any non-`.adm-`
 * element and so are safe globally.
 */
export const admThemeBridge = css`
  :root:root {
    --adm-color-primary: ${globalCssVars.colorPrimary};
    --adm-color-success: ${globalCssVars.colorSuccess};
    --adm-color-warning: ${globalCssVars.colorWarning};
    --adm-color-danger: ${globalCssVars.colorError};
    --adm-color-text: ${globalCssVars.colorText};
    --adm-color-text-secondary: ${globalCssVars.colorTextSecondary};
    --adm-color-weak: ${globalCssVars.colorTextTertiary};
    --adm-color-light: ${globalCssVars.colorTextQuaternary};
    --adm-color-border: ${globalCssVars.colorBorderSecondary};
    --adm-color-background: ${globalCssVars.colorBgContainer};
    --adm-color-box: ${globalCssVars.colorFillTertiary};
    --adm-radius-s: ${globalCssVars.borderRadiusSm};
    --adm-radius-m: ${globalCssVars.borderRadius};
    --adm-radius-l: ${globalCssVars.borderRadiusLg};
    --adm-font-size-main: ${globalCssVars.fontSize};
    --adm-font-family: ${globalCssVars.fontFamily};
  }
`;
