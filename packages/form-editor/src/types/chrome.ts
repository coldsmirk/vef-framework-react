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
  /**
   * The subform field's own validation errors — e.g. "at least one row" on a
   * required subform. Rendered under the body; per-cell errors render inside
   * each row field directly.
   */
  errors?: string[];
  children: ReactNode;
}

export interface SubformRowChromeProps {
  /**
   * Optional row-header title rendered above the row body (used by fixed-row
   * subforms in `stack` variant and on mobile, where each item renders as a
   * card titled by its snapshotted item label).
   */
  header?: ReactNode;
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
