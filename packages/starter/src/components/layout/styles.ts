import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

export const sidebar = css({
  display: "flex",
  flexDirection: "column",
  borderInlineEnd: `${globalCssVars.lineWidth} ${globalCssVars.lineType} ${globalCssVars.colorBorderSecondary}`,
  background: globalCssVars.colorBgContainer
});

// The dark sidebar follows the header's playbook for a colored surface: the
// background derives from the consumer's primary via color-mix (so any brand
// color settles into a coherent deep-navy-like surface), the alias vars that
// antd children read are cascaded to light-on-dark values, and the menu's own
// component tokens are redeclared explicitly — antd resolves those on the menu
// root, so the alias cascade alone cannot reach them. The logo mark itself is
// untouched (no invert filter): only the title goes white via the
// primary-text alias.
export const sidebarDark = css({
  borderInlineEndColor: "rgba(255, 255, 255, 0.08)",
  background: [
    // A faint brand glow bleeding down from the logo zone, over a deep vertical fade.
    "radial-gradient(120% 56% at 50% 0%, color-mix(in srgb, var(--vef-color-primary) 20%, transparent), transparent 62%)",
    "linear-gradient(180deg, color-mix(in srgb, var(--vef-color-primary) 13%, #0b1120) 0%, color-mix(in srgb, var(--vef-color-primary) 6%, #080d18) 100%)"
  ].join(", "),

  "--vef-color-text": "rgba(255, 255, 255, 0.92)",
  "--vef-color-text-secondary": "rgba(255, 255, 255, 0.75)",
  "--vef-color-text-tertiary": "rgba(255, 255, 255, 0.55)",
  "--vef-color-text-quaternary": "rgba(255, 255, 255, 0.4)",
  "--vef-color-primary-text": "var(--vef-color-white)",
  "--vef-color-icon": "rgba(255, 255, 255, 0.8)",
  "--vef-color-icon-hover": "var(--vef-color-white)",
  "--vef-color-split": "rgba(255, 255, 255, 0.16)",
  "--vef-color-border": "rgba(255, 255, 255, 0.22)",
  "--vef-color-border-secondary": "rgba(255, 255, 255, 0.14)",
  "--vef-color-fill-tertiary": "rgba(255, 255, 255, 0.12)",
  "--vef-color-fill-quaternary": "rgba(255, 255, 255, 0.08)",

  "& .vef-menu": {
    "--vef-menu-item-color": "rgba(255, 255, 255, 0.7)",
    "--vef-menu-item-hover-color": "var(--vef-color-white)",
    "--vef-menu-item-selected-color": "var(--vef-color-white)",
    "--vef-menu-sub-menu-item-selected-color": "var(--vef-color-white)",
    "--vef-menu-group-title-color": "rgba(255, 255, 255, 0.4)",
    "--vef-menu-item-active-bg": "rgba(255, 255, 255, 0.14)",
    // The inline submenu well: antd's default colorFillAlter reads as a light
    // gray slab on the dark surface.
    "--vef-menu-sub-menu-item-bg": "rgba(255, 255, 255, 0.04)"
  },

  // Collapsed rail: the sidebar's gradient pill only styles the inline menu,
  // so antd's default light-tint pill would resurface here — keep the
  // selected item on the brand surface instead.
  "& .vef-menu-inline-collapsed": {
    "--vef-menu-item-selected-bg": "var(--vef-color-primary)",
    "--vef-menu-item-selected-color": "var(--vef-color-white)"
  }
});
