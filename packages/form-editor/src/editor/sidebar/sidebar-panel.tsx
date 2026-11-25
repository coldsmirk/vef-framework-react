import type { DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { SidebarTabId } from "../../store/form-store";

import { css } from "@emotion/react";
import { Button, globalCssVars, ScrollArea, Tooltip } from "@vef-framework-react/components";
import { useState } from "react";

import { assertNever } from "../../engine/assert-never";
import { EditorIcon } from "../../icons";
import {
  isSidebarVisible,
  selectFieldCount,
  useFormEditorStore,
  useFormEditorStoreApi
} from "../../store/form-store";
import { useEditorLayout } from "../editor-layout-context";
import {
  panelBodyCss,
  sidebarDockCss,
  sidebarOverlayCss
} from "../styles";
import { DataTab } from "./data-tab";
import { OutlineTab } from "./outline-tab";
import { PaletteRail, PaletteTab } from "./palette-tab";

const HEADER_HEIGHT = 44;

const tabStripCss = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "stretch",
  height: HEADER_HEIGHT,
  padding: "0 8px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const tabButtonCss = css({
  position: "relative",
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  minWidth: 0,
  padding: "0 6px",
  border: "none",
  background: "transparent",
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  color: globalCssVars.colorTextTertiary,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "& > svg": {
    width: 14,
    height: 14,
    flexShrink: 0
  },

  "&:hover": {
    color: globalCssVars.colorText
  },

  "&::after": {
    content: "\"\"",
    position: "absolute",
    left: 6,
    right: 6,
    bottom: -1,
    height: 2,
    borderRadius: 2,
    background: "transparent",
    transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  }
});

const tabButtonActiveCss = css({
  color: globalCssVars.colorText,

  "&::after": {
    background: globalCssVars.colorPrimary
  }
});

const badgeCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 16,
  height: 16,
  padding: "0 4px",
  borderRadius: 999,
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextSecondary,
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1
});

const activeBadgeCss = css({
  background: globalCssVars.colorPrimaryBg,
  color: globalCssVars.colorPrimaryText
});

const railTabsCss = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "8px 0",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  flexShrink: 0
});

const railTabButtonCss = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 36,
  border: "none",
  borderRadius: globalCssVars.borderRadius,
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  cursor: "pointer",
  transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}, color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "& > svg": {
    width: 18,
    height: 18
  },

  "&:hover": {
    background: globalCssVars.colorFillTertiary,
    color: globalCssVars.colorText
  },

  "&:focus-visible": {
    outline: `2px solid ${globalCssVars.colorPrimaryBorder}`,
    outlineOffset: -2
  }
});

const railTabButtonActiveCss = css({
  background: globalCssVars.colorPrimaryBg,
  color: globalCssVars.colorPrimaryText,

  "&:hover": {
    background: globalCssVars.colorPrimaryBg,
    color: globalCssVars.colorPrimaryText
  }
});

const overlayHeaderCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  height: HEADER_HEIGHT,
  padding: "0 12px 0 16px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  flexShrink: 0
});

const overlayTitleCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText,

  "& > svg": {
    width: 15,
    height: 15,
    color: globalCssVars.colorTextSecondary
  }
});

const closeButtonCss = css({
  width: 28,
  height: 28,
  padding: 0,
  flexShrink: 0
});

interface SidebarTabMeta {
  key: SidebarTabId;
  label: string;
  icon: DynamicIconName;
}

const SIDEBAR_TABS: readonly SidebarTabMeta[] = [
  {
    key: "palette",
    label: "组件",
    icon: "layout-grid"
  },
  {
    key: "outline",
    label: "大纲",
    icon: "list-tree"
  },
  {
    key: "data",
    label: "数据",
    icon: "database"
  }
];

function selectDataItemCount(state: { schema: { dataSources?: unknown[]; variables?: unknown[] } }): number {
  return (state.schema.dataSources?.length ?? 0) + (state.schema.variables?.length ?? 0);
}

/**
 * Tabbed left workbench: `组件` (component palette), `大纲` (active layer node
 * tree), and `数据` (form-global data sources and variables). Visible in edit
 * mode and hidden in preview / JSON modes.
 *
 * Only the active tab's body is mounted so a form with hundreds of fields
 * never walks the outline or mounts data-source editors while the designer is
 * working elsewhere. Search state lives here so it survives tab and view-mode
 * round trips.
 *
 * Layout adaptivity:
 * - `docked`: uniform 296px across `组件` / `大纲` / `数据` so switching tabs
 * never shifts the canvas (data-source and variable details edit in modals).
 * - `drawer`: collapses to a 64px icon rail carrying the tab switcher above the
 * component icons; `大纲` and `数据` open as a 296px left-edge overlay beside it.
 */
