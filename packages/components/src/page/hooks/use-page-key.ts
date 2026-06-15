import { useCallback, useState } from "react";

import { useReloadPageEvent } from "../../_base";

export function usePageKey(): number {
  const [pageKey, setPageKey] = useState(1);

  const handlePageReload = useCallback(
    () => {
      setPageKey(prev => prev + 1);
    },
    []
  );

  useReloadPageEvent(handlePageReload);

  return pageKey;
}
