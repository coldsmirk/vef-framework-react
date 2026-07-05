import type { ComponentType, FC, ReactNode } from "react";

import type { FieldComponentProps } from "../types";

import { Form } from "antd";

import { useFieldContext } from "../contexts";
import { useFormItemProps } from "../hooks/use-form-item-props";

function getValidateStatus(isValidating: boolean, isValid: boolean): "validating" | "error" | undefined {
  if (isValidating) {
    return "validating";
  }

  if (!isValid) {
    return "error";
  }

  return undefined;
}

function normalizeValidationMessage(error: unknown): ReactNode {
  if (error === null || error === undefined || error === false) {
    return null;
  }

  if (typeof error === "object" && "message" in error) {
    return (error as { message?: ReactNode }).message ?? null;
  }

  return String(error);
}

function getFirstErrorMessage(errors: unknown[]): ReactNode {
  for (const error of errors) {
    const message = normalizeValidationMessage(error);

    if (message) {
      return message;
    }
  }

  return null;
}

export function withFormItem<TFieldProps>(
  displayName: string,
  PureField: ComponentType<TFieldProps>
): FC<FieldComponentProps<TFieldProps>> {
  function FieldComponent({
    layout,
    label,
    labelAlign,
    labelWidth,
    extra,
    noWrapper,
    required,
    ...fieldProps
  }: FieldComponentProps<TFieldProps>) {
    const formItemProps = useFormItemProps({
      layout,
      label,
      labelAlign,
      labelWidth,
      extra,
      required,
      noWrapper
    });

    const { state } = useFieldContext();
    const {
      errors,
      isValid,
      isValidating
    } = state.meta;
    const errorMessage = getFirstErrorMessage(errors);

    return (
      <Form.Item
        {...formItemProps}
        hasFeedback={isValidating}
        help={errorMessage}
        validateStatus={getValidateStatus(isValidating, isValid)}
      >
        <PureField {...(fieldProps as any)} />
      </Form.Item>
    );
  }

  FieldComponent.displayName = displayName;
  return FieldComponent;
}
