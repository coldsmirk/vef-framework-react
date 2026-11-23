import type { FormFieldDefinition as FlowFormFieldDefinition } from "@vef-framework-react/approval-flow-editor";
import type {
  Block,
  ColumnDataType,
  DateGranularity,
  FieldLinkage,
  FieldOptionSource,
  FormDataSource,
  FormField,
  FormSchema,
  KeyedNode,
  PresentationLayer,
  SubformNode,
  Validatable
} from "@vef-framework-react/form-editor";

import type {
  ApprovalFieldKind,
  ApprovalFieldOption,
  ApprovalFieldOptionSource,
  ApprovalFormField,
  ApprovalTableFixedRows,
  ApprovalValidationRule
} from "./contract";
import type { ProjectedApprovalField } from "./contract-compare";
import type { ProjectionIssue } from "./issues";

import {
  dateGranularityMaxLength,
  findDuplicateOptionValues,
  findParentContainer,
  getDynamicSubformRows,
  inferColumnType,
  isFixedSubform,
  isKeyedNode,
  isValidFixedItemValue,
  normalizeOptionMapping,
  walkNodes
} from "@vef-framework-react/form-editor";

import { compareFieldContracts } from "./contract-compare";
import {
  issueDecimalScaleMissing,
  issueLinkageNotProjected,
  issueNestedSubform,
  issueOptionsNotStatic,
  issuePatternUnsupported,
  issueTableColumnsEmpty,
  issueTableFixedRowsItemKeyConflict,
  issueTableFixedRowsItemKeyEmpty,
  issueTableFixedRowsSourceInvalid,
  issueTableRowsModeInvalid,
  issueUnknownFieldType,
  issueUnmappableFieldType
} from "./issues";

/**
 * Result of projecting a designed {@link FormSchema} onto the approval form
 * contract. One walk feeds both consumers so they cannot disagree:
 * `fields` is the flat field inventory — the same list the Go parser derives
 * from the deployed schema — and `formFields` is that inventory in the shape
 * the approval flow editor consumes through `EditorPlugins.formFields`
 * (detail-table fields included, with their columns, so the condition
 * editor's aggregate UI works).
 */
export interface ProjectionResult {
  fields: ApprovalFormField[];
  formFields: FlowFormFieldDefinition[];
  issues: ProjectionIssue[];
  /**
   * `true` when no error-severity issue was raised. The backend's form data
   * is a closed contract — deploying a schema whose projection is invalid
   * either fails the deploy validation or poisons every submit — so hosts
   * must gate persistence on this flag.
   */
  valid: boolean;
}

/**
 * A keyed leaf field: binds a scalar (or array) value under `key`.
 */
type KeyedField = FormField & KeyedNode;

/**
 * Designer widget type → approval field kind, for every widget whose runtime
 * value satisfies the Go kind's submit validation (string for input /
 * textarea / date / datetime, `[start, end]` pair for daterange, JSON number
 * for number, scalar-or-array for select).
 *
 * `switch` (boolean) is deliberately absent: it surfaces as an
 * `unmappable_field_type` error instead (and the approval registry profile
 * excludes it up front).
 */
const KIND_BY_TYPE: Record<string, ApprovalFieldKind> = {
  textfield: "input",
  "code-editor": "textarea",
  textarea: "textarea",
  number: "number",
  select: "select",
  "multi-select": "select",
  radio: "select",
  "checkbox-group": "select",
  date: "date",
  datetime: "datetime",
  daterange: "daterange",
  upload: "upload"
};

/**
 * Selection widgets whose runtime value is an array of chosen option values
 * rather than a single scalar. Projected with `isMultiple: true`, mirroring
 * `multiValueSelectTypes` in Go `internal/approval/formeditor/project.go`.
 */
const MULTI_VALUE_SELECT_TYPES: ReadonlySet<string> = new Set(["checkbox-group", "multi-select"]);

/**
 * Widget types that bind a value the approval contract cannot carry (as
 * opposed to unknown consumer-registered types).
 */
const UNMAPPABLE_TYPES: ReadonlySet<string> = new Set(["switch"]);

interface ProjectedField {
  approval: ProjectedApprovalField;
  flow: FlowFormFieldDefinition;
}

