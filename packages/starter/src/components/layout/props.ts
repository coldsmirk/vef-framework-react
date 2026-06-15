import type { DropdownMenuItem } from "@vef-framework-react/components";
import type { Awaitable, DistributedOmit } from "@vef-framework-react/shared";
import type { PropsWithChildren, ReactNode } from "react";

/**
 * A {@link DropdownMenuItem} with `onClick` / `onTitleClick` stripped — clicks
 * on user menu items are always routed through `LayoutProps.onUserMenuClick`
 * by item key, so per-item handlers would be silently ignored.
 */
export type UserMenuItem = DistributedOmit<DropdownMenuItem, "onClick" | "onTitleClick">;

/**
 * A selectable sub-application shown in the Layout's app switcher. Shaped as a
 * plain record so it can be hydrated straight from an API response (no JSX).
 */
export interface AppItem {
  /**
   * Stable identifier, handed back to {@link LayoutProps.onAppChange}.
   */
  id: string;
  /**
   * Display name.
   */
  name: string;
  /**
   * Optional one-line description (e.g. shown as a tooltip).
   */
  description?: string;
  /**
   * Optional icon name, resolved through `DynamicIcon` (a kebab-case lucide
   * name such as `"layout-dashboard"`). A string, not a node, so it survives a
   * JSON round-trip from the backend.
   */
  icon?: string;
}

/**
 * The props for the Layout component.
 */
export interface LayoutProps extends PropsWithChildren {
  /**
   * The title of the layout.
   */
  title?: ReactNode;
  /**
   * The logo of the layout.
   */
  logo?: ReactNode;
  /**
   * The actions of the header.
   */
  headerActions?: ReactNode;
  /**
   * Extra items appended to the user dropdown menu. They render before the
   * built-in items (e.g. logout), with an automatic divider in between.
   */
  userMenuItems?: UserMenuItem[];
  /**
   * Handles clicks on user menu items. The built-in `logout` key is owned by
   * the framework and never forwarded; all other keys are delivered here.
   */
  onUserMenuClick?: (key: string) => void;
  /**
   * The logout api function.
   */
  onLogout?: () => Awaitable<void>;
  /**
   * Sub-applications the user can switch between. When non-empty, an app
   * switcher appears next to the logo. Each system supplies its own apps —
   * the framework only renders the control and reports the selection.
   */
  apps?: AppItem[];
  /**
   * The id of the currently active app, highlighted in the switcher.
   */
  currentAppId?: string;
  /**
   * Called when the user picks a different app. The project performs the
   * actual switch (e.g. persist the choice, then reload or re-route the shell).
   */
  onAppChange?: (appId: string) => Awaitable<void>;
}
