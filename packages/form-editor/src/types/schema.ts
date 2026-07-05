// `DynamicIconName` / `CodeEditorLanguage` come from the sibling components
// package and type the persisted `prefixIcon` / `icon` / `language` fields below.
// The coupling is deliberate and type-only: it gives schema authors autocomplete
// and cast-free call sites (matching `component.ts`'s definition `icon`), while
// the serialized JSON is a plain string — stored schemas are never broken by a
// sibling rename, and the runtime tolerates unknown values (`DynamicIcon` and
// `CodeEditor` fall back). If that churn ever bites, widen these to
// `DynamicIconName | (string & {})` (the components' own `IconPickerValue` idiom).
import type { CodeEditorLanguage, DynamicIconName } from "@vef-framework-react/components";

import type { FormDataSource, FormVariable, RemoteDataSourceRequest, RemoteOptionMapping } from "./data-source";
import type { FieldLinkage } from "./linkage";

/**
 * Document-flow form schema.
 *
 * The layout is a **block tree**: a {@link PresentationLayer} (and every
 * container body) owns an ordered list of blocks (leaf fields or containers),
 * which stack vertically in document order. Side-by-side placement is an
 * explicit {@link GridNode} / {@link FlexNode} the author drags in, never an
 * implicit multi-block row. The grammar is enforced by the types — a leaf field
 * cannot own children. Arithmetic, cross-reference, and per-scope-uniqueness
 * invariants (span range, duplicate ids/keys, linkage source resolution) are
 * not expressible in TypeScript and live in `validateSchema` instead.
 *
 * Everything in this file is **persisted**. Editor-only UI concerns (width
 * presets, drag state) live in the editor layer, not here.
 */

/**
 * Column basis for grid spans. A {@link GridNode} cell's `span` is an integer in
 * `1..ROW_COLS`, and its `columns` count caps here too. Matches antd's native
 * 24-column unit, so the schema column basis and the renderer agree with no
 * conversion layer.
 */
export const ROW_COLS = 24;

/**
 * Named vertical-rhythm presets for a {@link Stack}-style container body — the
 * gap a container (or the root document) puts between its stacked child blocks.
 * The schema stores the named scale, not a pixel value; the renderer realizes it
 * to pixels (`render/stack-style.ts`), so a theme can re-tune the rhythm without
 * a schema migration. Distinct from a {@link FlexNode} / {@link GridNode} `gap`,
 * which is an explicit pixel number for inline (side-by-side) layout.
 */
export type GapScale = "small" | "medium" | "large";

/**
 * The valid {@link GapScale} values, for runtime validation of imported schemas.
 */
export const GAP_SCALES: readonly GapScale[] = ["small", "medium", "large"];

/**
 * The gap a stack uses when neither the container nor the form sets one.
 */
export const DEFAULT_GAP_SCALE: GapScale = "medium";

/**
 * Label placement for input-like leaf fields.
 */
export type LabelPosition = "top" | "left" | "right";

/**
 * Stable identity carried by every node in the tree.
 */
interface NodeBase {
  id: string;
}

/**
 * Dialect-independent logical column type a keyed field materializes into under
 * the `table` storage mode. The form designer infers it from the widget (see
 * `inferColumnType`); the few value-ambiguous widgets (number / select / radio)
 * expose an override. Mirrors the Go backend's `ColumnDataType`
 * (`approval/enums.go`); the storage layer maps it to a concrete SQL type.
 */
export type ColumnDataType
  = | "string"
    | "text"
    | "integer"
    | "decimal"
    | "boolean"
    | "date"
    | "datetime"
    | "json";

/**
 * Data-binding marker. A node that contributes a value to form state carries
 * a `key`. Leaf fields bind a scalar; a {@link SubformNode} binds an array of
 * records scoped under its `key`. Derived structurally so consumer-augmented
 * field types and the subform participate without enumeration — use
 * `isKeyedNode` to narrow.
 */