/**
 * Project a designed form schema onto the approval form contract — a
 * designer-side UX aid: the live field inventory behind the flow editor's
 * permission / condition matrix, plus pre-deploy validation feedback that
 * mirrors the Go parser. Deploy does not consume this projection: the backend
 * receives the rich schema verbatim (`DeployFlowCmd.FormSchema`) and derives
 * the flat field list itself via `internal/approval/formeditor` — the
 * enforcement-side twin of this function, kept in lockstep through the shared
 * golden fixtures under `__fixtures__/formeditor-parity/`.
 *
 * Both device presentations are walked (pc first) and deduped by key — the
 * submitted data contract is shared across devices, and the backend's form
 * data is closed, so a mobile-only field must still project. When a key appears
 * on both devices, both sides are projected and their data contracts (stripping
 * display-only fields) are compared structurally via {@link compareFieldContracts}
 * so any residual divergence raises an error. Only root-scope keyed nodes become
 * fields: leaf fields map by {@link KIND_BY_TYPE}, a subform becomes a
 * single-level `table` field whose template's keyed leaves are its columns
 * (layout containers in the template are transparent — only a subform opens a
 * value scope, so the submitted row stays a flat record).
 *
 * Conservation rule: a keyed node that cannot be mapped is always an
 * error-severity issue, never silently dropped.
 */
export function projectFormSchema(schema: FormSchema): ProjectionResult {
  const issues: ProjectionIssue[] = [];
  const fields: ApprovalFormField[] = [];
  const formFields: FlowFormFieldDefinition[] = [];
  const dataSources = new Map((schema.dataSources ?? []).map(source => [source.id, source]));

  // key → the PC-side projection, or null when PC's sighting was unprojectable
  // (a failed classify, or an empty / nested / invalid subform). Classification
  // runs BEFORE per-device dedupe so an unmappable / unknown widget errors on
  // every device; cross-device contract comparison compares two successfully
  // projected sightings.
  const pcProjected = new Map<string, ProjectedApprovalField | null>();

  const projectNode = (
    node: Block & KeyedNode,
    targetIssues: ProjectionIssue[]
  ): ProjectedField | undefined => node.type === "subform"
    ? projectSubform(node, dataSources, targetIssues)
    : projectLeaf(node as KeyedField, node.key, dataSources, targetIssues);

  const appendProjected = (layer: PresentationLayer, node: Block & KeyedNode, projected: ProjectedField): void => {
    fields.push({ ...projected.approval, sortOrder: fields.length });
    // hasConditionalVisibility is a designer-side hint on the flow field
    // (the FlowFormFieldDefinition the permission table reads), orthogonal
    // to the linkage_not_projected warning warnOnLinkage already raised.
    formFields.push(
      hasConditionalVisibility(layer, node)
        ? { ...projected.flow, hasConditionalVisibility: true }
        : projected.flow
    );
  };

  const pcLayer = schema.presentations.pc;

  if (pcLayer !== undefined) {
    const pcSeen = new Set<string>();

    walkNodes(pcLayer, (node, scope) => {
      if (scope.length > 0 || !isKeyedNode(node)) {
        return;
      }

      const classification = classifyWidget(node);

      if (classification !== undefined) {
        if (!pcSeen.has(node.key)) {
          issues.push(classification);
          pcSeen.add(node.key);
          pcProjected.set(node.key, null);
        }

        return;
      }

      if (pcSeen.has(node.key)) {
        return;
      }

      pcSeen.add(node.key);

      const projected = projectNode(node, issues);

      pcProjected.set(node.key, projected?.approval ?? null);

      if (projected !== undefined) {
        appendProjected(pcLayer, node, projected);
      }
    });
  }

  const mobileLayer = schema.presentations.mobile;

  if (mobileLayer !== undefined) {
    const mobileSeen = new Set<string>();

    walkNodes(mobileLayer, (node, scope) => {
      if (scope.length > 0 || !isKeyedNode(node)) {
        return;
      }

      const classification = classifyWidget(node);

      if (classification !== undefined) {
        if (pcProjected.get(node.key) !== null && !mobileSeen.has(node.key)) {
          issues.push(classification);
          mobileSeen.add(node.key);
        }

        return;
      }

      if (mobileSeen.has(node.key)) {
        return;
      }

      mobileSeen.add(node.key);

      if (pcProjected.has(node.key)) {
        const pcField = pcProjected.get(node.key);

        // PC's sighting was already unprojectable: dedupe the losing device
        // away to match Go's abort-on-first-error.
        if (pcField === null || pcField === undefined) {
          return;
        }

        // Project into an isolated issue sink so shared warnings
        // (`options_not_static`, `linkage_not_projected`, `decimal_scale_missing`)
        // are not reported twice; errors still surface and structural errors
        // short-circuit contract comparison against an incomplete projection.
        const mobileIssues: ProjectionIssue[] = [];
        const mobileProjected = projectNode(node, mobileIssues);
        const mobileErrors = mobileIssues.filter(issue => issue.severity === "error");

        for (const error of mobileErrors) {
          if (issues.every(existing => existing.code !== error.code || existing.path !== error.path)) {
            issues.push(error);
          }
        }

        const hasBlockingError = mobileProjected === undefined
          || mobileErrors.some(error => error.code !== "pattern_unsupported");

        if (hasBlockingError) {
          return;
        }

        compareFieldContracts(node.key, pcField, mobileProjected.approval, issues);

        return;
      }

      const projected = projectNode(node, issues);

      if (projected !== undefined) {
        appendProjected(mobileLayer, node, projected);
      }
    });
  }

  return {
    fields,
    formFields,
    issues,
    valid: issues.every(issue => issue.severity !== "error")
  };
}

