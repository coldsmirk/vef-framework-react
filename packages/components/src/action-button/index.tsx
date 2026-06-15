import type { ButtonProps } from "../button";
import type { ActionButtonProps } from "./props";

import { CheckIcon } from "lucide-react";

import { Button } from "../button";
import { Icon } from "../icon";
import { Popconfirm } from "../popconfirm";
import { useActionButton } from "./use-action-button";

const okButtonProps: ButtonProps = {
  variant: "filled",
  color: "primary",
  icon: <Icon component={CheckIcon} />
};

const cancelButtonProps: ButtonProps = {
  variant: "text",
  color: "default"
};

export function ActionButton({
  confirmable = false,
  confirmMode = "popover",
  confirmTitle = "确认提示",
  confirmDescription = "确定要执行此操作吗？",
  onClick,
  ...props
}: ActionButtonProps) {
  const {
    loading,
    invokeClickAction,
    handleClick
  } = useActionButton({
    confirmable,
    confirmMode,
    confirmTitle,
    confirmDescription,
    onClick
  });

  const buttonNode = (
    <Button
      {...props}
      loading={loading}
      onClick={handleClick}
    />
  );

  if (confirmable && confirmMode === "popover") {
    return (
      <Popconfirm
        cancelButtonProps={cancelButtonProps}
        description={confirmDescription}
        okButtonProps={okButtonProps}
        title={confirmTitle}
        onConfirm={event => void invokeClickAction(event!)}
      >
        {buttonNode}
      </Popconfirm>
    );
  }

  return buttonNode;
}

export { type ActionButtonProps } from "./props";
