import type { ProTableRef } from "../../pro-table";

import { useEffect, useRef } from "react";

import { useCrudStoreApi } from "../store";

/**
 * Hook to observe and sync ProTable query state with Crud store.
 */
export function useQueryObserver() {
  const tableRef = useRef<ProTableRef>(null);
  const store = useCrudStoreApi();

  useEffect(() => {
    const ref = tableRef.current;

    if (!ref) {
      return;
    }

    store.setState(state => {
      state.refetchQuery = ref.refetch;
    });

    const unsubscribeLoading = ref.onLoading(() => {
      store.setState(state => {
        state.isQueryFetching = true;
      });
    });

    const unsubscribeLoaded = ref.onLoaded(() => {
      store.setState(state => {
        state.isQueryFetching = false;
      });
    });

    return () => {
      unsubscribeLoading();
      unsubscribeLoaded();
    };
  }, [store]);

  return tableRef;
}