export function SidebarPanel(): ReactElement {
  const visible = useFormEditorStore(isSidebarVisible);
  const activeTab = useFormEditorStore(s => s.sidebarTab);
  const isPropertiesOpen = useFormEditorStore(s => s.propertiesDrawerOpen);
  // Primitive / WeakMap-memoized selectors so ordinary field edits never
  // re-render the sidebar chrome.
  const fieldsCount = useFormEditorStore(selectFieldCount);
  const dataCount = useFormEditorStore(selectDataItemCount);
  const storeApi = useFormEditorStoreApi();
  const layout = useEditorLayout();
  const [keyword, setKeyword] = useState("");

  const rail = layout === "drawer";
  // What the rail shows as open: the properties overlay takes the sidebar's
  // place over a narrow canvas, and closing it brings the sidebar's back.
  const railTab: SidebarTabId = isPropertiesOpen ? "palette" : activeTab;
  const showOverlay = visible && rail && railTab !== "palette";

  const counts: Record<SidebarTabId, number> = {
    palette: 0,
    outline: fieldsCount,
    data: dataCount
  };

  const handleRailTabClick = (tab: SidebarTabId): void => {
    // Clicking the active overlay tab collapses it back to the component rail.
    storeApi.getState().setSidebarTab(railTab === tab ? "palette" : tab);
  };

  const renderActiveDockedBody = (): ReactElement | null => {
    if (!visible) {
      return null;
    }

    switch (activeTab) {
      case "palette": {
        return <PaletteTab keyword={keyword} onKeywordChange={setKeyword} />;
      }

      case "outline": {
        return (
          <ScrollArea css={panelBodyCss} scrollbars="vertical">
            <OutlineTab />
          </ScrollArea>
        );
      }

      case "data": {
        return (
          <ScrollArea css={panelBodyCss} scrollbars="vertical">
            <DataTab />
          </ScrollArea>
        );
      }

      default: {
        return assertNever(activeTab);
      }
    }
  };

  const overlayMeta = activeTab === "outline"
    ? { label: "大纲", icon: "list-tree" as DynamicIconName }
    : { label: "数据", icon: "database" as DynamicIconName };

  return (
    <>
      <aside
        aria-label="侧边栏"
        css={sidebarDockCss}
        data-layout={layout}
        data-tab={activeTab}
        hidden={!visible}
      >
        {rail
          ? (
              <>
                <div aria-label="侧边栏" aria-orientation="vertical" css={railTabsCss} role="tablist">
                  {SIDEBAR_TABS.map(item => {
                    const active = railTab === item.key;

                    return (
                      <Tooltip key={item.key} placement="right" title={item.label}>
                        <button
                          aria-label={item.label}
                          aria-selected={active}
                          css={[railTabButtonCss, active && railTabButtonActiveCss]}
                          role="tab"
                          type="button"
                          onClick={() => handleRailTabClick(item.key)}
                        >
                          <EditorIcon name={item.icon} />
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>

                {visible ? <PaletteRail /> : null}
              </>
            )
          : (
              <>
                <div aria-label="侧边栏" css={tabStripCss} role="tablist">
                  {SIDEBAR_TABS.map(item => {
                    const active = activeTab === item.key;
                    const count = counts[item.key];

                    return (
                      <button
                        key={item.key}
                        aria-selected={active}
                        css={[tabButtonCss, active && tabButtonActiveCss]}
                        role="tab"
                        type="button"
                        onClick={() => storeApi.getState().setSidebarTab(item.key)}
                      >
                        <EditorIcon name={item.icon} />
                        <span>{item.label}</span>
                        {count > 0 ? <span css={[badgeCss, active && activeBadgeCss]}>{count}</span> : null}
                      </button>
                    );
                  })}
                </div>

                {renderActiveDockedBody()}
              </>
            )}
      </aside>

      {showOverlay
        ? (
            <section
              aria-label={overlayMeta.label}
              css={sidebarOverlayCss}
              data-tab={activeTab}
            >
              <div css={overlayHeaderCss}>
                <span css={overlayTitleCss}>
                  <EditorIcon name={overlayMeta.icon} />
                  <span>{overlayMeta.label}</span>
                </span>

                <Button
                  aria-label="收起侧边栏"
                  css={closeButtonCss}
                  icon={<EditorIcon name="x" />}
                  size="small"
                  title="收起"
                  type="text"
                  onClick={() => storeApi.getState().setSidebarTab("palette")}
                />
              </div>

              <ScrollArea css={panelBodyCss} scrollbars="vertical">
                {activeTab === "outline" ? <OutlineTab /> : <DataTab />}
              </ScrollArea>
            </section>
          )
        : null}
    </>
  );
}
