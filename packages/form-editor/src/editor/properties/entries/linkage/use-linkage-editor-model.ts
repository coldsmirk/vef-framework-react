import type { ValidationIssue } from "../../../../engine/validation";
import type { FieldLinkage, FormDataSource, PresentationLayer } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { useDeferredValue, useMemo, useRef } from "react";

import { validateLinkageSchema } from "../../../../engine/linkage";
import { findScope } from "../../../../engine/schema/walk";
import { collectSourceCandidates, getDataSourceOptions, getSourceFieldOptions, getTargetFieldOptions } from "./options";
import { groupIssuesByRule, stabilizeIssueBuckets } from "./rule-diagnostics";
import { useStableOptions } from "./use-stable-options";

const ROOT_SCOPE_KEY = "";

export interface LinkageEditorModel {
  /**
   * Same-scope keyed-field options for condition sources.
   */
  fieldOptions: SourceFieldOption[];
  /**
   * Same-scope writable keyed-field options for `set_fields` targets (excludes
   * non-writable field types such as `upload`).
   */
  targetOptions: SourceFieldOption[];
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

  const candidates = useMemo(
    () => collectSourceCandidates(deferredLayer, candidateScope => candidateScope.join("/") === scopeKey),
    [deferredLayer, scopeKey]
  );

  const fieldOptions = useStableOptions(useMemo(
    () => getSourceFieldOptions({ components: candidates }),
    [candidates]
  ));

  const targetOptions = useStableOptions(useMemo(
    () => getTargetFieldOptions({ components: candidates }),
    [candidates]
  ));

  const dataSourceOptions = useMemo(() => getDataSourceOptions(dataSources), [dataSources]);
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
    targetOptions,
    dataSourceOptions,
    issuesByRule
  };
}
