import type { Except } from "@vef-framework-react/shared";

import type { ButtonProps } from "../../button";

import { useDisabled } from "@vef-framework-react/core";

import { Button } from "../../button";
import { useFormContext } from "../contexts";

export interface SubmitButtonProps extends Except<ButtonProps, "htmlType" | "onClick" | "onClickCapture"> {
  onSubmit?: () => void;
}

export function SubmitButton({
  children = "提交",
  disabled: buttonDisabled,
  loading: buttonLoading,
  onSubmit,
  ...props
}: SubmitButtonProps) {
  const { Subscribe } = useFormContext();
  const contextDisabled = useDisabled();

  return (
    <Subscribe selector={state => [!state.canSubmit, state.isSubmitting] as const}>
      {([disabled, loading]) => {
        const isLoading = loading || buttonLoading;
        const isDisabled = contextDisabled || disabled || buttonDisabled;

        return (
          <Button
            {...props}
            disabled={isLoading ? false : isDisabled}
            htmlType="submit"
            loading={isLoading}
            type="primary"
            onClick={onSubmit}
          >
            {children}
          </Button>
        );
      }}
    </Subscribe>
  );
}