/**
 * The projection-blocking fault of a root-scope keyed node's widget type: an
 * unmappable (switch) or unknown type. A subform (table) and every mapped leaf
 * widget pass (return `undefined`). Run BEFORE the cross-device dedupe so a
 * type conflict raises identically no matter which device sees the key first —
 * mirrors the Go parser's `classifyWidget` (internal/approval/formeditor,
 * project.go), whose walk (parser.go) classifies before the seen check.
 */
function classifyWidget(node: Block & KeyedNode): ProjectionIssue | undefined {
  if (node.type === "subform" || KIND_BY_TYPE[node.type] !== undefined) {
    return undefined;
  }

  return UNMAPPABLE_TYPES.has(node.type)
    ? issueUnmappableFieldType(node.key, node.type)
    : issueUnknownFieldType(node.key, node.type);
}

/**
 * Project one keyed leaf field. Returns `undefined` (after raising the
 * conservation error) when the widget's value shape cannot satisfy the Go
 * runtime validation. `path` carries the table-key prefix when the field is
 * a detail-table column.
 */
function projectLeaf(
  field: KeyedField,
  path: string,
  dataSources: Map<string, FormDataSource>,
  issues: ProjectionIssue[]
): ProjectedField | undefined {
  const kind = KIND_BY_TYPE[field.type];

  if (kind === undefined) {
    issues.push(
      UNMAPPABLE_TYPES.has(field.type)
        ? issueUnmappableFieldType(path, field.type)
        : issueUnknownFieldType(path, field.type)
    );

    return undefined;
  }

  warnOnLinkage(field, path, issues);

  const label = field.label ?? field.key;
  const { options, optionSource } = resolveOptionSource(field, path, dataSources, issues);
  const { isRequired, rule } = splitValidation(field);
  const columnType = resolveColumnType(field);
  const { precision } = field as { precision?: number };
  const { placeholder } = field as { placeholder?: string };
  const hasScale = precision !== undefined && precision > 0;

  if (rule?.pattern !== undefined && hasRe2UnsupportedConstruct(rule.pattern)) {
    issues.push(issuePatternUnsupported(path));
  }

  if (columnType === "decimal" && !hasScale) {
    issues.push(issueDecimalScaleMissing(path));
  }

  const isMultiple = MULTI_VALUE_SELECT_TYPES.has(field.type);
  const rawGranularity = field.type === "date" || field.type === "daterange"
    ? (field as { granularity?: DateGranularity }).granularity
    : undefined;
  const granularity = rawGranularity && rawGranularity.length > 0 ? rawGranularity : undefined;

  let validation = rule;

  if (field.type === "date" && columnType === "string" && validation?.maxLength === undefined) {
    const maxLength = dateGranularityMaxLength(granularity);

    if (maxLength !== undefined) {
      validation = { ...validation, maxLength };
    }
  }

  const approval: Omit<ApprovalFormField, "sortOrder"> = {
    key: field.key,
    kind,
    label,
    ...placeholder !== undefined && { placeholder },
    ...isRequired && { isRequired },
    ...isMultiple && { isMultiple },
    ...granularity !== undefined && { granularity },
    ...options !== undefined && { options },
    ...optionSource !== undefined && { optionSource },
    ...validation !== undefined && { validation },
    ...columnType !== undefined && { columnType },
    ...columnType === "decimal" && hasScale && { scale: precision }
  };

  const flow: FlowFormFieldDefinition = {
    key: field.key,
    kind,
    label,
    ...isMultiple && { isMultiple },
    ...granularity !== undefined && { granularity },
    ...options !== undefined && { options }
  };

  return { approval, flow };
}

