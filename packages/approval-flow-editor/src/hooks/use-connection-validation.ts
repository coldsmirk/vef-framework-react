import type { Connection, Edge } from "@xyflow/react";

import { useCallback } from "react";

import { validateConnection } from "../shared/connection-rules";
import { useEditorStoreApi } from "../store";

/**
 * Hook that provides a connection validator bound to current editor state
 */
export function useConnectionValidation() {
  const storeApi = useEditorStoreApi();

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const { edges } = storeApi.getState();
      return validateConnection(connection, edges);
    },
    [storeApi]
  );

  return { isValidConnection };
}
