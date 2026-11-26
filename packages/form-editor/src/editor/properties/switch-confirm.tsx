import type { PopconfirmProps } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import { Popconfirm } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";

const OK_BUTTON_PROPS = {
  autoInsertSpace: false,
  icon: <EditorIcon name="arrow-left-right" />
} as const;

const CANCEL_BUTTON_PROPS = {
  autoInsertSpace: false
} as const;

export type SwitchConfirmProps = Pick<PopconfirmProps, "children" | "onCancel" | "onConfirm" | "open" | "title">;

/**
 * The designer's confirmation before a switch that discards what was
 * configured (a source kind, a row mode, a trigger, visual ⇄ expression): one
 * popover whose act reads 切换 with its icon everywhere.
 */
export function SwitchConfirm({
  children,
  onCancel,
  onConfirm,
  open,
  title
}: SwitchConfirmProps): ReactElement {
  return (
    <Popconfirm
      cancelButtonProps={CANCEL_BUTTON_PROPS}
      cancelText="取消"
      okButtonProps={OK_BUTTON_PROPS}
      okText="切换"
      open={open}
      title={title}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {children}
    </Popconfirm>
  );
}
