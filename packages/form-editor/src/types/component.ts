import type { DynamicIconName } from "@vef-framework-react/components";
import type { DistributedOmit } from "@vef-framework-react/shared";
import type { FC } from "react";

import type { PropertiesDescriptor } from "./properties";
import type { Block, FormField, LabelPosition } from "./schema";

/**
 * Props passed to a field renderer. Generic over the concrete field type so a
 * renderer declared through {@link defineFieldDefinition} receives `field`
 * already narrowed to its own interface — no `field as XField` cast. The
 * registry stores the type-erased default (`field: FormField`, `value:
 * unknown`); the erasure happens once, inside the helper.
 *
 * Keyed fields receive the current value and a setter; non-keyed fields
 * receive `undefined` and a no-op setter.
 */
export interface FieldComponentProps<TField extends FormField = FormField, TValue = unknown> {
  field: TField;
  value: TValue;
  onChange: (value: TValue) => void;
  errors?: string[];
  /**
   * Stable DOM id derived from `field.id`, used for label `htmlFor`.
   */
  domId: string;
  disabled?: boolean;
  /**
   * Whether the field is currently required — static `validate.required` OR a
   * runtime `require` linkage, resolved by the renderer. Drives the label
   * asterisk so the visual marker tracks the live required state.
   */
  required?: boolean;
  /**
   * Resolved label placement (field override falling back to the form
   * default). Input-like fields honor it; inline fields (switch) may ignore it.
   */
  labelPosition?: LabelPosition;
}

/**
 * Palette categories. The order in the union here matches the visual order
 * displayed in the palette panel; `FIELD_GROUP_ORDER` mirrors it.
 *
 * Categories are intentionally generic so a field declares "what kind of
 * thing it is" rather than "where it lives in the UI", letting us reshuffle
 * the palette later without touching field definitions.
 */
export type FieldGroup
  = | "basic-input"
    | "selection"
    | "date-file"
    | "container"
    | "action"
    | "presentation";

/**
 * Initial attributes returned by a field's `create()` factory.
 *
 * Engine-managed properties (`id`, `key`) are populated by the store's insert
 * action — `id` via `createId`, `key` via `generateUniqueKey` for keyed
 * fields. The factory therefore returns the type-specific defaults only —
 * covering leaf fields and containers alike (a container's factory returns its
 * empty body).
 */
export type FieldCreateResult = DistributedOmit<Block, "id" | "key">;

export interface FieldDefinitionConfig {
  type: Block["type"];
  /**
   * Display name for palette entries.
   */
  name: string;
  group: FieldGroup;
  /**
   * Whether the field needs a unique data-binding `key`.
   */
  keyed: boolean;
  /**
   * Lucide icon name rendered in the palette card and properties header. Typed
   * against the components package's icon union so call sites stay cast-free.
   */
  icon?: DynamicIconName;
  iconUrl?: string;
  /**
   * Factory returning type-specific defaults.
   */
  create: () => FieldCreateResult;
}

/**
 * A registered field type. Stored type-erased: `Component` (when present)
 * takes the widened `FieldComponentProps`. Build instances through
 * {@link defineFieldDefinition} (leaf fields) or
 * {@link defineContainerDefinition} (containers) so the leaf/container
 * invariant — a leaf has a `Component`, a container does not — is enforced at
 * the declaration site rather than left representable.
 */
export interface FieldDefinition {
  config: FieldDefinitionConfig;
  /**
   * Leaf-field renderer. Containers omit this — they render structurally
   * through the canvas/runtime, not through a registry component.
   */
  Component?: FC<FieldComponentProps>;
  properties: PropertiesDescriptor;
}

/**
 * Declare a leaf-field definition. `Component` is required and typed against
 * the concrete `TField`/`TValue`, so the renderer body reads `field` and
 * `value` without a cast; the single erasure to the stored `FieldDefinition`
 * happens here (mirroring {@link definePropertyEntry}).
 */
export function defineFieldDefinition<TField extends FormField, TValue = unknown>(definition: {
  config: FieldDefinitionConfig;
  Component: FC<FieldComponentProps<TField, TValue>>;
  properties: PropertiesDescriptor;
}): FieldDefinition {
  return definition as unknown as FieldDefinition;
}

/**
 * Declare a container definition. Containers render structurally and therefore
 * take no `Component` — the helper omits the slot so one can never be attached
 * by mistake. They take no `properties` descriptor either: the panel renders a
 * container through its dedicated `ContainerProperties` editor, so a
 * descriptor here would be a dead letter.
 */
export function defineContainerDefinition(definition: {
  config: FieldDefinitionConfig;
}): FieldDefinition {
  return {
    config: definition.config,
    properties: []
  };
}
