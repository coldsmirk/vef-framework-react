import type { FieldLinkage, FormSchema, FormVariable, PresentationLayer } from "../../types";
import type { DeviceRegistries, FormFieldRegistry } from "../registry/form-field-registry";
import type { ValidationIssue } from "../validation";

import { CONTAINER_TYPES, GAP_SCALES, ROW_COLS } from "../../types";
import { validateLinkageSchema } from "../linkage";
import { createIssue, hasErrorIssues, isRecord, validateRemoteRequest } from "../validation";

/**
 * Result of a `validateSchema` run. `valid` is true when no issue carries
 * error severity — warning-only schemas (incomplete / dangling authoring
 * state) are valid and round-trip through export → import. `schema` is the
 * input narrowed to `FormSchema` whenever the result is valid.
 */
export interface ValidateSchemaResult {
  valid: boolean;
  schema?: FormSchema;
  issues: ValidationIssue[];
}

/**
 * The grammar every data-binding key must satisfy. Mirrors `sanitizeKey`
 * (`engine/keys.ts`), which strips every `\W` character from user input: a key
 * that survives sanitization always matches this pattern. Dotted keys would be
 * split into deep paths by TanStack Form's value binding while submit reads a
 * flat record (silently losing data), and `/` would corrupt per-scope key
 * bucketing — so anything outside `\w` is rejected at the import boundary.
 */
const KEY_CHARSET = /^\w+$/;

/**
 * Variable names are identifier-shaped (no digit lead): expressions address
 * them as `$vars.<name>`, and `$vars.123` is unparseable. Field keys stay on
 * the looser {@link KEY_CHARSET} — they are record-accessed, never dotted
 * from a literal.
 */
const VARIABLE_NAME = /^[A-Z_]\w*$/i;

/**
 * Whether a string is a legal `$vars` access name (identifier-shaped, no digit
 * lead). The single source of truth for the variable-name grammar: the store's
 * rename guard imports this so a rename can never mint a declaration the import
 * boundary would reject.
 */
export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME.test(name);
}

/**
 * Allowed `FormVariable.type` values, typed as a complete record so a union
 * change forces an update here (the `CONTAINER_TYPE_TABLE` pattern).
 */
const VARIABLE_TYPE_TABLE: Record<FormVariable["type"], true> = {
  string: true,
  number: true,
  boolean: true,
  json: true
};

const VARIABLE_TYPES: ReadonlySet<string> = new Set(Object.keys(VARIABLE_TYPE_TABLE));

interface Ctx {
  issues: ValidationIssue[];
  registry: FormFieldRegistry;
  /**
   * All node ids seen so far — ids are globally unique across the tree.
   */
  seenIds: Set<string>;
  /**
   * Data-binding keys grouped by value scope (subform keys join with "/").
   */
  keysByScope: Map<string, Set<string>>;
  /**
   * Declared form-global data source ids (`schema.dataSources`), for resolving
   * field-level `ref` option sources.
   */
  dataSourceIds: ReadonlySet<string>;
}

/**
 * Defensive runtime check for an externally-supplied schema (JSON pasted into
 * the import dialog, or an API payload). The editor's own mutators always
 * produce well-formed trees; this is the boundary that protects the store and
 * renderer from malformed input.
 *
 * The type system already forbids the tree-grammar illegal state (a leaf with
 * children). This guard covers what the types can't: the data envelope
 * (variables / data sources), per-presentation id uniqueness, per-scope key
 * uniqueness and key grammar, span range, known field types, keyed/non-keyed
 * consistency, option-source shapes, and linkage. Each device presentation is
 * checked against its own registry; the pc and mobile trees keep independent
 * id / key namespaces.
 */
