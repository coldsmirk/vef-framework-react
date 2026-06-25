import type { JSX } from "react";

import type { BaseLayoutProps } from "./props";

import * as styles from "./styles";
import { useBaseLayout } from "./use-base-layout";

export function BaseLayout(props: BaseLayoutProps): JSX.Element {
  const {
    isHeaderVisible,
    isTabsVisible,
    isSidebarVisible,
    isFooterVisible,
    cssVars
  } = useBaseLayout(props);

  const {
    header,
    headerClassName,
    tabs,
    tabsClassName,
    sidebar,
    sidebarClassName,
    isSidebarBelowHeader = false,
    footer,
    footerClassName,
    className,
    children
  } = props;

  const headerStyles = isSidebarVisible && !isSidebarBelowHeader
    ? [styles.header, styles.sidebarGap]
    : [styles.header];

  const sidebarStyles = isSidebarBelowHeader
    ? [styles.sidebar, styles.sidebarBelowHeader]
    : [styles.sidebar];

  const tabsStyles = isSidebarVisible
    ? [styles.tabs, styles.sidebarGap]
    : [styles.tabs];

  const mainStyles = isSidebarVisible
    ? [styles.main, styles.sidebarGap]
    : styles.main;

  const footerStyles = isSidebarVisible
    ? [styles.footer, styles.sidebarGap]
    : [styles.footer];

  return (
    <div css={styles.layout} style={cssVars}>
      {isHeaderVisible && (
        <header className={headerClassName} css={headerStyles}>
          {header}
        </header>
      )}

      {isTabsVisible && (
        <section className={tabsClassName} css={tabsStyles}>
          {tabs}
        </section>
      )}

      {isSidebarVisible && (
        <aside className={sidebarClassName} css={sidebarStyles}>
          {sidebar}
        </aside>
      )}

      <main className={className} css={mainStyles}>
        {children}
      </main>

      {isFooterVisible && (
        <footer className={footerClassName} css={footerStyles}>
          {footer}
        </footer>
      )}
    </div>
  );
}

export { type BaseLayoutProps } from "./props";
