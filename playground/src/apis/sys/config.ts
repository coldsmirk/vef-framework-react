import type { ConfigDefinition } from "./config-definition";

import { API_PATH, apiClient, createApiRequest } from "~api";

export interface ConfigsParams {
  category: string;
  configValues: Record<string, any>;
}

export interface Configs {
  configDefinitions: ConfigDefinition[];
  configValues: Record<string, any>;
}

export const findConfigsByCategory = apiClient.createQueryFn(
  "find_configs_by_category",
  ({ post }) => async (params: { category?: string }) => {
    const result = await post<Configs>(
      API_PATH,
      { data: createApiRequest("sys/config", "find_by_category", params) }
    );
    return result.data;
  }
);

export const saveConfigs = apiClient.createMutationFn(
  "save_configs",
  ({ post }) => (params: ConfigsParams) => post(
    API_PATH,
    { data: createApiRequest("sys/config", "save", params) }
  )
);