export function validateSchema(candidate: unknown, registries: DeviceRegistries): ValidateSchemaResult {
  if (!isRecord(candidate)) {
    return { valid: false, issues: [createIssue("", "schema_not_object")] };
  }

  const issues: ValidationIssue[] = [];
  const schema = candidate as Partial<FormSchema>;

  if (typeof schema.id !== "string" || schema.id.length === 0) {
    issues.push(createIssue("id", "id_required"));
  }

  if (schema.version !== 2) {
    issues.push(createIssue("version", "version_unsupported"));
  }

  validateVariables(schema.variables, issues);

  const dataSourceIds = validateDataSources(schema.dataSources, issues);

  const { presentations } = schema;

  if (!isRecord(presentations)) {
    issues.push(createIssue("presentations", "presentation_not_object"));
    return { valid: false, issues };
  }

  // The form-level linkage is shared, so it rides with the pc tree (validated
  // against its root keyed nodes); the mobile tree is validated structurally on
  // its own.
  validatePresentation({
    dataSourceIds,
    formLinkage: schema.linkage,
    issues,
    layer: presentations.pc,
    registry: registries.pc,
    where: "presentations.pc"
  });

  if (presentations.mobile !== undefined) {
    validatePresentation({
      dataSourceIds,
      formLinkage: undefined,
      issues,
      layer: presentations.mobile,
      registry: registries.mobile,
      where: "presentations.mobile"
    });
  }

  const valid = !hasErrorIssues(issues);

  return {
    valid,
    ...valid && { schema: schema as FormSchema },
    issues
  };
}

/**
 * `schema.variables` must be an array of plain objects, each carrying a
 * non-empty `id`, an identifier `name` (the `$vars` access key — `\w+` only),
 * and a known `type`, with names unique across the form. A malformed entry
 * would crash `deriveEvaluationVariables` or silently shadow another variable.
 */
function validateVariables(variables: unknown, issues: ValidationIssue[]): void {
  if (variables === undefined) {
    return;
  }

  if (!Array.isArray(variables)) {
    issues.push(createIssue("variables", "variables_invalid"));
    return;
  }

  const entries: unknown[] = variables;
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const [index, entry] of entries.entries()) {
    const where = `variables[${index}]`;

    if (!isRecord(entry)) {
      issues.push(createIssue(where, "variables_invalid"));
      continue;
    }

    // Ids must be unique: the variables panel edits and removes by id, so a
    // duplicate id silently aliases two declarations onto one row (the
    // structurally-parallel data-source validator enforces the same).
    if (typeof entry.id !== "string" || entry.id.length === 0 || seenIds.has(entry.id)) {
      issues.push(createIssue(`${where}.id`, "variables_invalid"));
    } else {
      seenIds.add(entry.id);
    }

    if (typeof entry.name !== "string" || !isValidVariableName(entry.name) || seenNames.has(entry.name)) {
      issues.push(createIssue(`${where}.name`, "variables_invalid"));
    } else {
      seenNames.add(entry.name);
    }

    if (typeof entry.type !== "string" || !VARIABLE_TYPES.has(entry.type)) {
      issues.push(createIssue(`${where}.type`, "variables_invalid"));
    }
  }
}

/**
 * `schema.dataSources` must be an array of plain objects with unique non-empty
 * string ids, a string name, and a valid per-kind payload (`static` options or
 * a `remote` request). Returns every well-formed id seen — even from entries
 * with other problems — so `ref` option sources resolve as leniently as
 * possible while the issues still surface.
 */
function validateDataSources(dataSources: unknown, issues: ValidationIssue[]): ReadonlySet<string> {
  const ids = new Set<string>();

  if (dataSources === undefined) {
    return ids;
  }

  if (!Array.isArray(dataSources)) {
    issues.push(createIssue("dataSources", "data_sources_invalid"));
    return ids;
  }

  const entries: unknown[] = dataSources;

  for (const [index, entry] of entries.entries()) {
    const where = `dataSources[${index}]`;

    if (!isRecord(entry)) {
      issues.push(createIssue(where, "data_sources_invalid"));
      continue;
    }

    if (typeof entry.id !== "string" || entry.id.length === 0 || ids.has(entry.id)) {
      issues.push(createIssue(`${where}.id`, "data_sources_invalid"));
    } else {
      ids.add(entry.id);
    }

    if (typeof entry.name !== "string") {
      issues.push(createIssue(`${where}.name`, "data_sources_invalid"));
    }

    validateDataSourcePayload(entry, where, issues);
  }

  return ids;
}

function validateDataSourcePayload(entry: Record<string, unknown>, where: string, issues: ValidationIssue[]): void {
  switch (entry.kind) {
    case "static": {
      validateOptionList(entry.options, `${where}.options`, "data_sources_invalid", issues);
      return;
    }

    case "remote": {
      issues.push(...validateRemoteRequest(entry.request, `${where}.request`));
      validateOptionMapping(entry.mapping, `${where}.mapping`, "data_sources_invalid", issues);
      return;
    }

    default: {
      issues.push(createIssue(`${where}.kind`, "data_sources_invalid"));
    }
  }
}

