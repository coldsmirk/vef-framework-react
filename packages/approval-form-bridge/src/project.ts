import type { FormFieldDefinition as FlowFormFieldDefinition } from "@vef-framework-react/approval-flow-editor";
import type {
  Block,
  ColumnDataType,
  FieldLinkage,
  FieldOptionSource,
  FormDataSource,
  FormField,
  FormSchema,
  KeyedNode,
  SubformNode,
  Validatable
} from "@vef-framework-react/form-editor";

import type { ApprovalFieldKind, ApprovalFieldOption, ApprovalFormDefinition, ApprovalFormField, ApprovalValidationRule } from "./contract";
import type { ProjectionIssue } from "./issues";

import { inferColumnType, isKeyedNode, walkNodes } from "@vef-framework-react/form-editor";

import {
  issueCrossDeviceKindMismatch,
  issueCrossDeviceTableMismatch,
  issueDecimalScaleMissing,
  issueLinkageNotProjected,
  issueNestedSubform,
  issueOptionsNotStatic,
  issuePatternUnsupported,
  issueTableColumnsEmpty,
  issueUnknownFieldType,
  issueUnmappableFieldType
} from "./issues";

/**
 * Result of projecting a designed {@link FormSchema} onto the approval form
 * contract. One walk feeds both consumers so they cannot disagree:
 * `definition` is the flat backend payload (`DeployFlowCmd.FormDefinition`),
 * `formFields` is the same inventory in the shape the approval flow editor
 * consumes through `EditorPlugins.formFields` (detail-table fields included,
 * with their columns, so the condition editor's aggregate UI works).
 */
