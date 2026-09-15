import type { MaybeNull } from "@vef-framework-react/shared";

import type { FormItemProps } from "../types";

import { createContext, use } from "react";

import { useComponentDefaults } from "../../config-provider/component-defaults";

export interface FormLayout extends Pick<FormItemProps, "layout" | "labelAlign" | "labelWidth"> {}

export const defaultFormLayout: Readonly<FormLayout> = Object.freeze({
  layout: "horizontal",
  labelAlign: "right",
  labelWidth: 100
});

const FormLayoutContext = createContext<MaybeNull<FormLayout>>(null);
FormLayoutContext.displayName = "FormLayoutContext";

/**
 * The layout of the enclosing `Form`. A field rendered outside one falls back to
 * the framework layout with the application's `Form` defaults applied, so it
 * matches the fields that are inside one.
 */
export function useFormLayout(): FormLayout {
  const formLayout = use(FormLayoutContext);
  const applicationDefaults = useComponentDefaults("Form");

  return formLayout ?? { ...defaultFormLayout, ...applicationDefaults };
}

export const FormLayoutProvider = FormLayoutContext.Provider;
