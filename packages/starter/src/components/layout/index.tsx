import type { LayoutProps } from "./props";

import { ClassNames } from "@emotion/react";
import { breakpoints } from "@vef-framework-react/components";
import { useEffect, useMemo } from "react";

import { useThemeStore } from "../../stores";
import { BaseLayout } from "../base-layout";
import { Header, Search, Sidebar, Tabs, ThemeConfig } from "./components";
import { useMixedMenu } from "./hooks";
import { LayoutStoreProvider } from "./store";
import * as styles from "./styles";

export function Layout({
  title,
  logo,
  headerActions,
  userMenuItems,
  onUserMenuClick,
  onLogout,
  apps,
  currentAppId,
  onAppChange,
  children
}: LayoutProps) {
  const isSidebarCollapsed = useThemeStore(state => state.isSidebarCollapsed);
  const isMainContentMaximum = useThemeStore(state => state.isMainContentMaximum);
  const isTabsVisible = useThemeStore(state => state.isTabsVisible);
  const menuLayout = useThemeStore(state => state.menuLayout);
  const isDarkSidebar = useThemeStore(state => state.isDarkSidebar);
  // The dark sidebar is a vertical-only treatment: the other layouts keep the
  // light sidebar regardless of the toggle.
  const isSidebarDark = isDarkSidebar && menuLayout === "vertical";
  const { sectionItems, hasSectionMenu } = useMixedMenu();
  // The collapse toggle only makes sense when a collapsible sidebar exists: always in vertical, and
  // in mixed only when the active section has a submenu.
  const showMenuBurger = menuLayout === "vertical" || (menuLayout === "mixed" && hasSectionMenu);
  const sidebarProps = useMemo(() => {
    if (menuLayout === "horizontal") {
      return {};
    }

    if (menuLayout === "mixed") {
      if (!hasSectionMenu) {
        return {};
      }

      return {
        isSidebarCollapsed,
        isSidebarBelowHeader: true,
        sidebar: (
          <Sidebar
            isSidebarCollapsed={isSidebarCollapsed}
            items={sectionItems}
            showLogo={false}
          />
        )
      };
    }

    // Vertical: the sidebar owns the full height (logo on top), and the header
    // starts beside it instead of spanning the viewport.
    return {
      isSidebarCollapsed,
      sidebar: (
        <Sidebar
          isDark={isSidebarDark}
          isSidebarCollapsed={isSidebarCollapsed}
          logo={logo}
          title={title}
        />
      )
    };
  }, [isSidebarCollapsed, menuLayout, hasSectionMenu, sectionItems, logo, title, isSidebarDark]);

  useEffect(() => {
    const query = globalThis.matchMedia(`(max-width: ${breakpoints.md})`);

    function handleChange(event: MediaQueryListEvent): void {
      if (event.matches) {
        const { isSidebarCollapsed } = useThemeStore.getState();

        if (!isSidebarCollapsed) {
          useThemeStore.setState(state => {
            state.isSidebarCollapsed = true;
          });
        }
      }
    }

    query.addEventListener("change", handleChange);

    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);

  return (
    <LayoutStoreProvider>
      <ClassNames>
        {({ css }) => (
          <BaseLayout
            // footer={<Footer />}
            isMainContentMaximum={isMainContentMaximum}
            sidebarClassName={css(styles.sidebar, isSidebarDark && styles.sidebarDark)}
            tabs={isTabsVisible ? <Tabs /> : undefined}
            header={(
              <Header
                apps={apps}
                currentAppId={currentAppId}
                headerActions={headerActions}
                logo={logo}
                showMenuBurger={showMenuBurger}
                title={title}
                userMenuItems={userMenuItems}
                onAppChange={onAppChange}
                onLogout={onLogout}
                onUserMenuClick={onUserMenuClick}
              />
            )}
            {...sidebarProps}
          >
            {children}
            <ThemeConfig />
            <Search />
          </BaseLayout>
        )}
      </ClassNames>
    </LayoutStoreProvider>
  );
}

export { type AppItem, type LayoutProps, type UserMenuItem } from "./props";