/**
 * Project a root-scope subform into a single-level `table` field. The
 * template is walked with the same scope semantics as the root tree: layout
 * containers are transparent, a nested subform is a contract violation, and
 * every keyed template leaf becomes a column via {@link projectLeaf}.
 */
function projectSubform(
  subform: SubformNode,
  dataSources: Map<string, FormDataSource>,
  issues: ProjectionIssue[]
): ProjectedField | undefined {
  const columns: ApprovalFormField[] = [];
  const flowColumns: FlowFormFieldDefinition[] = [];
  const seenColumns = new Set<string>();
  let nested = false;

  walkNodes({ children: subform.template }, (node, scope) => {
    // A duplicate column key is the same value binding twice, mirroring the
    // root walk's dedup — first sighting wins.
    if (scope.length > 0 || !isKeyedNode(node) || seenColumns.has(node.key)) {
      return;
    }

    seenColumns.add(node.key);

    if (node.type === "subform") {
      nested = true;
      issues.push(issueNestedSubform(`${subform.key}.${node.key}`));

      return;
    }

    const projected = projectLeaf(node as KeyedField, `${subform.key}.${node.key}`, dataSources, issues);

    if (projected !== undefined) {
      columns.push({ ...projected.approval, sortOrder: columns.length });
      flowColumns.push(projected.flow);
    }
  });

  if (columns.length === 0) {
    if (!nested) {
      issues.push(issueTableColumnsEmpty(subform.key));
    }

    return undefined;
  }

  warnOnLinkage(subform, subform.key, issues);

  const label = subform.label ?? subform.key;
  // Widen to `string | undefined` so untrusted wire JSON with an empty or
  // unrecognized mode reaches the same branches as Go's projector without
  // casting the discriminated union.
  const mode: string | undefined = subform.rows?.mode;

  if (mode === undefined || mode === "" || mode === "dynamic") {
    const dynamicRows = getDynamicSubformRows(subform);
    const isRequired = (dynamicRows.min ?? 0) >= 1;
    const rule: ApprovalValidationRule = {
      ...dynamicRows.min !== undefined && dynamicRows.min > 0 && { minLength: dynamicRows.min },
      ...dynamicRows.max !== undefined && { maxLength: dynamicRows.max }
    };
    const hasRule = rule.minLength !== undefined || rule.maxLength !== undefined;

    const approval: Omit<ApprovalFormField, "sortOrder"> = {
      key: subform.key,
      kind: "table",
      label,
      ...isRequired && { isRequired },
      ...hasRule && { validation: rule },
      columns
    };

    const flow: FlowFormFieldDefinition = {
      key: subform.key,
      kind: "table",
      label,
      columns: flowColumns
    };

    return { approval, flow };
  }

  if (!isFixedSubform(subform)) {
    issues.push(issueTableRowsModeInvalid(subform.key, mode));

    return undefined;
  }

  const fixed = subform.rows;

  if (typeof fixed.itemKey !== "string" || fixed.itemKey.trim().length === 0) {
    issues.push(issueTableFixedRowsItemKeyEmpty(subform.key));

    return undefined;
  }

  if (seenColumns.has(fixed.itemKey)) {
    issues.push(issueTableFixedRowsItemKeyConflict(subform.key, fixed.itemKey));

    return undefined;
  }

  const { options, optionSource } = resolveOptionSourceValue(fixed.source, dataSources);

  if (optionSource === undefined && !isValidStaticFixedRowItems(options)) {
    issues.push(issueTableFixedRowsSourceInvalid(subform.key));

    return undefined;
  }

  const fixedRows: ApprovalTableFixedRows = {
    itemKey: fixed.itemKey,
    ...fixed.headerLabel !== undefined && fixed.headerLabel.length > 0 && { headerLabel: fixed.headerLabel },
    ...optionSource === undefined ? { items: options } : { source: optionSource }
  };

  const approval: Omit<ApprovalFormField, "sortOrder"> = {
    key: subform.key,
    kind: "table",
    label,
    ...fixed.required === true && { isRequired: true },
    columns,
    fixedRows
  };

  // `itemKey` is a read-only row header, never a numeric template column, so
  // `flowColumns` omits it — the flow condition editor's aggregate picker only
  // ever sees template columns.
  const flow: FlowFormFieldDefinition = {
    key: subform.key,
    kind: "table",
    label,
    columns: flowColumns
  };

  return { approval, flow };
}

