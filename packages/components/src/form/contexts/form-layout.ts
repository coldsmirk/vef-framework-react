import type { FormItemProps } from "../types";

import { createContext, use } from "react";

export interface FormLayout extends Pick<FormItemProps, "layout" | "labelAlign" | "labelWidth"> {}

export const defaultFormLayout: Readonly<FormLayout> = Object.freeze({
  layout: "horizontal",
  labelAlign: "right",
  labelWidth: 100
});

const FormLayoutContext = createContext<FormLayout>(defaultFormLayout);
FormLayoutContext.displayName = "FormLayoutContext";

export function useFormLayout(): FormLayout {
  return use(FormLayoutContext);
}

export const FormLayoutProvider = FormLayoutContext.Provider;
