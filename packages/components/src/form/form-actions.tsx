import type { Except } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { ResetButtonProps, SubmitButtonProps } from "./components";

import { CheckIcon } from "lucide-react";
import { memo, useCallback } from "react";

import { Icon } from "../icon";
import { useFormContext } from "./form";

export interface FormActionsProps {
  /**
   * Submit button props
   */
  submitButtonProps?: Except<SubmitButtonProps, "onSubmit" | "disabled" | "loading">;
  /**
   * Reset button props, or false to hide the reset button
   */
  resetButtonProps?: Except<ResetButtonProps, "onReset" | "disabled" | "loading"> | false;
  /**
   * Callback when reset is triggered
   */
  onReset?: () => void;
}

const submitIcon = <Icon component={CheckIcon} />;

const defaultSubmitButtonProps: FormActionsProps["submitButtonProps"] = {
  children: "提交",
  icon: submitIcon
};

const defaultResetButtonProps: FormActionsProps["resetButtonProps"] = {
  children: "重置"
};

/**
 * Default submit button that connects to the form context.
 */
function DefaultSubmitButtonBase({
  submitButtonProps = defaultSubmitButtonProps
}: Pick<FormActionsProps, "submitButtonProps">): ReactNode {
  const form = useFormContext();

  return (
    <form.SubmitButton
      {...submitButtonProps}
      onSubmit={form.handleSubmit}
    />
  );
}

export const DefaultSubmitButton = memo(DefaultSubmitButtonBase);
DefaultSubmitButton.displayName = "DefaultSubmitButton";

/**
 * Default reset button that connects to the form context.
 */
function DefaultResetButtonBase({
  resetButtonProps = defaultResetButtonProps,
  onReset
}: Pick<FormActionsProps, "resetButtonProps" | "onReset">): ReactNode {
  const form = useFormContext();

  const handleReset = useCallback(() => {
    form.reset();
    onReset?.();
  }, [form, onReset]);

  if (!resetButtonProps) {
    return null;
  }

  return (
    <form.ResetButton
      {...resetButtonProps}
      onReset={handleReset}
    />
  );
}

export const DefaultResetButton = memo(DefaultResetButtonBase);
DefaultResetButton.displayName = "DefaultResetButton";

/**
 * Pre-wired submit + reset button group for form modals and drawers.
 */
function FormActionsBase({
  submitButtonProps = defaultSubmitButtonProps,
  resetButtonProps = defaultResetButtonProps,
  onReset
}: FormActionsProps): ReactNode {
  return (
    <>
      <DefaultResetButton resetButtonProps={resetButtonProps} onReset={onReset} />
      <DefaultSubmitButton submitButtonProps={submitButtonProps} />
    </>
  );
}

export const FormActions = memo(FormActionsBase);
FormActions.displayName = "FormActions";
