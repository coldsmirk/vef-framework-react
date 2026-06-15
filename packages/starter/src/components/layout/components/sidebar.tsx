import type { MenuItem } from "@vef-framework-react/components";

import type { LayoutProps } from "../props";

import { ClassNames, css } from "@emotion/react";
import { ScrollArea } from "@vef-framework-react/components";

import { ContourPattern } from "./contour-pattern";
import { Logo } from "./logo";
import { Menu } from "./menu";

interface SidebarProps extends Pick<LayoutProps, "logo" | "title"> {
  /**
   * Whether the sidebar renders on the dark brand surface (vertical layout
   * only). Adds the contour artwork at the bottom; the surface itself is
   * styled by the layout's `sidebarDark` class.
   */
  isDark?: boolean;
  isSidebarCollapsed?: boolean;
  /**
   * Menu items to render. Defaults to the full tree from the app store.
   */
  items?: readonly MenuItem[];
  /**
   * Whether to render the logo. Disabled in mixed layout (logo is in the header).
   */
  showLogo?: boolean;
}

const logoStyle = css({
  flex: "none",
  height: "var(--vef-layout-header-height)"
});

const menuWrapperStyle = css({
  flex: "auto"
});

// A diagonal brand gradient from a light tint of the primary down to the primary itself, so the
// active pill reads with depth instead of a flat block — overall a touch lighter than solid primary,
// with a clearly visible sweep. Endpoints derive from the primary via color-mix, so it tracks the
// theme color and works on both the light and dark sidebar (white label/icon stay readable).
const selectedPillGradient = "linear-gradient(120deg, color-mix(in srgb, var(--vef-color-primary) 72%, #ffffff) 0%, var(--vef-color-primary) 100%)";

// The inline (side) menu's geometry and active pill live here — scoped to the sidebar so they
// never leak onto the top (horizontal) menu, which shares the same Menu component.
const menuContainerStyle = css({
  paddingInline: "2px",

  "& .vef-menu-root": {
    "--vef-menu-collapsed-width": "calc(var(--vef-layout-sidebar-width) - 4px)",
    "--vef-menu-item-height": "48px",
    "--vef-menu-item-margin-inline": "var(--vef-spacing-sm)",
    "--vef-menu-item-margin-block": "var(--vef-spacing-sm)",
    "--vef-menu-item-width": "calc(100% - var(--vef-menu-item-margin-inline) * 2)",

    // The first child sits right under its submenu title — no top margin needed.
    "& .vef-menu-sub > .vef-menu-item:first-of-type": {
      marginBlockStart: "0"
    },
    // A submenu's last child would otherwise stack a doubled gap with the following top-level item,
    // so flatten its bottom margin — but only when something follows the submenu. The menu's last
    // submenu keeps it: that margin is the sole breathing room beneath the final item.
    "& .vef-menu-submenu:not(:last-child) > .vef-menu-sub > .vef-menu-item:last-of-type": {
      marginBlockEnd: "0"
    }
  },
  // Collapsed items are icon-only — square the active pill (height tracks the margin-derived width)
  // instead of leaving a tall slab.
  "& .vef-menu-root.vef-menu-inline-collapsed": {
    "--vef-menu-item-height": "calc(var(--vef-menu-collapsed-width) - var(--vef-menu-item-margin-inline) * 2)"
  },
  "& .vef-menu-inline": {
    // Neutral hover so it never reads like the active item.
    "& .vef-menu-item:hover, & .vef-menu-submenu-title:hover": {
      backgroundColor: "var(--vef-color-fill-tertiary)"
    },
    // Gradient brand pill for the active page, echoing the header — softer than a flat block.
    "& .vef-menu-item-selected": {
      color: "var(--vef-color-white)",
      background: selectedPillGradient,

      "& .vef-menu-item-icon": {
        color: "var(--vef-color-white)"
      },
      "& .vef-menu-title-content": {
        fontWeight: 600
      }
    },
    // Keep the same gradient when hovering the active item (don't fall back to the neutral hover).
    "& .vef-menu-item-selected:hover": {
      background: selectedPillGradient
    }
  }
});

export function Sidebar({
  isDark = false,
  isSidebarCollapsed,
  logo,
  title,
  items,
  showLogo = true
}: SidebarProps): React.JSX.Element {
  return (
    <>
      {isDark && <ContourPattern isSidebarCollapsed={isSidebarCollapsed} />}

      {showLogo && (
        <Logo
          css={logoStyle}
          isTitleVisible={!isSidebarCollapsed}
          logo={logo}
          title={title}
        />
      )}

      <ClassNames>
        {({ css }) => (
          <ScrollArea
            css={menuWrapperStyle}
            scrollbarSize={8}
            type="scroll"
            viewportClassName={css(menuContainerStyle)}
          >
            <Menu isSidebarCollapsed={isSidebarCollapsed} items={items} layout="vertical" />
          </ScrollArea>
        )}
      </ClassNames>
    </>
  );
}