/**
 * A static option list: an array of plain `{ label, value }` objects with a
 * string label and a string / number value. Shared by the form-global static
 * data source and a field's inline static source (which differ only in the
 * issue code they report under).
 */
function validateOptionList(
  options: unknown,
  where: string,
  code: "data_source_invalid" | "data_sources_invalid",
  issues: ValidationIssue[]
): void {
  if (!Array.isArray(options)) {
    issues.push(createIssue(where, code));
    return;
  }

  const entries: unknown[] = options;

  for (const [index, option] of entries.entries()) {
    if (!isRecord(option)
      || typeof option.label !== "string"
      || (typeof option.value !== "string" && typeof option.value !== "number")) {
      issues.push(createIssue(`${where}[${index}]`, code));
    }
  }
}

/**
 * A `RemoteOptionMapping`, when present, must be a plain object whose declared
 * keys are strings.
 */
function validateOptionMapping(
  mapping: unknown,
  where: string,
  code: "data_source_invalid" | "data_sources_invalid",
  issues: ValidationIssue[]
): void {
  if (mapping === undefined) {
    return;
  }

  if (!isRecord(mapping)) {
    issues.push(createIssue(where, code));
    return;
  }

  for (const key of ["labelKey", "valueKey", "disabledKey", "descriptionKey"]) {
    if (mapping[key] !== undefined && typeof mapping[key] !== "string") {
      issues.push(createIssue(`${where}.${key}`, code));
    }
  }
}

/**
 * Validate one device presentation against its registry. Each presentation owns
 * a fresh id / key namespace (the pc and mobile trees never share ids), so this
 * builds its own {@link Ctx}. Linkage runs only when the structural pass for
 * this presentation produced no errors, so its source-key resolution sees a
 * well-formed tree. `formLinkage` (the shared form-scope linkage) is passed for
 * the pc tree only, so it is not validated twice.
 */
function validatePresentation(args: {
  dataSourceIds: ReadonlySet<string>;
  formLinkage: FieldLinkage | undefined;
  issues: ValidationIssue[];
  layer: PresentationLayer | undefined;
  registry: FormFieldRegistry;
  where: string;
}): void {
  const {
    dataSourceIds,
    formLinkage,
    issues,
    layer,
    registry,
    where
  } = args;

  if (!isRecord(layer)) {
    issues.push(createIssue(where, "presentation_not_object"));
    return;
  }

  if (!Array.isArray(layer.children)) {
    issues.push(createIssue(`${where}.children`, "children_not_array"));
    return;
  }

  const ctx: Ctx = {
    issues,
    registry,
    seenIds: new Set(),
    keysByScope: new Map(),
    dataSourceIds
  };

  const before = issues.length;

  for (const [index, block] of layer.children.entries()) {
    validateBlock(block, `${where}.children[${index}]`, [], ctx);
  }

  if (!hasErrorIssues(issues.slice(before))) {
    issues.push(...validateLinkageSchema(layer, formLinkage).issues);
  }
}

function validateBlock(raw: unknown, where: string, scope: string[], ctx: Ctx): void {
  if (!isRecord(raw)) {
    ctx.issues.push(createIssue(where, "block_not_object"));
    return;
  }

  registerId(raw.id, where, ctx);
  validateSpan(raw.span, where, ctx);
  validateFlexValue(raw.flex, where, ctx);
  validateColumnWidth(raw.columnWidth, where, ctx);
  validateStackSlot(raw.stack, where, ctx);

  const { type } = raw;

  if (typeof type !== "string" || type.length === 0) {
    ctx.issues.push(createIssue(`${where}.type`, "type_required"));
    return;
  }

  switch (type) {
    case "section": {
      validateSection(raw, where, scope, ctx);
      return;
    }

    case "tabs": {
      validateTabs(raw, where, scope, ctx);
      return;
    }

    case "subform": {
      validateSubform(raw, where, scope, ctx);
      return;
    }

    case "flex": {
      validateFlex(raw, where, scope, ctx);
      return;
    }

    case "grid": {
      validateGrid(raw, where, scope, ctx);
      return;
    }

    default: {
      validateLeafField(raw, type, where, scope, ctx);
    }
  }
}

/**
 * Display-text props the renderer interpolates straight into JSX. The schema
 * is JSON-persisted, so each is a string when present — a non-string (e.g. an
 * object pasted via import) would crash React with "Objects are not valid as
 * a React child" after a "successful" import. Mirrors the section `title` /
 * tab `label` checks; covers the universal leaf props plus the presentational
 * text props (divider `title`, paragraph `text`, alert `message`).
 */
