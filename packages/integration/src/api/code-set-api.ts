import type { QueryFunction } from "@vef-framework-react/core";

import type { CodeCatalog, CodeSetCatalog } from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "./query";

/**
 * The host canonical code catalog behind the mapping editor: both queries
 * report `supported: false` when the host registered no enumerable catalog
 * (`mold.CodeSetInspector`), and the editor degrades to free-text input.
 */
export interface CodeSetApi {
  listCodeSets: QueryFunction<CodeSetCatalog, object>;
  listCodes: QueryFunction<CodeCatalog, { codeSet: string }>;
}

/**
 * Catalog API for the host's canonical code sets.
 */
export function useCodeSetApi(): CodeSetApi {
  const apiClient = useApiClient();

  return useMemo<CodeSetApi>(
    () => {
      return {
        listCodeSets: apiClient.createQueryFn<CodeSetCatalog, object>(
          "integration_code_set_list_code_sets",
          ({ post }) => async () => {
            const result = await post<CodeSetCatalog>(API_PATH, { data: createApiRequest("integration/code_set", "list_code_sets") });

            return result.data;
          }
        ),
        listCodes: apiClient.createQueryFn<CodeCatalog, { codeSet: string }>(
          "integration_code_set_list_codes",
          ({ post }) => async params => {
            const result = await post<CodeCatalog>(API_PATH, { data: createApiRequest("integration/code_set", "list_codes", params) });

            return result.data;
          }
        )
      };
    },
    [apiClient]
  );
}
