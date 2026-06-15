import type { LayoutProps } from "../../props";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { useThemeStore } from "../../../../stores";
import { Logo } from "../logo";
import { Menu } from "../menu";
import { AppSwitcher } from "./app-switcher";
import { ColorScheme } from "./color-scheme";
import { Fullscreen } from "./fullscreen";
import { HeaderPattern } from "./header-pattern";
import { MenuBurger } from "./menu-burger";
import { MixedMenu } from "./mixed-menu";
import { Search } from "./search";
import { ThemeConfig } from "./theme-config";
import { UserAvatar } from "./user-avatar";

interface HeaderProps extends Pick<LayoutProps, "title" | "logo" | "headerActions" | "userMenuItems" | "onUserMenuClick" | "onLogout" | "apps" | "currentAppId" | "onAppChange"> {
  /**
   * Whether to show the sidebar collapse toggle. True when a collapsible sidebar exists
   * (vertical always; mixed only when the active section has a submenu).
   */
  showMenuBurger: boolean;
}

// A faint diagonal brand gradient + a soft top-right sheen. Endpoints derive from the consumer's
// primary (via color-mix) so it adapts to any brand color, and the deltas are small so it reads as
// gentle depth rather than a two-tone band.
const headerGradientLight = [
  "radial-gradient(100% 140% at 92% 0%, rgba(255, 255, 255, 0.16), transparent 46%)",
  "linear-gradient(102deg, color-mix(in srgb, var(--vef-color-primary) 78%, #ffffff) 0%, var(--vef-color-primary) 48%, color-mix(in srgb, var(--vef-color-primary) 60%, #4f46e5) 100%)"
].join(", ");

const headerGradientDark = [
  "radial-gradient(100% 140% at 92% 0%, rgba(255, 255, 255, 0.06), transparent 48%)",
  "linear-gradient(102deg, color-mix(in srgb, var(--vef-color-primary) 40%, var(--vef-color-bg-container)) 0%, color-mix(in srgb, var(--vef-color-primary) 11%, var(--vef-color-bg-container)) 100%)"
].join(", ");

const headerBaseStyle = css({
  position: "relative",
  zIndex: 2,
  height: "100%",
  display: "flex",
  alignItems: "center",
  paddingInline: globalCssVars.spacingMd
});

// Vertical layout: the sidebar is the single navigation anchor, so the header
// joins the content world — a quiet container surface behind a hairline seam.
// Foreground colors stay at their antd defaults (and adapt to dark mode).
const neutralSurfaceStyle = css({
  background: globalCssVars.colorBgContainer,
  borderBlockEnd: `${globalCssVars.lineWidth} ${globalCssVars.lineType} ${globalCssVars.colorBorderSecondary}`
});

