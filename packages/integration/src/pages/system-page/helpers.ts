import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { ApiResult, MutationFunction } from "@vef-framework-react/core";

import type { System, SystemSearch } from "../../types";
import type { SystemFormValues } from "./model";

import { createCrudKit } from "@vef-framework-react/components";
import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "../../api";
import { systemFormToParams } from "./model";

/**
 * Create and update share the same form shape.
 */
export type SystemSceneValues = CrudBasicSceneFormValues<SystemFormValues, SystemFormValues>;

export const { OperationButtonGroup: SystemOperationButtonGroup, ActionButtonGroup: SystemActionButtonGroup }
  = createCrudKit<System, SystemSearch, SystemSceneValues>();

/**
 * Form mutations that collapse the form's toggled sections into API params.
 */
export function useSystemFormMutations(): {
  create: MutationFunction<ApiResult<unknown>, SystemFormValues>;
  update: MutationFunction<ApiResult<unknown>, SystemFormValues>;
} {
  const apiClient = useApiClient();

  return useMemo(
    () => {
      return {
        create: apiClient.createMutationFn<ApiResult<unknown>, SystemFormValues>(
          "integration_system_form_create",
          ({ post }) => values => post(API_PATH, { data: createApiRequest("integration/system", "create", systemFormToParams(values)) })
        ),
        update: apiClient.createMutationFn<ApiResult<unknown>, SystemFormValues>(
          "integration_system_form_update",
          ({ post }) => values => post(API_PATH, { data: createApiRequest("integration/system", "update", systemFormToParams(values)) })
        )
      };
    },
    [apiClient]
  );
}
