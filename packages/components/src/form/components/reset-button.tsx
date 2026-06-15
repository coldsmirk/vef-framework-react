import type { Except } from "@vef-framework-react/shared";

import type { ButtonProps } from "../../button";

import { useDisabled } from "@vef-framework-react/core";

import { Button } from "../../button";
import { useFormContext } from "../contexts";

export interface ResetButtonProps extends Except<ButtonProps, "htmlType" | "onClick" | "onClickCapture"> {
  onReset?: () => void;
}

export function ResetButton({
  children = "重置",
  disabled,
  loading,
  onReset,
  ...props
}: ResetButtonProps) {
  const { Subscribe } = useFormContext();
  const contextDisabled = useDisabled();

  return (
    <Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => {
        const isDisabled = contextDisabled || disabled || isSubmitting;

        return (
          <Button
            {...props}
            disabled={loading ? false : isDisabled}
            htmlType="reset"
            loading={loading}
            onClick={onReset}
          >
            {children}
          </Button>
        );
      }}
    </Subscribe>
  );
}
