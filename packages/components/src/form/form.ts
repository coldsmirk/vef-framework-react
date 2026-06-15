import type { FormAsyncValidateOrFn, FormValidateOrFn } from "@tanstack/react-form";
import type { MaybeUndefined } from "@vef-framework-react/shared";

import type { FormApi } from "./types";

import { createFormHook } from "@tanstack/react-form";

import { formComponents } from "./components";
import { fieldContext, formContext, useFormContext as useFormContextInternal } from "./contexts";
import { fieldComponents } from "./fields";

const {
  useAppForm,
  withForm,
  withFieldGroup
} = createFormHook({
  formContext,
  fieldContext,
  fieldComponents,
  formComponents
});

export { useAppForm, withFieldGroup, withForm };

type MaybeValidator<T> = MaybeUndefined<FormValidateOrFn<T>>;

type MaybeAsyncValidator<T> = MaybeUndefined<FormAsyncValidateOrFn<T>>;

export function useFormContext<TFormData = unknown, TSubmitMeta = unknown>(): FormApi<
  TFormData,
  MaybeValidator<TFormData>,
  MaybeValidator<TFormData>,
  MaybeAsyncValidator<TFormData>,
  MaybeValidator<TFormData>,
  MaybeAsyncValidator<TFormData>,
  MaybeValidator<TFormData>,
  MaybeAsyncValidator<TFormData>,
  MaybeValidator<TFormData>,
  MaybeAsyncValidator<TFormData>,
  MaybeAsyncValidator<TFormData>,
  TSubmitMeta
> {
  return useFormContextInternal() as never;
}

export { formOptions as createFormOptions, useStore as useFormStore } from "@tanstack/react-form";