const DISPLAY_TEXT_PROPS = ["label", "placeholder", "helperText", "title", "text", "message"] as const;

function validateDisplayTexts(raw: Record<string, unknown>, where: string, ctx: Ctx): void {
  for (const prop of DISPLAY_TEXT_PROPS) {
    if (raw[prop] !== undefined && typeof raw[prop] !== "string") {
      ctx.issues.push(createIssue(`${where}.${prop}`, "display_text_invalid", { prop }));
    }
  }
}

function validateLeafField(
  raw: Record<string, unknown>,
  type: string,
  where: string,
  scope: string[],
  ctx: Ctx
): void {
  if (!ctx.registry.has(type)) {
    ctx.issues.push(createIssue(`${where}.type`, "unknown_field_type", { type }));
    return;
  }

  validateDisplayTexts(raw, where, ctx);

  const looksKeyed = typeof raw.key === "string" && raw.key.length > 0;
  const definedKeyed = ctx.registry.get(type)?.config.keyed === true;

  if (definedKeyed && !looksKeyed) {
    ctx.issues.push(createIssue(`${where}.key`, "key_required", { type }));
  }

  if (looksKeyed && !definedKeyed) {
    // A non-keyed type carrying a key would be treated as value-bearing at
    // runtime (`isKeyedField` is structural), silently joining defaults/submit.
    ctx.issues.push(createIssue(`${where}.key`, "stray_key", { type }));
  } else if (looksKeyed) {
    registerKey(raw.key as string, scope, where, ctx);
  }

  validateFieldRules(raw.validate, `${where}.validate`, ctx);

  if (raw.dataSource !== undefined) {
    validateFieldOptionSource(raw.dataSource, `${where}.dataSource`, ctx);
  }
}

/**
 * A selection field's inline option source: `static` carries its own option
 * list, `ref` points at a declared form-global data source (a dangling id is a
 * warning — deleting a data source after fields referenced it is legitimate
 * mid-authoring state), `remote` carries an inline request.
 */
function validateFieldOptionSource(source: unknown, where: string, ctx: Ctx): void {
  if (!isRecord(source)) {
    ctx.issues.push(createIssue(where, "data_source_invalid"));
    return;
  }

  switch (source.kind) {
    case "static": {
      validateOptionList(source.options, `${where}.options`, "data_source_invalid", ctx.issues);
      return;
    }

    case "ref": {
      const { dataSourceId } = source;

      if (typeof dataSourceId !== "string") {
        ctx.issues.push(createIssue(`${where}.dataSourceId`, "data_source_invalid"));
      } else if (dataSourceId.length === 0) {
        ctx.issues.push(createIssue(`${where}.dataSourceId`, "data_source_id_empty"));
      } else if (!ctx.dataSourceIds.has(dataSourceId)) {
        ctx.issues.push(createIssue(`${where}.dataSourceId`, "data_source_ref_unknown", { id: dataSourceId }));
      }

      return;
    }

    case "remote": {
      ctx.issues.push(...validateRemoteRequest(source.request, `${where}.request`));
      validateOptionMapping(source.mapping, `${where}.mapping`, "data_source_invalid", ctx.issues);
      return;
    }

    default: {
      ctx.issues.push(createIssue(`${where}.kind`, "data_source_invalid"));
    }
  }
}

/**
 * Semantic consistency of a leaf field's `validate` rules — the type system
 * forbids the wrong shapes, this guards the arithmetic the types cannot:
 * `minLength`/`min` must not exceed their `maxLength`/`max`, and `pattern` must
 * be a compilable regular expression (an uncompilable one silently passes every
 * value at runtime, where `validateFieldConstraints` swallows the `RegExp`
 * error).
 */
function validateFieldRules(validate: unknown, where: string, ctx: Ctx): void {
  if (validate === undefined) {
    return;
  }

  if (!isRecord(validate)) {
    ctx.issues.push(createIssue(where, "validate_malformed"));
    return;
  }

  const {
    max,
    maxLength,
    min,
    minLength,
    pattern
  } = validate;

  if (typeof minLength === "number" && typeof maxLength === "number" && minLength > maxLength) {
    ctx.issues.push(createIssue(`${where}.minLength`, "validate_range_invalid", { lower: "minLength", upper: "maxLength" }));
  }

  if (typeof min === "number" && typeof max === "number" && min > max) {
    ctx.issues.push(createIssue(`${where}.min`, "validate_range_invalid", { lower: "min", upper: "max" }));
  }

  if (typeof pattern === "string" && pattern.length > 0 && !isValidRegExp(pattern)) {
    ctx.issues.push(createIssue(`${where}.pattern`, "pattern_invalid"));
  }
}

