import type { FormAsyncValidateOrFn, FormOptions, FormValidateOrFn } from "@tanstack/react-form";
import type { MaybeUndefined } from "@vef-framework-react/shared";

import type { FormApi } from "./types";

import { useMemo } from "react";

import { useAppForm } from "./form";
import { createField } from "./helpers";

export function useForm<
  TFormData,
  TOnMount extends MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnChange extends MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnChangeAsync extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TOnBlur extends MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnBlurAsync extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TOnSubmit extends MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnSubmitAsync extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TOnDynamic extends MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnDynamicAsync extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TOnServer extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TSubmitMeta
>(
  options: FormOptions<
    TFormData,
    TOnMount,
    TOnChange,
    TOnChangeAsync,
    TOnBlur,
    TOnBlurAsync,
    TOnSubmit,
    TOnSubmitAsync,
    TOnDynamic,
    TOnDynamicAsync,
    TOnServer,
    TSubmitMeta
  >
): FormApi<
  TFormData,
  TOnMount,
  TOnChange,
  TOnChangeAsync,
  TOnBlur,
  TOnBlurAsync,
  TOnSubmit,
  TOnSubmitAsync,
  TOnDynamic,
  TOnDynamicAsync,
  TOnServer,
  TSubmitMeta
> {
  const formApi = useAppForm(options);

  return useMemo(
    () => Object.assign(formApi, { createField }),
    [formApi]
  );
}
