import type { FormField, FormVariable } from "../../types";
import type { ReferenceScope } from "./reference-scope";

import { isDeepEqual, omit } from "@vef-framework-react/shared";
import { useDeferredValue, useMemo, useRef } from "react";

import { findScope } from "../../engine/schema/walk";
import { useCurrentLayer, useFormEditorStore } from "../../store/form-store";
import { useContextSources } from "../context-sources";
import { collectSourceCandidates, getSourceFieldOptions } from "./entries/linkage/options";

const ROOT_SCOPE_KEY = "";

const NO_VARIABLES: readonly FormVariable[] = [];

function isSameDeclaration(previous: FormField | undefined, next: FormField): boolean {
  return previous !== undefined
    && (previous === next || isDeepEqual(omit(previous, ["linkage"]), omit(next, ["linkage"])));
}

/**
 * Keep the field list's identity while nothing but the fields' own linkage
 * changed.
 *
 * Every store edit rebuilds the list, and a keystroke in a rule replaces the
 * field holding it. Downstream this identity feeds `RuleCard`'s memo, so a
 * fresh one per keystroke would re-render every rule card and its mounted
 * CodeMirror; nothing there reads a candidate's linkage.
 *
 * The ref write happens during render but is idempotent for a given content,
 * so StrictMode double-renders and discarded concurrent renders stay
 * consistent — the same argument as the renderer's `prevRef` reconciliation.
 */
function useStableFields(fields: FormField[]): FormField[] {
  const ref = useRef(fields);

  if (
    ref.current !== fields
    && (ref.current.length !== fields.length || fields.some((field, index) => !isSameDeclaration(ref.current[index], field)))
  ) {
    ref.current = fields;
  }

  return ref.current;
}

/**
 * The fields sharing the value scope `nodeId` sits in. `null` is the form
 * itself: the root scope of the PC layout, which the form-level events and the
 * form-global data sources resolve against.
 *
 * The walk only matters on a structural edit, so it runs against a deferred
 * layer, keeping per-keystroke typing latency off it.
 */
export function useScopeFields(nodeId: string | null): FormField[] {
  const currentLayer = useCurrentLayer();
  const pcLayer = useFormEditorStore(state => state.schema.presentations.pc);
  const layer = useDeferredValue(nodeId === null ? pcLayer : currentLayer);

  // Serialized so the walk below re-runs only when the scope itself changes (a
  // node move), not on every fresh-but-equal scope array.
  const scopeKey = useMemo(
    () => nodeId === null ? ROOT_SCOPE_KEY : (findScope(layer, nodeId) ?? []).join("/"),
    [layer, nodeId]
  );

  return useStableFields(useMemo(
    () => collectSourceCandidates(layer, scope => scope.join("/") === scopeKey),
    [layer, scopeKey]
  ));
}

/**
 * What a value in the scope of `fields` can refer to, step results aside.
 */
export function useFieldsReferenceScope(fields: FormField[]): ReferenceScope {
  const variables = useFormEditorStore(state => state.schema.variables) ?? NO_VARIABLES;
  const contextSources = useContextSources();

  return useMemo(
    () => {
      return {
        fieldOptions: getSourceFieldOptions({ components: fields }),
        variables,
        contextSources
      };
    },
    [fields, variables, contextSources]
  );
}
