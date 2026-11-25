import type { WritableTargetField } from "../../../../engine/linkage";
import type { ValidationIssue } from "../../../../engine/validation";
import type { FormDataSource, KeyedFormField } from "../../../../types";
import type { ReferenceScope } from "../../reference-scope";
import type { SourceFieldOption } from "./options";

import { useDeferredValue, useMemo, useRef } from "react";

import { isKeyedField } from "../../../../engine/keys";
import { isWritableTargetField, validateLinkageSchema } from "../../../../engine/linkage";
import { useCurrentLayer, useFormEditorStore } from "../../../../store/form-store";
import { useFieldsReferenceScope, useScopeFields } from "../../scope-fields";
import { getDataSourceOptions, getTargetFieldOptions } from "./options";
import { groupIssuesByRule, stabilizeIssueBuckets } from "./rule-diagnostics";

const NO_DATA_SOURCES: readonly FormDataSource[] = [];

/**
 * What the rules of one linkage panel can read and write. One object, stable
 * across linkage edits, so it passes through the memoized rule cards whole.
 */
export interface LinkageScope {
  /**
   * What conditions and dynamic values can refer to.
   */
  reference: ReferenceScope;
  /**
   * The keyed fields sharing the owner's value scope.
   */
  fieldsByKey: ReadonlyMap<string, KeyedFormField>;
  /**
   * The ones `set_fields` can write, and their picker options.
   */
  writableTargets: readonly WritableTargetField[];
  targetOptions: SourceFieldOption[];
  /**
   * The form's data sources, and their picker options.
   */
  dataSources: readonly FormDataSource[];
  dataSourceOptions: SourceFieldOption[];
}

export interface LinkageEditorModel {
  scope: LinkageScope;
  /**
   * Validator issues hung onto each rule by id, for live in-card diagnostics.
   */
  issuesByRule: ReturnType<typeof groupIssuesByRule>;
}

/**
 * The model behind every linkage editor — a field's, a container's, and the
 * form's events (`null`). Each resolves the value scope its owner sits in: a
 * subform field references its row siblings, not the outer form.
 *
 * Validation only changes on a structural edit, so like the scope walk it runs
 * against deferred values.
 */
export function useLinkageEditorModel(ownerNodeId: string | null): LinkageEditorModel {
  const fields = useScopeFields(ownerNodeId);
  const reference = useFieldsReferenceScope(fields);
  const dataSources = useFormEditorStore(state => state.schema.dataSources) ?? NO_DATA_SOURCES;

  const scope = useMemo<LinkageScope>(
    () => {
      return {
        reference,
        fieldsByKey: new Map(fields.filter(isKeyedField).map(field => [field.key, field])),
        writableTargets: fields.filter(isWritableTargetField),
        targetOptions: getTargetFieldOptions({ components: fields }),
        dataSources,
        dataSourceOptions: getDataSourceOptions(dataSources)
      };
    },
    [reference, fields, dataSources]
  );

  const currentLayer = useCurrentLayer();
  const pcLayer = useFormEditorStore(state => state.schema.presentations.pc);
  // Only the form's own panel shows the form linkage's issues; rule ids are
  // unique, so the fields' issues never leak into its cards.
  const formLinkage = useFormEditorStore(state => ownerNodeId === null ? state.schema.linkage : undefined);
  const layer = useDeferredValue(ownerNodeId === null ? pcLayer : currentLayer);
  const deferredFormLinkage = useDeferredValue(formLinkage);

  // Bucket identities are reconciled against the previous run so an
  // issue-carrying RuleCard's memo survives unrelated edits. The render-phase
  // ref write is safe for the same reason as in useScopeFields: stabilizing is
  // idempotent under self-composition.
  const issuesByRuleRef = useRef<Map<string, ValidationIssue[]>>(undefined);
  const issuesByRule = useMemo(
    () => stabilizeIssueBuckets(
      issuesByRuleRef.current,
      groupIssuesByRule(validateLinkageSchema(layer, deferredFormLinkage).issues)
    ),
    [layer, deferredFormLinkage]
  );

  issuesByRuleRef.current = issuesByRule;

  return { scope, issuesByRule };
}
