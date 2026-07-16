import type { Contract, System } from "../../types";

import { createApiRequest, useApiClient, useQuery } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "../../api";

interface DirectoryEntry {
  id: string;
  code: string;
  name: string;
}

/**
 * A loaded set of definitions, ready for select options and id→entry lookups.
 */
export interface Directory<T extends DirectoryEntry> {
  items: T[];
  byId: Map<string, T>;
  options: Array<{ label: string; value: string }>;
  loading: boolean;
}

function useDirectory<T extends DirectoryEntry>(resource: string, key: string): Directory<T> {
  const apiClient = useApiClient();

  const queryFn = useMemo(
    () => apiClient.createQueryFn<T[]>(key, ({ post }) => async () => {
      const result = await post<T[]>(API_PATH, { data: createApiRequest(resource, "find_all", {}) });

      return result.data;
    }),
    [apiClient, resource, key]
  );

  const { data, isLoading } = useQuery({ queryFn, queryKey: [queryFn.key] });

  return useMemo(() => {
    const items = data ?? [];

    return {
      items,
      byId: new Map(items.map(item => [item.id, item])),
      options: items.map(item => { return { label: `${item.name}（${item.code}）`, value: item.id }; }),
      loading: isLoading
    };
  }, [data, isLoading]);
}

/**
 * All systems, for select options and id→system lookups.
 */
export function useSystemDirectory(): Directory<System> {
  return useDirectory<System>("integration/system", "integration_system_find_all");
}

/**
 * All contracts, for select options and id→contract lookups.
 */
export function useContractDirectory(): Directory<Contract> {
  return useDirectory<Contract>("integration/contract", "integration_contract_find_all");
}