function isValidStaticFixedRowItems(items: ApprovalFieldOption[] | undefined): items is ApprovalFieldOption[] {
  if (items === undefined || items.length === 0) {
    return false;
  }

  if (items.some(item => !isValidFixedItemValue(item.value))) {
    return false;
  }

  return findDuplicateOptionValues(items).length === 0;
}

/**
 * Collapse a selection field's option source into exactly one of two
 * projections: the enumerated `{ label, value }` options of a static source,
 * or the descriptor of a code set or remote one. A `ref` is dereferenced first,
 * so the result is always post-dereference and a consumer never chases a
 * `dataSourceId`.
 *
 * A code set does not warn: the backend checks a submitted value against the
 * dictionary itself. A remote source still does: the backend validates a
 * submitted value against `options` alone, so it will accept anything for this
 * field either way — the descriptor tells a consumer how to DISPLAY a stored
 * value, it does not make the value checked. A remote source whose request the designer left unset is
 * emitted rather than dropped, so the Go deploy validation names it instead of
 * the projection silently degrading it to a source-less field. A dangling ref
 * and an unknown kind yield neither.
 */
function resolveOptionSource(
  field: KeyedField,
  path: string,
  dataSources: Map<string, FormDataSource>,
  issues: ProjectionIssue[]
): { options?: ApprovalFieldOption[]; optionSource?: ApprovalFieldOptionSource } {
  const source = (field as { dataSource?: FieldOptionSource }).dataSource;

  if (source === undefined) {
    return {};
  }

  const result = resolveOptionSourceValue(source, dataSources);

  if (result.options === undefined && result.optionSource?.kind !== "codeSet") {
    issues.push(issueOptionsNotStatic(path));
  }

  return result;
}

/**
 * Pure dereference + projection of a {@link FieldOptionSource}, shared between
 * leaf selection fields and fixed-row subform sources. Mirrors
 * `resolveOptionSourceValue` in Go `internal/approval/formeditor/project.go`.
 */
function resolveOptionSourceValue(
  source: FieldOptionSource | undefined,
  dataSources: Map<string, FormDataSource>
): { options?: ApprovalFieldOption[]; optionSource?: ApprovalFieldOptionSource } {
  if (source === undefined) {
    return {};
  }

  const resolved = source.kind === "ref" ? dataSources.get(source.dataSourceId) : source;

  if (resolved?.kind === "static") {
    return { options: resolved.options };
  }

  if (resolved?.kind === "codeSet") {
    // An unpicked dictionary is still emitted, so the Go deploy validation
    // names the field; its blank key is dropped, as Go's `omitempty` does.
    return {
      optionSource: {
        kind: "codeSet",
        ...resolved.codeSet.length > 0 && { codeSet: resolved.codeSet }
      }
    };
  }

  if (resolved?.kind === "remote") {
    const mapping = normalizeOptionMapping(resolved.mapping);

    return {
      optionSource: {
        kind: "remote",
        ...resolved.request !== undefined && { request: resolved.request },
        ...mapping !== undefined && { mapping }
      }
    };
  }

  return {};
}

/**
 * The column type to emit for a leaf field. An explicit designer override is
 * always honored; otherwise the widget-derived inference applies — EXCEPT
 * the number widget's precision-less "integer" fallback. The Go runtime
 * rejects fractional values on an integer column regardless of storage mode,
 * so a plain number field (no precision configured) must stay ungated: with
 * no columnType the backend falls back to a gate-free numeric column.
 */