export interface KeyedNode {
  key: string;
  /**
   * Optional override for the field's table-storage column type. Absent means
   * the designer infers it from the widget; only the ambiguous widgets surface
   * a picker for it.
   */
  columnType?: ColumnDataType;
}

/**
 * Per-slot flex sizing for a block that is a direct child of a {@link FlexNode}.
 * Maps to the slot's CSS `flex-grow` / `flex-shrink` / `flex-basis`. Ignored
 * when the block lives in a grid row (where `span` drives width instead) — a
 * block carries at most one meaningful layout prop, selected by its parent.
 */
export interface FlexSlot {
  grow?: number;
  shrink?: number;
  basis?: string;
}

/**
 * A "block" is any node in the layout tree — a leaf field or a container.
 * Blocks stack vertically in their parent's order.
 *
 * - `span` is an integer column count (`1..ROW_COLS`) honored when the block is
 * a cell of a {@link GridNode}; omitted means a single column, and it is ignored
 * outside a grid. Range is validated at runtime, not in the type.
 * - `flex` sizes the block when it is a direct child of a {@link FlexNode};
 * it is ignored elsewhere, where `span` (in a grid) or full width applies.
 * - `columnWidth` is a fixed pixel width honored only when the block is a column
 * of a {@link TableSubform}; omitted means the column shares the table's
 * remaining width with the other auto columns. Ignored outside a table subform.
 * - `linkage` is honored on any block: `show` / `hide` / `enable` / `disable`
 * apply to leaves and containers alike (a container's `disable` propagates to
 * its descendants at runtime). The value-bearing actions (`require` /
 * `optional` / `assign`) are rejected on non-keyed-leaf nodes by the linkage
 * validator, which walks the full tree.
 */
interface BlockBase extends NodeBase {
  span?: number;
  flex?: FlexSlot;
  columnWidth?: number;
  linkage?: FieldLinkage;
}

/* ------------------------------------------------------------------ leaf fields */

/**
 * Common attributes shared by every leaf field. Concrete field types extend
 * this with the discriminator `type` and any type-specific properties; keyed
 * fields additionally extend {@link KeyedNode}.
 */
interface FormFieldBase extends BlockBase {
  type: string;
  label?: string;
  labelPosition?: LabelPosition;
}

/**
 * Mixin for leaf fields that expose static validation rules. Kept as a shared
 * shape (rather than re-declared per field) so the renderer and property
 * entries read `validate` through one typed contract — narrow a field to it
 * with `isValidatableField` instead of casting. The shape mirrors the Go
 * backend's `ValidationRule` (`approval/form_definition.go`): `minLength` /
 * `maxLength` constrain string length, `min` / `max` constrain numeric range,
 * `pattern` is a regular-expression source, and `message` overrides the default
 * constraint-failure text. All but `required` apply only to a present value.
 */