// Horizontal / mixed layouts: the menu rides in the header, which carries the
// brand surface and cascades a white-on-color foreground onto its children.
const brandSurfaceStyle = css({
  background: headerGradientLight,
  color: "var(--vef-color-white)",

  // Dark mode: the vivid primary bar vibrates against the near-black canvas (it renders ~3x brighter
  // than the layout and is the only highly-saturated field). Dim + desaturate it into a deep brand
  // surface by mixing the primary into the dark container — the white-on-color foreground system
  // (logo invert, menu/button tokens) stays valid because the bar is still a dark colored surface.
  "html.dark &": {
    background: headerGradientDark
  },

  // Cascade a light foreground onto antd children that read these alias vars.
  "--vef-color-text": "var(--vef-color-white)",
  "--vef-color-text-secondary": "rgba(255, 255, 255, 0.82)",
  "--vef-color-text-tertiary": "rgba(255, 255, 255, 0.6)",
  "--vef-color-text-quaternary": "rgba(255, 255, 255, 0.45)",
  "--vef-color-text-description": "rgba(255, 255, 255, 0.7)",
  "--vef-color-icon": "rgba(255, 255, 255, 0.85)",
  "--vef-color-icon-hover": "var(--vef-color-white)",
  "--vef-color-split": "rgba(255, 255, 255, 0.18)",
  "--vef-color-border": "rgba(255, 255, 255, 0.25)",
  "--vef-color-border-secondary": "rgba(255, 255, 255, 0.15)",
  "--vef-color-fill-tertiary": "rgba(255, 255, 255, 0.16)",
  "--vef-color-fill-secondary": "rgba(255, 255, 255, 0.22)",
  "--vef-color-fill-quaternary": "rgba(255, 255, 255, 0.1)",

  // Explicit fallbacks for components that bake their own color vars.
  "& .vef-btn": {
    color: "var(--vef-color-white)"
  },
  // antd paints the text button's hover/active background from a component token
  // (`.vef-btn:hover { background: var(--vef-btn-bg-color-hover) }`), and cssVar mode re-declares
  // that token on the button's own element — so an ancestor override never reaches it. Redefine
  // the token on the button itself; antd's own state rules then paint our fill, with no `:hover`
  // selector to restate. The `vef` layer outranks antd (no `!important`), and a light fill reads
  // clearly on the dark header.
  "& .vef-btn-text": {
    "--vef-btn-bg-color-hover": "rgba(255, 255, 255, 0.18)",
    "--vef-btn-bg-color-active": "rgba(255, 255, 255, 0.28)"
  },
  // The top menu rides on the primary-colored header. Drive antd's own horizontal Menu tokens
  // (exposed as cssVars) so a leaf item and a parent submenu render as one consistent pill: the
  // selected/hover fill, radius, padding, and the removal of antd's underline + 3px offset hack all
  // come from tokens — not from fighting antd's output. antd applies these to `> item, > submenu`
  // uniformly, so leaf and parent align by construction.
  "& .vef-menu": {
    // Horizontal bar fills the header.
    height: "100%",
    flex: "auto",
    "--vef-menu-horizontal-line-height": "var(--vef-layout-header-height)",
    "--vef-menu-active-bar-height": "0",
    "--vef-menu-active-bar-border-width": "0",
    "--vef-menu-item-padding-inline": "12px",
    "--vef-menu-horizontal-item-border-radius": "10px",
    // Foreground: default 72% white → full white on hover/selected (leaf via horizontal token,
    // parent submenu via subMenu token — antd colors the submenu title from a different token).
    "--vef-menu-item-color": "rgba(255, 255, 255, 0.72)",
    "--vef-menu-item-hover-color": "var(--vef-color-white)",
    "--vef-menu-horizontal-item-selected-color": "var(--vef-color-white)",
    "--vef-menu-sub-menu-item-selected-color": "var(--vef-color-white)",
    // Fills: subtle on hover, stronger pill when selected.
    "--vef-menu-horizontal-item-hover-bg": "rgba(255, 255, 255, 0.1)",
    "--vef-menu-horizontal-item-selected-bg": "rgba(255, 255, 255, 0.18)",

    // antd has no token to float a horizontal item or bolden the active one — the only CSS left.
    // Half the gap per side gives an even var(--vef-spacing-sm) between every pill (leaf or submenu).
    "& .vef-menu-item, & .vef-menu-submenu": {
      height: "calc(var(--vef-layout-header-height) - 16px)",
      marginBlock: "8px",
      marginInline: "calc(var(--vef-spacing-sm) / 2)",
      lineHeight: "calc(var(--vef-layout-header-height) - 16px)"
    },
    "& .vef-menu-item-selected, & .vef-menu-submenu-selected": {
      fontWeight: 600
    }
  }
});

const logoStyle = css({
  flex: "none",
  // Grow with the logo + title content, but never narrower than the expanded sidebar (minus the
  // header's own inline padding) so the logo lines up with it — independent of the collapse state.
  width: "max-content",
  minWidth: "calc(var(--vef-layout-sidebar-expanded-width) - var(--vef-spacing-md))",
  paddingInlineEnd: globalCssVars.spacingMd
});

const menuBurgerStyle = css({
  flex: "none"
});

const appSwitcherStyle = css({
  flex: "none"
});

const navigationStyle = css({
  height: "100%",
  display: "flex",
  alignItems: "center",
  flex: "auto",
  minWidth: 0
});

const actionsStyle = css({
  height: "100%",
  display: "flex",
  alignItems: "center",
  flex: "none",
  columnGap: "4px"
});

export function Header({
  title,
  logo,
  headerActions,
  userMenuItems,
  onUserMenuClick,
  onLogout,
  apps,
  currentAppId,
  onAppChange,
  showMenuBurger
}: HeaderProps) {
  const menuLayout = useThemeStore(state => state.menuLayout);
  const isBrandSurface = menuLayout !== "vertical";

  const navigation = menuLayout === "horizontal"
    ? <Menu layout="horizontal" />
    : menuLayout === "mixed"
      ? <MixedMenu />
      : null;

  return (
    <div css={[headerBaseStyle, isBrandSurface ? brandSurfaceStyle : neutralSurfaceStyle]}>
      {/* The decorative caps belong to the brand surface; on the neutral one they would read as smudges. */}
      {isBrandSurface && <HeaderPattern />}
      {/* Vertical layout puts the logo at the top of the full-height sidebar instead. */}
      {isBrandSurface && <Logo inverted css={logoStyle} logo={logo} title={title} />}
      {showMenuBurger && <MenuBurger css={menuBurgerStyle} />}

      {apps?.length
        ? (
            <AppSwitcher
              apps={apps}
              css={appSwitcherStyle}
              currentAppId={currentAppId}
              onAppChange={onAppChange}
            />
          )
        : null}

      <div css={navigationStyle}>
        {navigation}
      </div>

      <div css={actionsStyle}>
        <Search />
        <Fullscreen />
        <ColorScheme />
        <ThemeConfig />
        {headerActions}

        <UserAvatar
          userMenuItems={userMenuItems}
          onLogout={onLogout}
          onUserMenuClick={onUserMenuClick}
        />
      </div>
    </div>
  );
}
