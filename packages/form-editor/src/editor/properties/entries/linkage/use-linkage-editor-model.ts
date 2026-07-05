import type { ValidationIssue } from "../../../../engine/validation";
import type { FieldLinkage, FormDataSource, PresentationLayer } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { useDeferredValue, useMemo, useRef } from "react";

import { validateLinkageSchema } from "../../../../engine/linkage";
import { findScope } from "../../../../engine/schema/walk";
import { collectSourceCandidates, getDataSourceOptions, getSourceFieldOptions } from "./options";
import { groupIssuesByRule, stabilizeIssueBuckets } from "./rule-diagnostics";
import { useStableOptions } from "./use-stable-options";

const ROOT_SCOPE_KEY = "";

export interface LinkageEditorModel {
  /**
   * Same-scope keyed-field options — the condition source and `set_field` target
   * picker share this list. Stable identity (see {@link useStableOptions}).
   */
  fieldOptions: SourceFieldOption[];
  /**
   * The form's named data sources, for a `refresh_data_source` action.
   */
  dataSourceOptions: SourceFieldOption[];
  /**
   * Validator issues hung onto each rule by id, for live in-card diagnostics.
   */
  issuesByRule: ReturnType<typeof groupIssuesByRule>;
}

/**
 * The shared model behind every linkage editor host — the field-level entry, the
 * container section, and the form-level events panel. Each resolves the same
 * three things (same-scope field options, data-source options, deferred rule
 * diagnostics) and differed only in which layer/scope they walk and whether the
 * form-level linkage participates; that wiring lived copy-pasted across all
 * three.
 *
 * `nodeId` is the node whose own value scope the sources resolve in (`null` for
 * the form-level root scope). `formLinkage` is threaded only by the form panel so
 * its diagnostics see the shared linkage; field/container pass `undefined`.
 *
 * The structural passes (scope resolution, the candidate walk, and validation)
 * only change on a structural edit — never on the linkage keystroke being typed —
 * so they run against a {@link useDeferredValue} layer at transition priority,
 * keeping per-keystroke typing latency off them.
 */
export function useLinkageEditorModel(args: {
  layer: PresentationLayer;
  nodeId: string | null;
  dataSources: FormDataSource[] | undefined;
  formLinkage?: FieldLinkage;
}): LinkageEditorModel {
  const {
    dataSources,
    formLinkage,
    layer,
    nodeId
  } = args;

  const deferredLayer = useDeferredValue(layer);
  const deferredFormLinkage = useDeferredValue(formLinkage);

  // The node's value scope, serialized to a stable string so the candidate walk
  // below re-runs only when the scope actually changes (a node move), not on
  // every fresh-but-equal scope array. `findScope` is itself deferred.
  const scopeKey = useMemo(
    () => nodeId === null ? ROOT_SCOPE_KEY : (findScope(deferredLayer, nodeId) ?? []).join("/"),
    [deferredLayer, nodeId]
  );

  const fieldOptions = useStableOptions(useMemo(
    () => getSourceFieldOptions({
      components: collectSourceCandidates(deferredLayer, candidateScope => candidateScope.join("/") === scopeKey)
    }),
    [deferredLayer, scopeKey]
  ));

  const dataSourceOptions = useMemo(() => getDataSourceOptions(dataSources), [dataSources]);
  // Bucket identities are reconciled against the previous run so an
  // issue-carrying RuleCard's memo survives unrelated edits. The render-phase
  // ref write is safe for the same reason as useStableOptions: stabilizing is
  // idempotent under self-composition.
  const issuesByRuleRef = useRef<Map<string, ValidationIssue[]>>(undefined);
  const issuesByRule = useMemo(
    () => stabilizeIssueBuckets(
      issuesByRuleRef.current,
      groupIssuesByRule(validateLinkageSchema(deferredLayer, deferredFormLinkage).issues)
    ),
    [deferredLayer, deferredFormLinkage]
  );

  issuesByRuleRef.current = issuesByRule;

  return {
    fieldOptions,
    dataSourceOptions,
    issuesByRule
  };
}