export interface Validatable {
  validate?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

/**
 * A selectable option for a selection field. `value` is the data-binding value
 * submitted for the field; `label` is the display text. Mirrors the Go
 * backend's `FieldOption` (`approval/form_definition.go`).
 */
export interface FieldOption {
  label: string;
  value: string | number;
}

/**
 * Inline, statically-authored option list.
 */
export interface StaticOptionSource {
  kind: "static";
  options: FieldOption[];
}

/**
 * Reference to a form-global data source (`FormSchema.dataSources`) by id.
 */
export interface RefOptionSource {
  kind: "ref";
  dataSourceId: string;
}

/**
 * A remote source defined inline on the field (not shared form-globally).
 */
export interface RemoteOptionSource {
  kind: "remote";
  request: RemoteDataSourceRequest;
  mapping?: RemoteOptionMapping;
}

/**
 * Where a selection field's options come from: an inline static list, a
 * reference to a form-global data source, or an inline remote request. Static
 * and `ref`-to-static resolve synchronously from the schema; `remote` (and
 * `ref`-to-remote) resolve through the host-injected {@link DataSourceResolver}.
 */
export type FieldOptionSource = StaticOptionSource | RefOptionSource | RemoteOptionSource;

/**
 * Single-line text input. Keyed: contributes a scalar value via `key`.
 */
export interface TextfieldField extends FormFieldBase, KeyedNode, Validatable {
  type: "textfield";
  placeholder?: string;
  helperText?: string;
  /**
   * Optional leading icon shown inside the input, stored as a kebab-case lucide
   * name and rendered through `DynamicIcon`.
   */
  prefixIcon?: DynamicIconName;
  /**
   * Control size. Maps to antd `Input` `size`; antd-mobile's input has no size
   * token, so the mobile renderer ignores it (PC-only visual scale).
   */
  size?: "small" | "middle" | "large";
  /**
   * Show a one-click clear affordance (antd `allowClear` / antd-mobile
   * `clearable`). Defaults to off.
   */
  allowClear?: boolean;
  /**
   * Hard input cap — the native `maxLength` that stops typing past N characters.
   * Deliberately distinct from `validate.maxLength`, which is a submit-time rule
   * that surfaces a message: this mirrors the dual-axis precedent NumberField
   * documents (input clamp vs validate rule).
   */
  maxLength?: number;
  /**
   * Input mode. `"password"` masks the value (antd `Input.Password` on PC,
   * native `type="password"` on mobile). Defaults to `"text"`.
   */
  inputType?: "text" | "password";
}

/**
 * Multi-line code editor. Keyed: contributes a string value via `key`.
 */
export interface CodeEditorField extends FormFieldBase, KeyedNode, Validatable {
  type: "code-editor";
  placeholder?: string;
  helperText?: string;
  /**
   * Built-in language id from the components package (JSON-serializable).
   */
  language?: CodeEditorLanguage;
  minHeight?: number;
  /**
   * Maximum editor height in px before the content scrolls. Pairs with
   * `minHeight`; unbounded when omitted.
   */
  maxHeight?: number;
  showLineNumbers?: boolean;
  /**
   * Show the code-folding gutter (the collapse arrows beside the line numbers).
   */
  showFoldGutter?: boolean;
  /**
   * Indentation width in spaces. Defaults to the editor's own default when omitted.
   */
  tabSize?: number;
}

/**
 * Action button. Non-keyed: does not contribute a value.
 */
export interface ButtonField extends FormFieldBase {
  type: "button";
  /**
   * Native button behaviour (the html `type`). Defaults to `"submit"` when
   * omitted. Orthogonal to {@link ButtonField.buttonType}, which is appearance.
   */
  action?: "submit" | "reset" | "button";
  /**
   * Visual style (antd `type`). Defaults to `"primary"`. On mobile this maps to
   * the antd-mobile `color` / `fill` pair.
   */
  buttonType?: "primary" | "default" | "dashed" | "text" | "link";
  /**
   * Render in the danger palette (antd `danger`). On mobile maps to
   * `color="danger"`.
   */
  danger?: boolean;
  /**
   * Control size. Maps to antd `Button` `size` on PC and antd-mobile `Button`
   * `size` on mobile.
   */
  size?: "small" | "middle" | "large";
  /**
   * Stretch to fill the available width (antd / antd-mobile `block`). Mobile
   * buttons are full-width by default, so only a stored `false` makes them inline
   * there.
   */
  block?: boolean;
  /**
   * Transparent background for placement on a colored surface (antd `ghost`).
   * PC-only — antd-mobile has no ghost fill.
   */
  ghost?: boolean;
  /**
   * Corner shape. `"round"` gives fully-rounded ends (antd `shape="round"` /
   * antd-mobile `shape="rounded"`). Defaults to the standard rectangle.
   */
  shape?: "default" | "round";
  /**
   * Optional leading icon, stored as a kebab-case lucide name and rendered
   * through `DynamicIcon`.
   */
  icon?: DynamicIconName;
}

/**
 * Numeric input. Keyed: contributes a number value via `key`.
 *
 * Two distinct min/max axes, deliberately not merged: the top-level `min` / `max`
 * here are the INPUT BOUNDS — both renderers clamp the committed value into this
 * range (antd on blur, mobile per keystroke), so a value outside it never reaches
 * form state — whereas `validate.min` / `validate.max` (from {@link Validatable})
 * are SUBMIT-TIME constraint rules that surface a validation message. Use the
 * bounds to stop out-of-range input; use the validate rules to explain why a
 * value is rejected at submit.
 */
export interface NumberField extends FormFieldBase, KeyedNode, Validatable {
  type: "number";
  placeholder?: string;
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  /**
   * Control size. Maps to antd `InputNumber` `size`; the mobile control has no
   * size token and ignores it.
   */
  size?: "small" | "middle" | "large";
  /**
   * Inline leading text inside the control (e.g. a currency symbol "¥"). antd
   * `InputNumber.prefix` on PC; rendered before the control on mobile.
   */
  prefix?: string;
  /**
   * Inline trailing text inside the control (e.g. a unit "kg" / "%"). antd
   * `InputNumber.suffix` on PC; rendered after the control on mobile.
   */
  suffix?: string;
  /**
   * Number of decimal places to keep. Rounds the committed value to this
   * precision on both presentations.
   */
  precision?: number;
  /**
   * Show the up/down stepper handles (antd `controls`). PC-only — the mobile
   * numeric input has no steppers. Defaults to shown.
   */
  controls?: boolean;
}

/**
 * Boolean toggle. Keyed: contributes a boolean value via `key`.
 *
 * Intentionally not `Validatable`: a switch always holds a value (on / off) with
 * no empty state, so a static `required` rule has no meaningful "must be
 * provided" semantics. Dynamic requiring via a `require` linkage rule is still
 * supported, and those validation errors render like any other field.
 */
export interface SwitchField extends FormFieldBase, KeyedNode {
  type: "switch";
  helperText?: string;
  /**
   * Text shown inside the track when on (antd `checkedChildren` / antd-mobile
   * `checkedText`).
   */
  onText?: string;
  /**
   * Text shown inside the track when off (antd `unCheckedChildren` / antd-mobile
   * `uncheckedText`).
   */
  offText?: string;
  /**
   * Control size. antd `Switch` only offers `default` / `small`; PC-only (the
   * mobile switch has no size token).
   */
  size?: "default" | "small";
}

/**
 * Single-select dropdown. Keyed: contributes the chosen option value via `key`.
 */
export interface SelectField extends FormFieldBase, KeyedNode, Validatable {
  type: "select";
  placeholder?: string;
  helperText?: string;
  allowClear?: boolean;
  /**
   * Control size. Maps to antd `Select` `size`; the mobile picker has no size
   * token and ignores it.
   */
  size?: "small" | "middle" | "large";
  /**
   * Enable type-to-filter on the PC dropdown (antd `showSearch`). PC-only — the
   * mobile picker wheel has no search surface.
   */
  showSearch?: boolean;
  /**
   * Option source. Defaults to an empty static list when omitted.
   */
  dataSource?: FieldOptionSource;
}

/**
 * Single-select radio group. Keyed: contributes the chosen option value.
 */
export interface RadioField extends FormFieldBase, KeyedNode, Validatable {
  type: "radio";
  helperText?: string;
  dataSource?: FieldOptionSource;
  /**
   * Render style. `"button"` lays the options out as a segmented button group
   * (antd `optionType="button"`); `"default"` is the classic radio dots. PC-only
   * — the mobile control stays a stacked radio list.
   */
  optionType?: "default" | "button";
  /**
   * Button-group fill when `optionType` is `"button"` (antd `buttonStyle`).
   */
  buttonStyle?: "outline" | "solid";
  /**
   * Option layout direction. Maps to antd `Radio.Group` `orientation` on PC and
   * drives the flex direction on mobile. Defaults to vertical.
   */
  direction?: "horizontal" | "vertical";
}

/**
 * Multi-select checkbox group. Keyed: contributes an array of chosen values.
 */
export interface CheckboxGroupField extends FormFieldBase, KeyedNode, Validatable {
  type: "checkbox-group";
  helperText?: string;
  dataSource?: FieldOptionSource;
  /**
   * Option layout direction. antd `Checkbox.Group` has no orientation prop, so
   * the PC renderer realizes vertical layout via flex; the mobile renderer drives
   * its flex direction the same way. Defaults to vertical.
   */
  direction?: "horizontal" | "vertical";
}

/**
 * Multi-line text input. Keyed: contributes a string value via `key`.
 */
export interface TextareaField extends FormFieldBase, KeyedNode, Validatable {
  type: "textarea";
  placeholder?: string;
  helperText?: string;
  rows?: number;
  /**
   * Grow the control to fit its content instead of staying at a fixed `rows`
   * height (antd / antd-mobile `autoSize`).
   */
  autoSize?: boolean;
  /**
   * Hard input cap — the native `maxLength`. Distinct from `validate.maxLength`
   * (a submit-time rule); see {@link TextfieldField.maxLength}.
   */
  maxLength?: number;
  /**
   * Show a live character counter (antd / antd-mobile `showCount`); most useful
   * paired with `maxLength`.
   */
  showCount?: boolean;
  /**
   * Control size. Maps to antd `Input.TextArea` `size`; PC-only.
   */
  size?: "small" | "middle" | "large";
  /**
   * Show a one-click clear affordance (antd `allowClear`). PC-only — antd-mobile
   * `TextArea` has no clearable surface.
   */
  allowClear?: boolean;
}

/**
 * Date picker. Keyed: contributes a `YYYY-MM-DD` string value via `key`.
 */
export interface DateField extends FormFieldBase, KeyedNode, Validatable {
  type: "date";
  placeholder?: string;
  helperText?: string;
  /**
   * Whether the picker shows a clear affordance. Mirrors antd `DatePicker`'s
   * `allowClear`, which is enabled by default — so the renderers treat an absent
   * value as `true` and only a stored `false` disables clearing.
   */
  allowClear?: boolean;
}

/**
 * Date + time picker. Keyed: contributes a `YYYY-MM-DD HH:mm:ss` string value.
 */
export interface DatetimeField extends FormFieldBase, KeyedNode, Validatable {
  type: "datetime";
  placeholder?: string;
  helperText?: string;
  /**
   * Whether the picker shows a clear affordance. See {@link DateField.allowClear}
   * — default-on, only a stored `false` disables it.
   */
  allowClear?: boolean;
}

/**
 * Date range picker. Keyed: contributes a `[start, end]` pair of date strings.
 */
export interface DateRangeField extends FormFieldBase, KeyedNode, Validatable {
  type: "daterange";
  helperText?: string;
  /**
   * Whether the range picker shows a clear affordance. See
   * {@link DateField.allowClear} — default-on, only a stored `false` disables it.
   */
  allowClear?: boolean;
}

/**
 * Section divider. Non-keyed presentation — an optional inline title.
 */
export interface DividerField extends FormFieldBase {
  type: "divider";
  title?: string;
  /**
   * Where the inline title sits along the rule (antd `titlePlacement` /
   * antd-mobile `contentPosition`). Defaults to centered. Only meaningful with a
   * `title`.
   */
  titlePlacement?: "left" | "center" | "right";
  /**
   * Draw the rule dashed instead of solid (antd `dashed`). PC-only — the mobile
   * divider stays solid.
   */
  dashed?: boolean;
}

/**
 * Inline alert banner. Non-keyed presentation.
 */
export interface AlertBlockField extends FormFieldBase {
  type: "alert-block";
  message?: string;
  description?: string;
  alertType?: "info" | "success" | "warning" | "error";
  /**
   * Show the leading status icon (antd `showIcon`). Defaults to on — the
   * renderers treat an absent value as `true`.
   */
  showIcon?: boolean;
  /**
   * Show a close button that dismisses the alert (antd `closable` / antd-mobile
   * NoticeBar `closeable`).
   */
  closable?: boolean;
  /**
   * Banner presentation — full-width, no rounded corners (antd `banner`).
   * PC-only.
   */
  banner?: boolean;
}

/**
 * Static paragraph of explanatory text. Non-keyed presentation.
 */
export interface ParagraphField extends FormFieldBase {
  type: "paragraph";
  text?: string;
  /**
   * Semantic text tone (antd `Typography` `type`). On mobile the renderer maps
   * it to the matching theme color. Omitted means the default body color.
   */
  textType?: "secondary" | "success" | "warning" | "danger";
  /**
   * Bold weight (antd `strong`).
   */
  strong?: boolean;
  /**
   * Italic style (antd `italic`).
   */
  italic?: boolean;
}

/**
 * Open registry of leaf field types, keyed by their `type` discriminator.
 * Consumers add field types by augmenting this interface from their own
 * module:
 *
 * ```ts
 * declare module "@vef-framework-react/form-editor" {
 * interface FormFieldTypeMap {
 * datepicker: DatePickerField;
 * }
 * }
 * ```
 *
 * Containers are deliberately **not** extensible this way — see
 * {@link ContainerNode}.
 */
export interface FormFieldTypeMap {
  textfield: TextfieldField;
  "code-editor": CodeEditorField;
  number: NumberField;
  switch: SwitchField;
  button: ButtonField;
  select: SelectField;
  radio: RadioField;
  "checkbox-group": CheckboxGroupField;
  textarea: TextareaField;
  date: DateField;
  datetime: DatetimeField;
  daterange: DateRangeField;
  divider: DividerField;
  "alert-block": AlertBlockField;
  paragraph: ParagraphField;
}

/**
 * Discriminated union of every registered leaf field type.
 */
export type FormField = FormFieldTypeMap[keyof FormFieldTypeMap];

/**
 * Exhaustive table of container node types, typed as a complete record over
 * `ContainerNode["type"]`. Adding a container variant to {@link ContainerNode}
 * forces a new entry here (or the file fails to compile), making this the
 * single source of truth the runtime classifiers in `schema/walk.ts` derive
 * from — no second hand-maintained string set to drift out of sync.
 */
const CONTAINER_TYPE_TABLE: Record<ContainerNode["type"], true> = {
  section: true,
  tabs: true,
  subform: true,
  flex: true,
  grid: true
};

/**
 * The container node type discriminants, derived from {@link ContainerNode}.
 */
export const CONTAINER_TYPES = Object.keys(CONTAINER_TYPE_TABLE) as Array<ContainerNode["type"]>;

/**
 * Leaf fields that bind a value. Field-only; for engine-wide keyed checks
 * (which must also catch a {@link SubformNode}) use `isKeyedNode`.
 */
export type KeyedFormField = Extract<FormField, KeyedNode>;

/* ------------------------------------------------------ containers (closed set) */

/**
 * Containers are a **closed set**: each one defines distinct tree-walk and
 * value-scope semantics (a subform opens a new value scope; tabs render
 * conditionally; a section and a flex container are pure layout). New layout
 * needs go through a PR, not module augmentation — extending the walker/scoper
 * is an engine change, not a renderer change. This asymmetry (open fields /
 * closed containers) is intentional: fields share a uniform render contract,
 * containers don't.
 */
export type ContainerNode = SectionNode | TabsNode | SubformNode | FlexNode | GridNode;

interface SectionBase extends BlockBase {
  type: "section";
  title?: string;
  /**
   * Vertical gap between this section's stacked child blocks. Omitted means
   * inherit the form-level {@link PresentationLayer.gap}.
   */
  gap?: GapScale;
  children: Block[];
}

/**
 * antd Card. Never collapses.
 */
export interface CardSection extends SectionBase {
  variant: "card";
}

/**
 * antd Collapse panel. Collapsibility is implied by the variant.
 */
export interface CollapseSection extends SectionBase {
  variant: "collapse";
  defaultCollapsed?: boolean;
}

export type SectionNode = CardSection | CollapseSection;

/**
 * One tab. `id` is its stable identity (drives antd `Tabs` keying and
 * active-tab persistence). Distinct from a data-binding `key`.
 */
export interface TabItem extends NodeBase {
  label: string;
  children: Block[];
}

export interface TabsNode extends BlockBase {
  type: "tabs";
  /**
   * Vertical gap between the stacked blocks inside each tab. Omitted means
   * inherit the form-level {@link PresentationLayer.gap}.
   */
  gap?: GapScale;
  tabs: TabItem[];
}

/**
 * Common attributes shared by every subform variant. A subform is a repeating
 * record group: it binds `Array<Record<string, unknown>>` under `key`, and its
 * `template` opens a **new value scope** (child field keys are unique within the
 * subform, not the global namespace). The walker emits this scope and
 * `validateSchema` enforces per-scope key uniqueness — both independent of the
 * presentation `variant`.
 */
interface SubformBase extends BlockBase, KeyedNode {
  type: "subform";
  label?: string;
  template: Block[];
  /**
   * Minimum number of rows the form keeps present. The runtime seeds this many
   * blank rows and blocks removal below it. Defaults to `0`.
   */
  minRows?: number;
  /**
   * Maximum number of rows the user may add. The runtime disables the add
   * control at this count. Unbounded when omitted.
   */
  maxRows?: number;
  addLabel?: string;
}

/**
 * Free-layout subform: each row renders the `template` as a stack of fully
 * editable, individually-laid-out fields — supporting nesting and per-row
 * linkage / evaluation scope. The default variant.
 */
export interface StackSubform extends SubformBase {
  variant: "stack";
  /**
   * Vertical gap between the stacked template blocks within each row. Omitted
   * means inherit the form-level {@link PresentationLayer.gap}.
   */
  gap?: GapScale;
}

/**
 * Table-layout subform: rows render through the components `EditableTable`
 * (view + per-row inline edit), each template leaf field becoming a column.
 * Targets straightforward tabular data entry, so `validateSchema` requires the
 * template to be flat keyed leaf fields. Desktop-only — the mobile presentation
 * renders it as a {@link StackSubform}.
 */
export interface TableSubform extends SubformBase {
  variant: "table";
  /**
   * Table density forwarded to the runtime `EditableTable`. Omitted uses the
   * table's own default.
   */
  size?: "small" | "middle" | "large";
}

/**
 * Repeating record group — a closed two-variant union: {@link StackSubform}
 * (free layout) and {@link TableSubform} (EditableTable). Both share the data
 * contract (array-of-records, value scope, key uniqueness, min/max rows); only
 * the presentation differs, so the engine treats them uniformly by `type` and
 * only the renderer branches on `variant`.
 */
export type SubformNode = StackSubform | TableSubform;

/**
 * Main-axis distribution of a {@link FlexNode}'s slots (maps to CSS
 * `justify-content`).
 */
export type FlexJustify = "start" | "center" | "end" | "between" | "around";

/**
 * Cross-axis alignment of a {@link FlexNode}'s slots (maps to CSS `align-items`).
 */
export type FlexAlign = "start" | "center" | "end" | "stretch";

/**
 * Flex layout container. Pure layout — no value scope, no key — that lays its
 * child blocks along one axis via CSS flexbox, each slot sized by its own
 * {@link FlexSlot} rather than a grid span. Its body is a block list like a
 * section's, but it renders the blocks inline (a flex line). Use it for
 * "arrange these elements in a line, sized by content" layouts the grid's fixed
 * columns cannot express.
 */
export interface FlexNode extends BlockBase {
  type: "flex";
  children: Block[];
  /**
   * Main axis. Defaults to `"row"` (horizontal).
   */
  direction?: "row" | "column";
  justify?: FlexJustify;
  align?: FlexAlign;
  /**
   * Whether slots wrap onto multiple lines when they overflow. Defaults to
   * `false` (single line).
   */
  wrap?: boolean;
  /**
   * Gap between slots, in pixels. Defaults to the form-level stack gap.
   */
  gap?: number;
}

/**
 * Grid layout container. Pure layout — no value scope, no key — that lays its
 * child blocks (cells) across a fixed number of equal-width columns via real
 * CSS grid. Each cell occupies one column by default; a cell's `span` widens it
 * to cover several columns, and cells wrap onto new rows once they fill the
 * track count. Its body is a block list like a flex container's, flowed into
 * the grid (each block is one cell).
 *
 * This is the **explicit** way to place fields side by side — multi-column
 * layout is always an explicit Grid (or {@link FlexNode}) the author drags in,
 * never an implicit multi-block row.
 */
export interface GridNode extends BlockBase {
  type: "grid";
  children: Block[];
  /**
   * Number of equal-width columns the cells flow across. Defaults to `2`.
   */
  columns?: number;
  /**
   * Gap between columns, in pixels. Defaults to the form-level stack gap.
   */
  gap?: number;
  /**
   * Gap between wrapped rows, in pixels. Defaults to `gap`.
   */
  rowGap?: number;
}

/* ------------------------------------------------------------------ unions */

/**
 * A block: a leaf field or a container. Every node in the layout tree is a
 * block — blocks stack vertically in their parent's order, and a container's
 * body is itself a block list.
 */
export type Block = FormField | ContainerNode;

/**
 * Any node that binds a value (a keyed leaf field or a subform).
 */
export type KeyedNodeUnion = Extract<Block, KeyedNode>;

/**
 * Which device a {@link PresentationLayer} targets. PC and mobile each carry an
 * independent field tree and layout; the data layer (variables / data sources /
 * keys) is shared, so the same key binds the same value on both.
 */
export type PresentationDevice = "pc" | "mobile";

/**
 * One device's design: its own block tree plus the layout defaults that apply
 * to it. A flat, vertically-stacked list of blocks; side-by-side placement is
 * an explicit grid / flex container within.
 */
export interface PresentationLayer {
  /**
   * Vertical gap between the root document's stacked blocks, and the default
   * every container stack inherits when it sets no `gap` of its own. Defaults to
   * {@link DEFAULT_GAP_SCALE}.
   */
  gap?: GapScale;
  children: Block[];
}

/**
 * The form schema (generation 2). The form-global data layer lives at the top;
 * each device's field tree and layout live under {@link FormSchema.presentations}.
 * `pc` is always present; `mobile` is optional — absent means that device has no
 * design yet (the renderer shows an empty state rather than falling back).
 */
export interface FormSchema extends NodeBase {
  /**
   * Schema generation. Bumped (with a real migration) on a breaking change.
   */
  version: 2;
  /**
   * Form-global variables, surfaced to expressions as `$vars.<name>`. Shared
   * across devices.
   */
  variables?: FormVariable[];
  /**
   * Reusable, form-global option sources referenced by selection fields. Shared
   * across devices.
   */
  dataSources?: FormDataSource[];
  /**
   * Form-scope linkage — the global "events" layer. Its rules carry lifecycle
   * triggers (`load` / `beforeSubmit` / `afterSubmit`) or a form-wide
   * `condition`, and **effect actions only** (the form has no self field whose
   * state could be derived). Shared across devices; validated under the
   * form-scope policy.
   */
  linkage?: FieldLinkage;
  /**
   * Per-device designs. `pc` is the primary / required tree; `mobile` is added
   * when the user designs (or converts to) a mobile layout.
   */
  presentations: {
    pc: PresentationLayer;
    mobile?: PresentationLayer;
  };
}

/**
 * A single device's design flattened with the shared data layer — the shape the
 * runtime renderer and linkage engine evaluate. Produced by `toRuntimeSchema`
 * from a {@link FormSchema} + a {@link PresentationDevice}. A subform template is
 * also expressed as one (its own `children`, no shared data layer), so the
 * runtime treats the root form and a repeating-group row uniformly.
 */
export interface RuntimeSchema extends PresentationLayer {
  id: string;
  variables?: FormVariable[];
  dataSources?: FormDataSource[];
  linkage?: FieldLinkage;
}