function isValidRegExp(source: string): boolean {
  try {
    void new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

const GAP_SCALE_SET = new Set<string>(GAP_SCALES);

/**
 * A stacking container's `gap`, when present, must be one of the `GapScale`
 * presets. Shared by the section / tabs / subform validators.
 */
function validateGapScale(value: unknown, where: string, ctx: Ctx): void {
  if (value !== undefined && !GAP_SCALE_SET.has(value as string)) {
    ctx.issues.push(createIssue(`${where}.gap`, "gap_invalid"));
  }
}

/**
 * A pure-layout container (section / tabs / flex / grid) opens no value scope
 * and must not carry a data-binding `key` — `isKeyedNode` is structural, so a
 * stray key would silently join defaults / submit / linkage targeting at
 * runtime, exactly like a stray key on a non-keyed leaf type.
 */
function rejectStrayContainerKey(raw: Record<string, unknown>, type: string, where: string, ctx: Ctx): void {
  if (typeof raw.key === "string" && raw.key.length > 0) {
    ctx.issues.push(createIssue(`${where}.key`, "stray_key_on_container", { type }));
  }
}

function validateSection(raw: Record<string, unknown>, where: string, scope: string[], ctx: Ctx): void {
  rejectStrayContainerKey(raw, "section", where, ctx);

  if (raw.variant !== "card" && raw.variant !== "collapse") {
    ctx.issues.push(createIssue(`${where}.variant`, "variant_invalid"));
  }

  if (raw.title !== undefined && typeof raw.title !== "string") {
    ctx.issues.push(createIssue(`${where}.title`, "title_invalid"));
  }

  validateGapScale(raw.gap, where, ctx);
  validateBlockList(raw.children, `${where}.children`, scope, ctx);
}

const FLEX_JUSTIFY = new Set(["start", "center", "end", "between", "around"]);
const FLEX_ALIGN = new Set(["start", "center", "end", "stretch"]);

/**
 * A flex container is pure layout (no value scope), so its body validates under
 * the same scope. Its axis options must be one of the allowed enums and `gap`
 * a non-negative integer.
 */
function validateFlex(raw: Record<string, unknown>, where: string, scope: string[], ctx: Ctx): void {
  rejectStrayContainerKey(raw, "flex", where, ctx);

  if (raw.direction !== undefined && raw.direction !== "row" && raw.direction !== "column") {
    ctx.issues.push(createIssue(`${where}.direction`, "flex_invalid"));
  }

  if (raw.justify !== undefined && !FLEX_JUSTIFY.has(raw.justify as string)) {
    ctx.issues.push(createIssue(`${where}.justify`, "flex_invalid"));
  }

  if (raw.align !== undefined && !FLEX_ALIGN.has(raw.align as string)) {
    ctx.issues.push(createIssue(`${where}.align`, "flex_invalid"));
  }

  if (raw.wrap !== undefined && typeof raw.wrap !== "boolean") {
    ctx.issues.push(createIssue(`${where}.wrap`, "flex_invalid"));
  }

  if (raw.gap !== undefined && !isNonNegativeInteger(raw.gap)) {
    ctx.issues.push(createIssue(`${where}.gap`, "gap_invalid"));
  }

  validateBlockList(raw.children, `${where}.children`, scope, ctx);
}

/**
 * A grid container is pure layout (no value scope), so its body validates under
 * the same scope. `columns` must be an integer in `1..ROW_COLS`, and the gaps
 * non-negative integers.
 */
function validateGrid(raw: Record<string, unknown>, where: string, scope: string[], ctx: Ctx): void {
  rejectStrayContainerKey(raw, "grid", where, ctx);

  if (raw.columns !== undefined
    && (typeof raw.columns !== "number" || !Number.isSafeInteger(raw.columns) || raw.columns < 1 || raw.columns > ROW_COLS)) {
    ctx.issues.push(createIssue(`${where}.columns`, "columns_invalid", { max: ROW_COLS }));
  }

  if (raw.gap !== undefined && !isNonNegativeInteger(raw.gap)) {
    ctx.issues.push(createIssue(`${where}.gap`, "gap_invalid"));
  }

  if (raw.rowGap !== undefined && !isNonNegativeInteger(raw.rowGap)) {
    ctx.issues.push(createIssue(`${where}.rowGap`, "gap_invalid"));
  }

  validateBlockList(raw.children, `${where}.children`, scope, ctx);
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validateTabs(raw: Record<string, unknown>, where: string, scope: string[], ctx: Ctx): void {
  rejectStrayContainerKey(raw, "tabs", where, ctx);
  validateGapScale(raw.gap, where, ctx);

  if (!Array.isArray(raw.tabs)) {
    ctx.issues.push(createIssue(`${where}.tabs`, "children_not_array"));
    return;
  }

  if (raw.tabs.length === 0) {
    ctx.issues.push(createIssue(`${where}.tabs`, "tabs_empty"));
    return;
  }

  const { tabs } = raw;

  for (const [index, tab] of tabs.entries()) {
    const tabWhere = `${where}.tabs[${index}]`;

    if (!isRecord(tab)) {
      ctx.issues.push(createIssue(tabWhere, "tab_malformed"));
      continue;
    }

    registerId(tab.id, tabWhere, ctx);

    if (typeof tab.label !== "string") {
      ctx.issues.push(createIssue(`${tabWhere}.label`, "tab_malformed"));
    }

    validateBlockList(tab.children, `${tabWhere}.children`, scope, ctx);
  }
}

function validateSubform(raw: Record<string, unknown>, where: string, scope: string[], ctx: Ctx): void {
  // `variant` is the subform's presentation discriminant and is required —
  // reported (like the section variant) rather than silently rewritten: this
  // validator is a pure read used by live diagnostic surfaces, never a
  // normalizer.
  if (raw.variant !== "table" && raw.variant !== "stack") {
    ctx.issues.push(createIssue(`${where}.variant`, "subform_variant_invalid"));
  }

  const hasKey = typeof raw.key === "string" && raw.key.length > 0;

  if (hasKey) {
    registerKey(raw.key as string, scope, where, ctx);
  } else {
    ctx.issues.push(createIssue(`${where}.key`, "key_required", { type: "subform" }));
  }

  validateGapScale(raw.gap, where, ctx);

  if (raw.minRows !== undefined && !isNonNegativeInteger(raw.minRows)) {
    ctx.issues.push(createIssue(`${where}.minRows`, "rows_bound_invalid"));
  }

  if (raw.maxRows !== undefined && !isNonNegativeInteger(raw.maxRows)) {
    ctx.issues.push(createIssue(`${where}.maxRows`, "rows_bound_invalid"));
  }

  if (
    typeof raw.minRows === "number"
    && typeof raw.maxRows === "number"
    && raw.minRows > raw.maxRows
  ) {
    ctx.issues.push(createIssue(`${where}.minRows`, "rows_bound_invalid"));
  }

  // The template opens a new value scope under the subform's key.
  const inner = hasKey ? [...scope, raw.key as string] : scope;

  validateBlockList(raw.template, `${where}.template`, inner, ctx);

  // The table variant edits each template field as a column, so its template
  // must be flat binding fields — flag containers and non-keyed presentation /
  // action blocks. A warning, not an error: the renderer skips an invalid block
  // rather than breaking.
  if (raw.variant === "table" && Array.isArray(raw.template)) {
    for (const [index, block] of raw.template.entries()) {
      const type = isRecord(block) ? block.type : undefined;
      const isContainer = typeof type === "string" && (CONTAINER_TYPES as readonly string[]).includes(type);
      const isKeyed = isRecord(block) && typeof block.key === "string" && block.key.length > 0;

      if (isContainer || !isKeyed) {
        ctx.issues.push(createIssue(`${where}.template[${index}]`, "subform_table_column"));
      }
    }
  }
}

function validateBlockList(raw: unknown, where: string, scope: string[], ctx: Ctx): void {
  if (!Array.isArray(raw)) {
    ctx.issues.push(createIssue(where, "children_not_array"));
    return;
  }

  const blocks: unknown[] = raw;

  for (const [index, block] of blocks.entries()) {
    validateBlock(block, `${where}[${index}]`, scope, ctx);
  }
}

function registerId(id: unknown, where: string, ctx: Ctx): void {
  if (typeof id !== "string" || id.length === 0) {
    ctx.issues.push(createIssue(`${where}.id`, "id_required"));
    return;
  }

  if (ctx.seenIds.has(id)) {
    ctx.issues.push(createIssue(`${where}.id`, "duplicate_id", { id }));
    return;
  }

  ctx.seenIds.add(id);
}

function registerKey(key: string, scope: string[], where: string, ctx: Ctx): void {
  if (!KEY_CHARSET.test(key)) {
    ctx.issues.push(createIssue(`${where}.key`, "key_invalid_charset", { key }));
  }

  const scopeKey = scope.join("/");
  const used = ctx.keysByScope.get(scopeKey) ?? new Set<string>();

  if (used.has(key)) {
    ctx.issues.push(createIssue(`${where}.key`, "duplicate_key", { key }));
  } else {
    used.add(key);
  }

  ctx.keysByScope.set(scopeKey, used);
}

function validateSpan(span: unknown, where: string, ctx: Ctx): void {
  if (span === undefined) {
    return;
  }

  if (typeof span !== "number" || !Number.isSafeInteger(span) || span < 1 || span > ROW_COLS) {
    ctx.issues.push(createIssue(`${where}.span`, "span_invalid", { max: ROW_COLS }));
  }
}

/**
 * A block's per-slot flex sizing (used inside a flex container). When present it
 * must be an object whose `grow` / `shrink` are non-negative numbers and `basis`
 * a string. Honored only under a flex parent; a stray value elsewhere is inert.
 */
function validateFlexValue(flex: unknown, where: string, ctx: Ctx): void {
  if (flex === undefined) {
    return;
  }

  if (!isRecord(flex)) {
    ctx.issues.push(createIssue(`${where}.flex`, "flex_invalid"));
    return;
  }

  if (flex.grow !== undefined && (typeof flex.grow !== "number" || flex.grow < 0)) {
    ctx.issues.push(createIssue(`${where}.flex.grow`, "flex_invalid"));
  }

  if (flex.shrink !== undefined && (typeof flex.shrink !== "number" || flex.shrink < 0)) {
    ctx.issues.push(createIssue(`${where}.flex.shrink`, "flex_invalid"));
  }

  if (flex.basis !== undefined && typeof flex.basis !== "string") {
    ctx.issues.push(createIssue(`${where}.flex.basis`, "flex_invalid"));
  }
}

function isCssLengthValue(length: unknown, minValue: number): boolean {
  return isRecord(length)
    && typeof length.value === "number"
    && Number.isFinite(length.value)
    && length.value >= minValue
    && (length.unit === "px" || length.unit === "%");
}

// `width` / `maxWidth` must be positive (a zero box collapses the block, as the
// columnWidth gate already enforces); `minWidth` of 0 is the CSS default.
const STACK_LENGTH_MIN: Record<"width" | "minWidth" | "maxWidth", number> = {
  width: 1,
  minWidth: 0,
  maxWidth: 1
};

function validateStackSlot(stack: unknown, where: string, ctx: Ctx): void {
  if (stack === undefined) {
    return;
  }

  if (!isRecord(stack)) {
    ctx.issues.push(createIssue(`${where}.stack`, "stack_invalid"));
    return;
  }

  for (const key of ["width", "minWidth", "maxWidth"] as const) {
    if (stack[key] !== undefined && !isCssLengthValue(stack[key], STACK_LENGTH_MIN[key])) {
      ctx.issues.push(createIssue(`${where}.stack.${key}`, "stack_invalid"));
    }
  }

  if (stack.align !== undefined && stack.align !== "start" && stack.align !== "center" && stack.align !== "end") {
    ctx.issues.push(createIssue(`${where}.stack.align`, "stack_invalid"));
  }
}

/**
 * A block's fixed column width (used when the block is a column of a table
 * subform). When present it must be a positive, finite number of pixels; the
 * editor's write path floors it to an integer ≥ 1. Honored only under a table
 * subform parent; a stray value elsewhere is inert.
 */
function validateColumnWidth(columnWidth: unknown, where: string, ctx: Ctx): void {
  if (columnWidth === undefined) {
    return;
  }

  if (typeof columnWidth !== "number" || !Number.isFinite(columnWidth) || columnWidth <= 0) {
    ctx.issues.push(createIssue(`${where}.columnWidth`, "column_width_invalid"));
  }
}