function resolveColumnType(field: KeyedField): ColumnDataType | undefined {
  if (field.columnType !== undefined) {
    return field.columnType;
  }

  const inferred = inferColumnType(field);

  return field.type === "number" && inferred === "integer" ? undefined : inferred;
}

/**
 * Whether a regex source uses a construct RE2 (the Go regexp engine)
 * definitively does not support: lookahead / lookbehind groups and
 * backreferences. JS accepts all of them, so neither the designer nor
 * form-editor's validateSchema can catch this — without the check the
 * pattern passes every frontend gate and the deploy fails server-side.
 * Escapes and character classes are tracked so `\(?=` and `[(?=]` do not
 * false-positive.
 */
function hasRe2UnsupportedConstruct(source: string): boolean {
  let inClass = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (char === "\\") {
      const next = source[i + 1];

      // A backreference is only meaningful outside a character class (inside
      // one, \1 is an octal escape).
      if (!inClass && next !== undefined && next >= "1" && next <= "9") {
        return true;
      }

      i++;

      continue;
    }

    if (char === "[") {
      inClass = true;

      continue;
    }

    if (char === "]") {
      inClass = false;

      continue;
    }

    if (inClass) {
      continue;
    }

    if (char === "(" && source[i + 1] === "?") {
      const rest = source.slice(i + 2);

      if (rest.startsWith("=") || rest.startsWith("!") || rest.startsWith("<=") || rest.startsWith("<!")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Split the designer's `validate` mixin into the backend's `isRequired` flag
 * and the residual validation rule (omitted when empty).
 */
function splitValidation(field: KeyedField): { isRequired: boolean; rule?: ApprovalValidationRule } {
  const { required, ...rest } = (field as Validatable).validate ?? {};
  const entries = Object.entries(rest).filter(([, value]) => value !== undefined);

  return {
    isRequired: required === true,
    ...entries.length > 0 && { rule: Object.fromEntries(entries) as ApprovalValidationRule }
  };
}

/**
 * Warn when a projected node carries linkage: the backend evaluates the flat
 * definition only, so dynamic hide / require behavior does not survive
 * projection — in particular a linkage-hidden field's value is dropped from
 * the submit payload, which conflicts with a static `isRequired`.
 */
function warnOnLinkage(node: { linkage?: FieldLinkage }, path: string, issues: ProjectionIssue[]): void {
  const { linkage } = node;

  if (linkage !== undefined && (linkage.defaults !== undefined || (linkage.rules?.length ?? 0) > 0)) {
    issues.push(issueLinkageNotProjected(path));
  }
}

/**
 * Whether a projected root field's visibility can be toggled off by linkage —
 * its own linkage, or that of any layout-container ancestor on the path to it.
 * The designer flags a node that grants `required` on such a field: the
 * renderer exempts a linkage-hidden field from validation and drops its value,
 * but the backend's `required` check is linkage-blind and would reject the
 * approve forever while the field is hidden (a deadlock the backend cannot
 * fix). A root field's ancestors are only layout containers — a subform
 * ancestor would place the field in a deeper value scope, excluding it from the
 * projection — so climbing `findParentContainer` never crosses a value scope.
 */
function hasConditionalVisibility(layer: PresentationLayer, node: Block & KeyedNode): boolean {
  if (isHideCapableLinkage(node.linkage)) {
    return true;
  }

  for (let container = findParentContainer(layer, node.id); container !== undefined; container = findParentContainer(layer, container.id)) {
    if (isHideCapableLinkage(container.linkage)) {
      return true;
    }
  }

  return false;
}

/**
 * Whether a linkage can drive a field hidden: a `hidden` default, a `hide` /
 * `show` state action (visibility is linkage-governed either way), or a
 * `script` action (its returned patch can set `hidden`).
 */
function isHideCapableLinkage(linkage: FieldLinkage | undefined): boolean {
  if (linkage === undefined) {
    return false;
  }

  if (linkage.defaults?.hidden === true) {
    return true;
  }

  return (linkage.rules ?? []).some(rule => rule.actions.some(action => action.type === "hide" || action.type === "show" || action.type === "script"));
}