export interface ProjectionResult {
  definition: ApprovalFormDefinition;
  formFields: FlowFormFieldDefinition[];
  issues: ProjectionIssue[];
  /**
   * `true` when no error-severity issue was raised. The backend's form data
   * is a closed contract — deploying an invalid projection either fails the
   * deploy validation or poisons every submit — so hosts must gate
   * persistence on this flag.
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
 * textarea / date, JSON number for number, scalar-or-array for select).
 *
 * `switch` (boolean) and `daterange` ([start, end] array) are deliberately
 * absent: the Go runtime validates input / date values with `MustBeString`,
 * so both would deploy fine and then reject every submission. They surface
 * as `unmappable_field_type` errors instead (and the approval registry
 * profile excludes their widgets up front).
 */
const KIND_BY_TYPE: Record<string, ApprovalFieldKind> = {
  textfield: "input",
  "code-editor": "textarea",
  textarea: "textarea",
  number: "number",
  select: "select",
  radio: "select",
  "checkbox-group": "select",
  date: "date",
  datetime: "date"
};

/**
 * Widget types that bind a value the approval contract cannot carry (as
 * opposed to unknown consumer-registered types).
 */
const UNMAPPABLE_TYPES: ReadonlySet<string> = new Set(["switch", "daterange"]);

interface ProjectedField {
  approval: Omit<ApprovalFormField, "sortOrder">;
  flow: FlowFormFieldDefinition;
}

/**
 * What the dedup map remembers about a projected key, enough to detect a
 * cross-device contract conflict on a later sighting without re-projecting.
 */
interface SeenProjection {
  kind: ApprovalFieldKind;
  /**
   * Column signature of a table field ({@link peekTableSignature}); absent
   * for scalar kinds.
   */
  tableSignature?: string;
}

/**
 * Project a designed form schema onto the approval form contract.
 *
 * Both device presentations are walked (pc first) and deduped by key — the
 * submitted data contract is shared across devices, and the backend's form
 * data is closed, so a mobile-only field must still project. Only root-scope
 * keyed nodes become fields: leaf fields map by {@link KIND_BY_TYPE}, a
 * subform becomes a single-level `table` field whose template's keyed leaves
 * are its columns (layout containers in the template are transparent — only
 * a subform opens a value scope, so the submitted row stays a flat record).
 *
 * Conservation rule: a keyed node that cannot be mapped is always an
 * error-severity issue, never silently dropped.
 */
export function projectFormSchema(schema: FormSchema): ProjectionResult {
  const issues: ProjectionIssue[] = [];
  const fields: ApprovalFormField[] = [];
  const formFields: FlowFormFieldDefinition[] = [];
  const dataSources = new Map((schema.dataSources ?? []).map(source => [source.id, source]));

  // key → what the first sighting projected, or null when it was
  // unprojectable. Dedup applies to both; the cross-device conflict checks
  // only fire between two successfully projectable sightings.
  const seen = new Map<string, SeenProjection | null>();

  for (const layer of [schema.presentations.pc, schema.presentations.mobile]) {
    if (layer === undefined) {
      continue;
    }

    walkNodes(layer, (node, scope) => {
      if (scope.length > 0 || !isKeyedNode(node)) {
        return;
      }

      const previous = seen.get(node.key);

      if (previous !== undefined) {
        // The submitted data contract is shared across devices, so a second
        // sighting that would project a DIFFERENT contract means the losing
        // device submits values the deployed definition rejects — an error,
        // not a preference. Kind conflicts and table column-set conflicts
        // are detected; a same-kind options/validation divergence is not
        // (documented limitation).
        if (previous !== null) {
          const kind = peekKind(node);

          if (kind !== null && kind !== previous.kind) {
            issues.push(issueCrossDeviceKindMismatch(node.key, previous.kind, kind));
          } else if (
            kind === "table"
            && previous.tableSignature !== undefined
            && peekTableSignature(node as SubformNode) !== previous.tableSignature
          ) {
            issues.push(issueCrossDeviceTableMismatch(node.key));
          }
        }

        return;
      }

      const isSubform = node.type === "subform";
      const projected = isSubform
        ? projectSubform(node as SubformNode, dataSources, issues)
        : projectLeaf(node as KeyedField, node.key, dataSources, issues);

      seen.set(node.key, projected === undefined
        ? null
        : {
            kind: projected.approval.kind,
            ...isSubform && { tableSignature: peekTableSignature(node as SubformNode) }
          });

      if (projected !== undefined) {
        fields.push({ ...projected.approval, sortOrder: fields.length });
        formFields.push(projected.flow);
      }
    });
  }

  return {
    definition: { fields },
    formFields,
    issues,
    valid: issues.every(issue => issue.severity !== "error")
  };
}

/**
 * The kind a keyed node would project to, without projecting it — used to
 * detect a cross-device kind conflict on an already-seen key.
 */
function peekKind(node: Block & KeyedNode): ApprovalFieldKind | null {
  if (node.type === "subform") {
    return "table";
  }

  return KIND_BY_TYPE[node.type] ?? null;
}

/**
 * Contract signature of a subform's column set — the ordered, deduplicated
 * `key:kind` pairs of its template's keyed leaves (layout containers are
 * transparent, matching the projection walk). Two devices whose signatures
 * differ deploy a definition at least one of them cannot submit against.
 */
function peekTableSignature(subform: SubformNode): string {
  const parts: string[] = [];
  const seenKeys = new Set<string>();

  walkNodes({ children: subform.template }, (node, scope) => {
    if (scope.length > 0 || !isKeyedNode(node) || seenKeys.has(node.key)) {
      return;
    }

    seenKeys.add(node.key);
    parts.push(`${node.key}:${node.type === "subform" ? "table" : KIND_BY_TYPE[node.type] ?? "?"}`);
  });

  return parts.join(",");
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
  const options = resolveOptions(field, path, dataSources, issues);
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

  const approval: Omit<ApprovalFormField, "sortOrder"> = {
    key: field.key,
    kind,
    label,
    ...placeholder !== undefined && { placeholder },
    ...isRequired && { isRequired },
    ...options !== undefined && { options },
    ...rule !== undefined && { validation: rule },
    ...columnType !== undefined && { columnType },
    ...columnType === "decimal" && hasScale && { scale: precision }
  };

  const flow: FlowFormFieldDefinition = {
    key: field.key,
    kind,
    label,
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
  const isRequired = (subform.minRows ?? 0) >= 1;
  const rule: ApprovalValidationRule = {
    ...subform.minRows !== undefined && subform.minRows > 0 && { minLength: subform.minRows },
    ...subform.maxRows !== undefined && { maxLength: subform.maxRows }
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

/**
 * Static `{ label, value }` options for a selection field: an inline
 * `static` source or a `ref` to a form-global static data source resolve
 * here; a remote source (inline or referenced) — and a dangling ref — is
 * host-resolved at runtime, so the projection omits options and warns that
 * the backend will accept any submitted value.
 */
function resolveOptions(
  field: KeyedField,
  path: string,
  dataSources: Map<string, FormDataSource>,
  issues: ProjectionIssue[]
): ApprovalFieldOption[] | undefined {
  const source = (field as { dataSource?: FieldOptionSource }).dataSource;

  if (source === undefined) {
    return undefined;
  }

  if (source.kind === "static") {
    return source.options;
  }

  if (source.kind === "ref") {
    const referenced = dataSources.get(source.dataSourceId);

    if (referenced?.kind === "static") {
      return referenced.options;
    }
  }

  issues.push(issueOptionsNotStatic(path));

  return undefined;
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
