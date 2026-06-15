import type {
  DeepKeys,
  DeepValue,
  FieldAsyncValidateOrFn,
  FieldValidateOrFn,
  UseFieldOptionsBound
} from "@tanstack/react-form";
import type { AnyObject, MaybeUndefined } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { fieldComponents } from "../fields";

type MaybeFieldSync<T, N extends DeepKeys<T>> = MaybeUndefined<FieldValidateOrFn<T, N, DeepValue<T, N>>>;

type MaybeFieldAsync<T, N extends DeepKeys<T>> = MaybeUndefined<FieldAsyncValidateOrFn<T, N, DeepValue<T, N>>>;

/**
 * Bound `<form.AppField>` props for a known field name, with all `TOn*`
 * validator slots widened to their upper bounds. The `name` field is omitted
 * because `createField` takes it as the first argument.
 */
type AppFieldOptionsFor<T, N extends DeepKeys<T>> = Omit<
  UseFieldOptionsBound<
    T,
    N,
    DeepValue<T, N>,
    MaybeFieldSync<T, N>,
    MaybeFieldSync<T, N>,
    MaybeFieldAsync<T, N>,
    MaybeFieldSync<T, N>,
    MaybeFieldAsync<T, N>,
    MaybeFieldSync<T, N>,
    MaybeFieldAsync<T, N>,
    MaybeFieldSync<T, N>,
    MaybeFieldAsync<T, N>
  >,
  "name"
>;

// ─── Opaque Branded Field Options ──────────────────────────────────────────────
// `AppFieldOptionsFor<T, N>` is type-checked at the `createField` call site
// where `TFormData` and `TName` are both known. To support homogeneous arrays
// of `FormFieldItem<T>`, the per-name `TName` dimension is erased into an
// opaque branded type that retains only `TFormData`. The two cast boundaries
// (`eraseFieldOptions` / `restoreFieldOptions`) are intentionally greppable.
declare const ErasedFieldOptionsBrand: unique symbol;

/**
 * Opaque wrapper for type-erased `<form.AppField>` options. Retains the
 * `TFormData` association while hiding the specific field name. Cannot be
 * constructed directly — use `createField` to produce values of this type.
 */
export interface ErasedFieldOptions<TFormData> {
  readonly [ErasedFieldOptionsBrand]: TFormData;
}

function eraseFieldOptions<T, N extends DeepKeys<T>>(
  options: AppFieldOptionsFor<T, N>
): ErasedFieldOptions<T> {
  return options as unknown as ErasedFieldOptions<T>;
}

/**
 * Restore erased field options to their specific field type at the render
 * site. Always returns an object (never undefined), so the result can be
 * spread onto `<form.AppField>` without an extra null check.
 *
 * @example
 * ```tsx
 * items.map(item => (
 *   <form.AppField
 *     key={item.name}
 *     name={item.name}
 *     {...restoreFieldOptions(item.fieldOptions)}
 *   >
 *     {item.render}
 *   </form.AppField>
 * ));
 * ```
 */
export function restoreFieldOptions<T, N extends DeepKeys<T>>(
  options: MaybeUndefined<ErasedFieldOptions<T>>
): AppFieldOptionsFor<T, N> {
  return (options ?? {}) as unknown as AppFieldOptionsFor<T, N>;
}

// ────────────────────────────────────────────────────────────────────────────────

/**
 * Field definition input accepted by `createField`. Extends every bound
 * `<form.AppField>` prop (validators, listeners, defaultValue, asyncDebounceMs,
 * mode, defaultMeta, …) and adds two project-specific slots:
 *
 * - `render`: the render-prop body, scoped to the injected field components.
 * - `renderMeta`: arbitrary metadata consumed by the surrounding map (e.g.
 * layout span, visibility). Named `renderMeta` to avoid confusion with
 * TanStack's `defaultMeta`, which seeds `FieldMeta` state.
 */
type FormFieldOptions<T, N extends DeepKeys<T>, TMeta extends AnyObject = AnyObject>
  = AppFieldOptionsFor<T, N> & {
    render: (field: typeof fieldComponents) => ReactNode;
    renderMeta?: TMeta;
  };

/**
 * Type-erased form field item for homogeneous array storage. Type checking
 * happens at the `createField` call site; the erased representation is safe
 * to iterate, filter, and reorder without losing safety.
 *
 * Field-name-dependent options live inside `fieldOptions` as an opaque
 * branded value (`ErasedFieldOptions`). Use `restoreFieldOptions(item.fieldOptions)`
 * at the render site to spread them onto `<form.AppField>`.
 *
 * `TMeta` allows attaching arbitrary typed metadata (e.g. layout, visibility)
 * to each field item via `renderMeta`. Defaults to `AnyObject` for zero
 * overhead when unused.
 */
export interface FormFieldItem<TFormData, TMeta extends AnyObject = AnyObject> {
  name: DeepKeys<TFormData>;
  fieldOptions?: ErasedFieldOptions<TFormData>;
  render: (field: typeof fieldComponents) => ReactNode;
  renderMeta?: TMeta;
}

/**
 * Type-safe field definition factory scoped to a specific form data type.
 *
 * @example
 * ```tsx
 * const { createField, AppField } = useFormContext<StaffParams>();
 *
 * interface FieldMeta { span?: number; hidden?: boolean; }
 *
 * const items: FormFieldItem<StaffParams, FieldMeta>[] = [
 *   createField("name", {
 *     validators: { onBlur: z.string("required").max(32) },
 *     listeners: {
 *       onChange: ({ value }) => track("staff_name_changed", { value }),
 *     },
 *     defaultValue: "",
 *     renderMeta: { span: 12 },
 *     render: field => <field.Input required label="Name" />,
 *   }),
 * ];
 *
 * // Render:
 * items.map(item => (
 *   <AppField
 *     key={item.name}
 *     name={item.name}
 *     {...restoreFieldOptions(item.fieldOptions)}
 *   >
 *     {item.render}
 *   </AppField>
 * ));
 * ```
 */
export type CreateFieldFn<TFormData> = <
  const TName extends DeepKeys<TFormData>,
  TMeta extends AnyObject = AnyObject
>(
  name: TName,
  options: FormFieldOptions<TFormData, TName, TMeta>
) => FormFieldItem<TFormData, TMeta>;

/**
 * Type-safe field definition factory. `TFormData` is inferred from the
 * `FormApi` boundary when accessed via `form.createField(...)`.
 */
export function createField<
  TFormData,
  const TName extends DeepKeys<TFormData>,
  TMeta extends AnyObject = AnyObject
>(
  name: TName,
  options: FormFieldOptions<TFormData, TName, TMeta>
): FormFieldItem<TFormData, TMeta> {
  const {
    render,
    renderMeta,
    ...fieldOptions
  } = options;

  const hasFieldOptions = Object.keys(fieldOptions).length > 0;

  return {
    name,
    fieldOptions: hasFieldOptions
      ? eraseFieldOptions(fieldOptions as AppFieldOptionsFor<TFormData, TName>)
      : undefined,
    render,
    renderMeta
  };
}
