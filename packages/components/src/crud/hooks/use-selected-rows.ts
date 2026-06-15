import type { AnyObject } from "@vef-framework-react/shared";

import { useCrudStore } from "../store";

export function useSelectedRows<TRow extends AnyObject>() {
  return useCrudStore(state => state.selectedRows as TRow[]);
}
