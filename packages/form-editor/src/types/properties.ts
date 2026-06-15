import type { FormField, FormSchema } from "./schema";

/**
 * Open registry of property entry types — the source of the {@link EntryType}
 * discriminator. Built-in types live here; consumers augment the interface
 * (`declare module`) to add new types and register a renderer for them via
 * `FormFieldRegistry.registerPropertyEntry`. Each entry's per-renderer knobs are
 * the shared `options` / `placeholder` / `description` slots on
 * {@link PropertyEntry}; the values here are placeholders, only the keys matter.
 */
export interface PropertyEntryTypeMap {
  text: undefined;
  key: undefined;
  number: undefined;
  checkbox: undefined;
  select: undefined;
  icon: undefined;
  "options-editor": undefined;
  "linkage-rules": undefined;
}

export type EntryType = keyof PropertyEntryTypeMap;

export interface PropertyEntryOption {
  value: string;
  label: string;
}

/**
 * Props passed to every property entry renderer. The lens on `entry`
 * (`read` / `write`) is opaque at this seam — runtime safety comes from
 * the entry's `definePropertyEntry` declaration, not from re-narrowing
 * here. Renderers handle their own value coercion through `entry.read`
 * and forward the user's input via `onChange`; the panel applies it via
 * `entry.write`.
 */
export interface EntryComponentProps {
  entry: PropertyEntry;
  field: FormField;
  schema: FormSchema;
  onChange: (value: unknown) => void;
}

/**
 * A property entry describes one editable property on a field.
 *
 * `read` / `write` are the lens that mediate between the panel and the
 * field. Both are typed against the concrete field interface and the
 * value the entry renderer consumes, so a typo in a property name or a
 * wrong-type write fails to compile. Authors must declare entries through
 * {@link definePropertyEntry} so this pairing is checked at the call
 * site — bare object literals would lose the per-entry generic to the
 * group's heterogeneous storage.
 */
export interface PropertyEntry<TField extends FormField = FormField, TValue = unknown> {
  id: string;
  label: string;
  /**
   * Discriminator matched against a renderer registered via
   * `FormFieldRegistry.registerPropertyEntry`.
   */
  type: EntryType;
  options?: PropertyEntryOption[];
  visible?: (field: TField) => boolean;
  /**
   * When true, the entry is rendered in a read-only state.
   */
  readOnly?: boolean;
  /**
   * Optional helper line shown under the input.
   */
  description?: string;
  /**
   * Placeholder text for input-style entries.
   */
  placeholder?: string;
  /**
   * Reads the current value off the field. Pure.
   */
  read: (field: TField) => TValue;
  /**
   * Returns a new field with the property updated. Pure — must not mutate
   * the input.
   */
  write: (field: TField, value: TValue) => TField;
}

/**
 * Identity helper that pins both `TField` and `TValue` at the declaration
 * site while widening the result to the group's storage type.
 *
 * Use this in every `*.properties.ts` file instead of bare object
 * literals. The widening is a single, well-contained cast (this function
 * is the only place the type system loses information); the call-site
 * generics keep authors honest about what their lens actually reads and
 * writes.
 */
export function definePropertyEntry<TField extends FormField, TValue>(
  entry: PropertyEntry<TField, TValue>
): PropertyEntry {
  return entry as unknown as PropertyEntry;
}

/**
 * Tab the property panel renders this group inside. Determines which tab in
 * the panel header the group's entries appear under.
 *
 * - `props`: general attributes (label, key, placeholder, ...)
 * - `validation`: validation rules (required, min/max length, regex, ...)
 * - `linkage`: field linkage (show/hide rules driven by other fields)
 * - `layout`: sizing within a flex / grid container (grow / basis / span);
 * contextual — the panel only surfaces this tab for a container's children
 */
export type PropertyTabId = "props" | "validation" | "linkage" | "layout";

export interface PropertyGroup {
  /**
   * 'general' | 'appearance' | 'validation' | custom.
   */
  id: string;
  label: string;
  /**
   * Which top-level tab to display this group under. Defaults to `"props"`
   * when omitted so existing descriptors keep their current behavior.
   */
  tab?: PropertyTabId;
  /**
   * Heterogeneous entries (text, number, checkbox, …). Each declared via
   * {@link definePropertyEntry} so the per-entry `TField`/`TValue` are
   * pinned at the call site; group storage widens to the defaults.
   */
  entries: PropertyEntry[];
}

export type PropertiesDescriptor = PropertyGroup[];
