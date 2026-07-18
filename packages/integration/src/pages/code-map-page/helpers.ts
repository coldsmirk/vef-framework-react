import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { ApiResult, MutationFunction } from "@vef-framework-react/core";

import type { CodeMap, CodeMapSearch } from "../../types";
import type { CodeMapFormValues } from "./model";

import { createCrudKit } from "@vef-framework-react/components";
import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "../../api";
import { codeMapFormToParams } from "./model";

/**
 * Create and update share the same form shape.
 */
export type CodeMapSceneValues = CrudBasicSceneFormValues<CodeMapFormValues, CodeMapFormValues>;

export const { OperationButtonGroup: CodeMapOperationButtonGroup, ActionButtonGroup: CodeMapActionButtonGroup }
  = createCrudKit<CodeMap, CodeMapSearch, CodeMapSceneValues>();

/**
 * Form mutations that collapse the form values (display-form fallbacks) into
 * typed API params.
 */
export function useCodeMapFormMutations(): {
  create: MutationFunction<ApiResult<unknown>, CodeMapFormValues>;
  update: MutationFunction<ApiResult<unknown>, CodeMapFormValues>;
} {
  const apiClient = useApiClient();

  return useMemo(
    () => {
      return {
        create: apiClient.createMutationFn<ApiResult<unknown>, CodeMapFormValues>(
          "integration_code_map_form_create",
          ({ post }) => values => post(API_PATH, { data: createApiRequest("integration/code_map", "create", codeMapFormToParams(values)) })
        ),
        update: apiClient.createMutationFn<ApiResult<unknown>, CodeMapFormValues>(
          "integration_code_map_form_update",
          ({ post }) => values => post(API_PATH, { data: createApiRequest("integration/code_map", "update", codeMapFormToParams(values)) })
        )
      };
    },
    [apiClient]
  );
}
