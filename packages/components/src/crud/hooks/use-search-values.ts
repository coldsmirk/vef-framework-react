import type { AnyObject } from "@vef-framework-react/shared";

import { useCrudStore } from "../store";

export function useSearchValues<TSearchValues extends AnyObject>() {
  return useCrudStore(state => state.searchValues as TSearchValues);
}
