import type { RuntimeFieldState } from "../engine/linkage";
import type { RuntimeStateMap } from "./types";

import { createContextWithSelector } from "@vef-framework-react/core";

import { emptyRuntimeState } from "../engine/linkage";

/**
 * Selector-backed runtime-state scope. The `Provider` publishes a
 * `RuntimeStateMap` (the root form, or one subform row); descendants read a
 * single field's slice via {@link useRuntimeFieldState}. The runtime controllers
 * own the Provider — see `runtime-state-controller.tsx`.
 */
const { Provider: RuntimeStateContextProvider, useContext: useRuntimeStateContext }
  = createContextWithSelector<RuntimeStateMap>({});

export { RuntimeStateContextProvider };

/**
 * Read one field's runtime state. Backed by a selector context: the inline
 * selector closes over `fieldId` and `useSyncExternalStore` bails on the
 * result's `Object.is`, so a field re-renders only when its OWN state object
 * reference changes — which the controller's `stabilizeStateMap` makes true
 * for exactly the fields whose linkage outcome flipped. The `?? emptyRuntimeState`
 * fallback is a module singleton, so unlinked fields stay reference-stable too.
 */
export function useRuntimeFieldState(fieldId: string): RuntimeFieldState {
  return useRuntimeStateContext(map => map[fieldId] ?? emptyRuntimeState);
}
