import type { FormFieldDefinition as FlowFormFieldDefinition } from "@vef-framework-react/approval-flow-editor";
import type {
  Block,
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
  issueLinkageNotProjected,
  issueNestedSubform,
  issueOptionsNotStatic,
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

  // key → projected kind, or null when the node was unprojectable. Dedup
  // applies to both; the cross-device mismatch warning only fires between
  // two successfully projected sightings.
  const seen = new Map<string, ApprovalFieldKind | null>();

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
        const kind = peekKind(node);

        if (previous !== null && kind !== null && kind !== previous) {
          issues.push(issueCrossDeviceKindMismatch(node.key, previous, kind));
        }

        return;
      }

      const projected = node.type === "subform"
        ? projectSubform(node as SubformNode, dataSources, issues)
        : projectLeaf(node as KeyedField, node.key, dataSources, issues);

      seen.set(node.key, projected === undefined ? null : projected.approval.kind);

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
  const columnType = inferColumnType(field);
  const { precision } = field as { precision?: number };
  const { placeholder } = field as { placeholder?: string };

  const approval: Omit<ApprovalFormField, "sortOrder"> = {
    key: field.key,
    kind,
    label,
    ...placeholder !== undefined && { placeholder },
    ...isRequired && { isRequired },
    ...options !== undefined && { options },
    ...rule !== undefined && { validation: rule },
    columnType,
    ...columnType === "decimal" && precision !== undefined && precision > 0 && { scale: precision }
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
  let nested = false;

  walkNodes({ children: subform.template }, (node, scope) => {
    if (scope.length > 0 || !isKeyedNode(node)) {
      return;
    }

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
