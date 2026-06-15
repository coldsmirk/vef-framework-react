import type { FieldLinkage, FormDataSource, FormVariable, PresentationLayer } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { useDeferredValue, useMemo } from "react";

import { validateLinkageSchema } from "../../../../engine/linkage";
import { findScope } from "../../../../engine/schema/walk";
import { collectSourceCandidates, getDataSourceOptions, getSourceFieldOptions } from "./options";
import { groupIssuesByRule } from "./rule-diagnostics";
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
   * Declared `$vars` names, for the expression editors' completion.
   */
  variableNames: string[];
  /**
   * Validator issues hung onto each rule by id, for live in-card diagnostics.
   */
  issuesByRule: ReturnType<typeof groupIssuesByRule>;
}

/**
 * The shared model behind every linkage editor host — the field-level entry, the
 * container section, and the form-level events panel. Each resolves the same
 * four things (same-scope field options, data-source options, variable names,
 * deferred rule diagnostics) and differed only in which layer/scope they walk
 * and whether the form-level linkage participates; that wiring lived copy-pasted
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
  variables: FormVariable[] | undefined;
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

  const fieldOptions = useStableOptions(useMemo(
    () => getSourceFieldOptions({
      components: collectSourceCandidates(deferredLayer, candidateScope => candidateScope.join("/") === scopeKey)
    }),
    [deferredLayer, scopeKey]
  ));

  const dataSourceOptions = useMemo(() => getDataSourceOptions(dataSources), [dataSources]);
  const variableNames = useMemo(() => variables?.map(variable => variable.name) ?? [], [variables]);
  const issuesByRule = useMemo(
    () => groupIssuesByRule(validateLinkageSchema(deferredLayer, deferredFormLinkage).issues),
    [deferredLayer, deferredFormLinkage]
  );

  return {
    fieldOptions,
    dataSourceOptions,
    variableNames,
    issuesByRule
  };
}
