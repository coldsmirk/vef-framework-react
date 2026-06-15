import type { ComponentPropsWithoutRef, ElementType, SubmitEvent, SyntheticEvent } from "react";

import type { FormLayout } from "../contexts";
import type { FormItemProps } from "../types";

import { DisabledProvider } from "@vef-framework-react/core";
import { useMemo } from "react";

import { defaultFormLayout, FormLayoutProvider, useFormContext } from "../contexts";

interface FormOwnProps extends Pick<FormItemProps, "layout" | "labelAlign" | "labelWidth"> {
  /**
   * Whether the form is disabled.
   */
  disabled?: boolean;
}

/**
 * Polymorphic props for the Form component.
 * Extra props are inferred from the `component` element type.
 *
 * @template TComponent - The element type to render, defaults to `"form"`.
 */
export type FormProps<TComponent extends ElementType = "form">
  = FormOwnProps
    & { component?: TComponent }
    & Omit<ComponentPropsWithoutRef<TComponent>, keyof FormOwnProps | "component" | "onSubmit" | "onSubmitCapture">;

export function Form<TComponent extends ElementType = "form">({
  layout = defaultFormLayout.layout,
  labelAlign = defaultFormLayout.labelAlign,
  labelWidth = defaultFormLayout.labelWidth,
  disabled = false,
  component,
  children,
  ...props
}: FormProps<TComponent>) {
  const Component = component ?? "form";
  const { handleSubmit, reset } = useFormContext();

  const formLayout = useMemo<FormLayout>(
    () => {
      return {
        layout,
        labelAlign,
        labelWidth
      };
    },
    [layout, labelAlign, labelWidth]
  );

  const isNativeForm = Component === "form";

  return (
    <Component
      {...props}
      {...(isNativeForm && {
        onReset: (event: SyntheticEvent<HTMLFormElement>) => {
          event.preventDefault();
          reset();
        },
        onSubmit: (event: SubmitEvent<HTMLFormElement>) => {
          event.preventDefault();
          // TanStack's `handleSubmit` rethrows a rejecting user `onSubmit`; a
          // native form submission has no awaiting caller, so contain the
          // rejection instead of surfacing it as an unhandled promise rejection.
          handleSubmit().catch((error: unknown) => {
            console.error("[Form] submit failed:", error);
          });
        }
      })}
    >
      <FormLayoutProvider value={formLayout}>
        <DisabledProvider value={disabled}>
          {children}
        </DisabledProvider>
      </FormLayoutProvider>
    </Component>
  );
}
