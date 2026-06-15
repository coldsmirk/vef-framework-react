import type { FC, ReactNode } from "react";

/**
 * One tab in the {@link ContainerChromeSet.Tabs} chrome — the device-agnostic
 * shape the renderer builds from a `tabs` node's panes.
 */
export interface ChromeTabItem {
  key: string;
  label: ReactNode;
  children: ReactNode;
}

export interface SectionChromeProps {
  title?: ReactNode;
  variant?: "card" | "collapse";
  defaultCollapsed?: boolean;
  children: ReactNode;
}

export interface TabsChromeProps {
  items: ChromeTabItem[];
  activeKey?: string;
  onChange?: (key: string) => void;
}

export interface SubformChromeProps {
  title?: ReactNode;
  children: ReactNode;
}

export interface SubformRowChromeProps {
  removeControl?: ReactNode;
  children: ReactNode;
}

export interface AddControlChromeProps {
  label: ReactNode;
  onClick: () => void;
}

export interface RemoveControlChromeProps {
  onClick: () => void;
}

/**
 * The per-device presentational shells for structural containers, resolved off
 * the active {@link FormFieldRegistry}. Each renders chrome only — the runtime
 * renderer and the editor canvas keep recursion, value binding, linkage, and
 * array handlers, passing already-built bodies in as `children`. `flex` / `grid`
 * are pure CSS layout, identical across devices, and intentionally absent.
 */
export interface ContainerChromeSet {
  Section: FC<SectionChromeProps>;
  Tabs: FC<TabsChromeProps>;
  Subform: FC<SubformChromeProps>;
  SubformRow: FC<SubformRowChromeProps>;
  AddButton: FC<AddControlChromeProps>;
  RemoveButton: FC<RemoveControlChromeProps>;
}
