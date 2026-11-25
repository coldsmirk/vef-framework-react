import type { WritableTargetField } from "../../../../engine/linkage";
import type { ValidationIssue } from "../../../../engine/validation";
import type { FieldLinkage, FormDataSource, FormVariable, KeyedFormField, PresentationLayer } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { useDeferredValue, useMemo, useRef } from "react";

import { isKeyedField } from "../../../../engine/keys";
import { isWritableTargetField, validateLinkageSchema } from "../../../../engine/linkage";
import { findScope } from "../../../../engine/schema/walk";
import { collectSourceCandidates, getDataSourceOptions, getSourceFieldOptions, getTargetFieldOptions } from "./options";
import { groupIssuesByRule, stabilizeIssueBuckets } from "./rule-diagnostics";
import { useStableOptions } from "./use-stable-options";

const ROOT_SCOPE_KEY = "";
const EMPTY_DATA_SOURCES: readonly FormDataSource[] = [];
const EMPTY_VARIABLES: readonly FormVariable[] = [];

export interface LinkageEditorModel {
  /**
   * Same-scope keyed-field options for condition sources and reference pickers.
   */
  fieldOptions: SourceFieldOption[];
  /**
   * Same-scope writable keyed-field options for `set_fields` targets (excludes
   * non-writable field types such as `upload`).
   */
  targetOptions: SourceFieldOption[];
  /**
   * Same-scope writable keyed fields themselves, powering `set_fields` typed
   * literal inputs and "按名称匹配".
   */
  writableTargets: readonly WritableTargetField[];
  /**
   * Same-scope keyed fields indexed by key, powering `select_record`
   * auto-inferred column previews and human-readable summaries.
   */
  scopeFieldsByKey: ReadonlyMap<string, KeyedFormField>;
  /**
   * Form-global data sources for `TypedLiteralInput` (`ref` → static options).
   */
  dataSources: readonly FormDataSource[];
  /**
   * Form-global declared variables for unified condition and reference pickers.
   */
  variables: readonly FormVariable[];
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
 * things (same-scope field metadata, data-source options, variables, deferred
 * rule diagnostics) and differed only in which layer/scope they walk and
 * whether the form-level linkage participates; that wiring lived copy-pasted
 * across all three.
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
  variables?: FormVariable[];
  formLinkage?: FieldLinkage;
}): LinkageEditorModel {
  const {
    dataSources,
    formLinkage,
    layer,
    nodeId,
    variables
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

  const writableTargets = useMemo(
    () => candidates.filter(isWritableTargetField),
    [candidates]
  );

  const scopeFieldsByKey = useMemo(() => {
    const map = new Map<string, KeyedFormField>();

    for (const candidate of candidates) {
      if (isKeyedField(candidate)) {
        map.set(candidate.key, candidate);
      }
    }

    return map;
  }, [candidates]);

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
    targetOptions,
    writableTargets,
    scopeFieldsByKey,
    dataSources: dataSources ?? EMPTY_DATA_SOURCES,
    variables: variables ?? EMPTY_VARIABLES,
    dataSourceOptions,
    issuesByRule
  };
}
