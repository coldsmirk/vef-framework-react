import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { ApiResult, MutationFunction } from "@vef-framework-react/core";

import type { Contract, ContractSearch } from "../../types";
import type { ContractFormValues } from "./model";

import { createCrudKit } from "@vef-framework-react/components";
import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "../../api";
import { formValuesToParams } from "./model";

/**
 * Create and update share the same form shape.
 */
export type ContractSceneValues = CrudBasicSceneFormValues<ContractFormValues, ContractFormValues>;

export const { OperationButtonGroup: ContractOperationButtonGroup, ActionButtonGroup: ContractActionButtonGroup }
  = createCrudKit<Contract, ContractSearch, ContractSceneValues>();

/**
 * Form mutations that convert the text-schema form values into contract API
 * params before dispatching create/update.
 */
export function useContractFormMutations(): {
  create: MutationFunction<ApiResult<unknown>, ContractFormValues>;
  update: MutationFunction<ApiResult<unknown>, ContractFormValues>;
} {
  const apiClient = useApiClient();

  return useMemo(
    () => {
      return {
        create: apiClient.createMutationFn<ApiResult<unknown>, ContractFormValues>(
          "integration_contract_form_create",
          ({ post }) => values => post(API_PATH, { data: createApiRequest("integration/contract", "create", formValuesToParams(values)) })
        ),
        update: apiClient.createMutationFn<ApiResult<unknown>, ContractFormValues>(
          "integration_contract_form_update",
          ({ post }) => values => post(API_PATH, { data: createApiRequest("integration/contract", "update", formValuesToParams(values)) })
        )
      };
    },
    [apiClient]
  );
}
