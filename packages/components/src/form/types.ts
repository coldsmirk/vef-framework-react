import type { AppFieldExtendedReactFormApi, FormAsyncValidateOrFn, FormValidateOrFn } from "@tanstack/react-form";
import type { MaybeUndefined } from "@vef-framework-react/shared";
import type { FormItemProps as AntdFormItemProps } from "antd";

import type { formComponents } from "./components";
import type { fieldComponents } from "./fields";
import type { CreateFieldFn } from "./helpers";

export type FieldComponentProps<TFieldProps> = TFieldProps & FormItemProps;

export interface FormItemProps extends Pick<AntdFormItemProps, "layout" | "label" | "labelAlign" | "extra" | "required"> {
  /**
   * The width of the label.
   */
  labelWidth?: number;
  /**
   * Whether to render without wrapper element.
   */
  noWrapper?: boolean;
}

export type FormApi<
  TFormData,
  TOnMount extends MaybeUndefined<FormValidateOrFn<TFormData>> = MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnChange extends MaybeUndefined<FormValidateOrFn<TFormData>> = MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnChangeAsync extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>> = MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TOnBlur extends MaybeUndefined<FormValidateOrFn<TFormData>> = MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnBlurAsync extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>> = MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TOnSubmit extends MaybeUndefined<FormValidateOrFn<TFormData>> = MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnSubmitAsync extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>> = MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TOnDynamic extends MaybeUndefined<FormValidateOrFn<TFormData>> = MaybeUndefined<FormValidateOrFn<TFormData>>,
  TOnDynamicAsync extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>> = MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TOnServer extends MaybeUndefined<FormAsyncValidateOrFn<TFormData>> = MaybeUndefined<FormAsyncValidateOrFn<TFormData>>,
  TSubmitMeta = unknown
> = AppFieldExtendedReactFormApi<
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
  TSubmitMeta,
  typeof fieldComponents,
  typeof formComponents
> & {
  createField: CreateFieldFn<TFormData>;
};
