import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { AnimatePresence, clsx, DragDropProvider, moveDragItem, RestrictToHorizontalAxis, useShallow } from "@vef-framework-react/core";

import { INDEX_ROUTE_PATH } from "../../../../constants";
import { useTabStore } from "../../../../stores";
import { useTabNavigate } from "../../hooks";
import { ContextMenu } from "./context-menu";
import { TabItem } from "./tab-item";

const tabListStyle = css({
  display: "flex",
  alignItems: "center",
  height: "var(--vef-layout-tabs-height)",
  columnGap: globalCssVars.spacingXs,
  width: "max-content",
  marginInline: 1
});

export function TabList() {
  const { setTabs, removeTab } = useTabStore(
    useShallow(({ setTabs, removeTab }) => {
      return { setTabs, removeTab };
    })
  );

  const activeTabId = useTabStore(state => state.activeTabId);
  const tabs = useTabStore(state => state.tabs);

  const navigate = useTabNavigate();

  return (
    <DragDropProvider
      modifiers={[RestrictToHorizontalAxis]}
      onDragEnd={event => {
        setTabs(
          moveDragItem(tabs, event)
        );
      }}
    >
      <div css={tabListStyle}>
        <AnimatePresence>
          {
            tabs.map((tab, index) => (
              <ContextMenu key={tab.id} tabId={tab.id}>
                <TabItem
                  layout
                  index={index}
                  label={tab.label}
                  tabId={tab.id}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: 1
                  }}
                  className={clsx({
                    active: tab.id === activeTabId
                  })}
                  exit={{
                    opacity: 0,
                    x: -20,
                    scale: 0.8,
                    transition: {
                      ease: "easeIn"
                    }
                  }}
                  initial={{
                    opacity: 0,
                    x: 20,
                    scale: 0.8
                  }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: "easeOut"
                  }}
                  onClick={event => {
                    const targetElement = event.currentTarget;
                    navigate(tab);
                    requestAnimationFrame(() => {
                      if (targetElement.isConnected) {
                        targetElement.scrollIntoView({
                          inline: "center",
                          behavior: "smooth"
                        });
                      }
                    });
                  }}
                  onClose={() => {
                    if (tabs.length === 1 && tab.fullPath === INDEX_ROUTE_PATH) {
                      return;
                    }

                    removeTab(tab.id, navigate);
                  }}
                />
              </ContextMenu>
            ))
          }
        </AnimatePresence>
      </div>
    </DragDropProvider>
  );
}
