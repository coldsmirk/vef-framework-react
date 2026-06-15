import type { DynamicIconName, DynamicIconProps } from "@vef-framework-react/components";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import { DynamicIcon, Icon } from "@vef-framework-react/components";
import {
  BracesIcon,
  CalendarIcon,
  CalendarRangeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleDotIcon,
  CircleHelpIcon,
  CircleXIcon,
  ClipboardListIcon,
  ClockIcon,
  Code2Icon,
  CodeIcon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  FolderPlusIcon,
  GitBranchIcon,
  GripVerticalIcon,
  HashIcon,
  InfoIcon,
  LayoutGridIcon,
  LayoutListIcon,
  LayoutPanelTopIcon,
  Link2Icon,
  ListChecksIcon,
  ListTreeIcon,
  MinusIcon,
  MonitorIcon,
  MousePointer2Icon,
  MousePointerClickIcon,
  PaletteIcon,
  PilcrowIcon,
  PlusIcon,
  Redo2Icon,
  RocketIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
  SquareIcon,
  SquarePenIcon,
  StretchHorizontalIcon,
  TableIcon,
  TextIcon,
  ToggleLeftIcon,
  Trash2Icon,
  TriangleAlertIcon,
  TypeIcon,
  Undo2Icon,
  UploadIcon,
  XIcon
} from "lucide-react";

/**
 * Static catalog of every icon the editor's chrome and the built-in field /
 * container definitions reference. These names are all known at build time, so
 * resolving them here keeps the icons as ordinary tree-shaken imports in the
 * main bundle. The previous per-icon dynamic `import()` paid a network round
 * trip per glyph and thrashed Vite's dep optimizer (504s on first paint).
 *
 * Names not in this map (e.g. a custom icon on a downstream-registered field)
 * fall back to {@link DynamicIcon} — the only case that genuinely needs runtime
 * resolution.
 */
const STATIC_ICONS: Partial<Record<DynamicIconName, LucideIcon>> = {
  braces: BracesIcon,
  calendar: CalendarIcon,
  "calendar-range": CalendarRangeIcon,
  "chevron-down": ChevronDownIcon,
  "chevron-right": ChevronRightIcon,
  "chevron-up": ChevronUpIcon,
  "circle-dot": CircleDotIcon,
  "circle-help": CircleHelpIcon,
  "circle-x": CircleXIcon,
  "clipboard-list": ClipboardListIcon,
  clock: ClockIcon,
  code: CodeIcon,
  "code-2": Code2Icon,
  copy: CopyIcon,
  database: DatabaseIcon,
  download: DownloadIcon,
  ellipsis: EllipsisIcon,
  eye: EyeIcon,
  "folder-plus": FolderPlusIcon,
  "git-branch": GitBranchIcon,
  "grip-vertical": GripVerticalIcon,
  hash: HashIcon,
  info: InfoIcon,
  "layout-grid": LayoutGridIcon,
  "layout-list": LayoutListIcon,
  "layout-panel-top": LayoutPanelTopIcon,
  "link-2": Link2Icon,
  "list-checks": ListChecksIcon,
  "list-tree": ListTreeIcon,
  minus: MinusIcon,
  monitor: MonitorIcon,
  "mouse-pointer-2": MousePointer2Icon,
  "mouse-pointer-click": MousePointerClickIcon,
  palette: PaletteIcon,
  pilcrow: PilcrowIcon,
  plus: PlusIcon,
  "redo-2": Redo2Icon,
  rocket: RocketIcon,
  search: SearchIcon,
  "settings-2": Settings2Icon,
  "shield-check": ShieldCheckIcon,
  "sliders-horizontal": SlidersHorizontalIcon,
  smartphone: SmartphoneIcon,
  square: SquareIcon,
  "square-pen": SquarePenIcon,
  "stretch-horizontal": StretchHorizontalIcon,
  table: TableIcon,
  text: TextIcon,
  "toggle-left": ToggleLeftIcon,
  "trash-2": Trash2Icon,
  "triangle-alert": TriangleAlertIcon,
  type: TypeIcon,
  "undo-2": Undo2Icon,
  upload: UploadIcon,
  x: XIcon
};

/**
 * Renders a Lucide icon by name. Statically-known names (the common case) render
 * synchronously from {@link STATIC_ICONS}; unknown names degrade to the async
 * {@link DynamicIcon}. Drop-in replacement for `DynamicIcon` across the editor.
 */
export function EditorIcon({ name, ...props }: DynamicIconProps): ReactElement {
  const component = STATIC_ICONS[name];

  if (component) {
    return <Icon component={component} {...props} />;
  }

  return <DynamicIcon name={name} {...props} />;
}
