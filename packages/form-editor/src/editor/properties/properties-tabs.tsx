import type { ReactElement } from "react";

import type { FormField, PropertiesDescriptor, PropertyTabId } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import {
  countConfiguredEntries,
  PROPERTY_TAB_LABELS
} from "./properties-provider";

// A self-styled tab strip instead of antd `Tabs`: re-skinning the antd tab
// bar couples this strip to its internal class structure, which is heavier
// than the few rules a tab strip needs. (Prefixed selectors WOULD be stable —
// the framework pins `prefixCls="vef"` in its ConfigProvider, which is why
// palette-group / canvas target `.vef-*` classes — restyling antd Tabs is
// simply more override than self-styling here.) Tokens only, real tab semantics.
const wrapperCss = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "stretch",
  gap: 28,
  padding: "0 20px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const tabCss = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "16px 0 14px",
  border: "none",
  background: "transparent",
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  letterSpacing: 0,
  color: globalCssVars.colorTextTertiary,
  cursor: "pointer",
  transition: `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover": {
    color: globalCssVars.colorText
  },

  // The active indicator: a 2px accent bar hugging the strip's bottom border.
  "&::after": {
    content: "\"\"",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 2,
    borderRadius: 2,
    background: "transparent",
    transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  }
});

const tabActiveCss = css({
  color: globalCssVars.colorText,

  "&::after": {
    background: globalCssVars.colorPrimary
  }
});

const badgeCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 20,
  height: 18,
  padding: "0 6px",
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextSecondary,
  lineHeight: 1
});

const activeBadgeCss = css({
  background: globalCssVars.colorPrimary,
  color: globalCssVars.colorWhite
});

export interface PropertiesTabsProps {
  field: FormField;
  descriptor: PropertiesDescriptor;
  activeTab: PropertyTabId;
  /**
   * The tabs to render, in order. The panel decides visibility (e.g. the
   * contextual "布局" tab only for a container's children), so the bar simply
   * renders what it is handed.
   */
  tabs: readonly PropertyTabId[];
  onChange: (tab: PropertyTabId) => void;
}

/**
 * Tab bar across the top of the properties panel. Renders the `tabs` it is
 * given, in order. Each tab shows the count of *configured* entries on the
 * current field (the linkage tab counts its rules); tabs with no configured
 * entries hide the badge to keep the bar quiet.
 *
 * The "属性" tab never shows a badge — it is the primary tab and would
 * otherwise become a noisy counter of trivial defaults (id, label).
 */
export function PropertiesTabs({
  activeTab,
  descriptor,
  field,
  onChange,
  tabs
}: PropertiesTabsProps): ReactElement {
  return (
    <div aria-label="控件属性" css={wrapperCss} role="tablist">
      {tabs.map(tab => {
        const active = tab === activeTab;
        const count = tab === "props" ? 0 : countConfiguredEntries(field, descriptor, tab);

        return (
          <button
            key={tab}
            aria-selected={active}
            css={[tabCss, active && tabActiveCss]}
            role="tab"
            type="button"
            onClick={() => onChange(tab)}
          >
            <span>{PROPERTY_TAB_LABELS[tab]}</span>

            {count > 0
              ? <span css={[badgeCss, active && activeBadgeCss]}>{count}</span>
              : null}
          </button>
        );
      })}
    </div>
  );
}
