import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { ApiResult, MutationFunction } from "@vef-framework-react/core";

import type { Schedule, ScheduleSearch } from "../../types";
import type { ScheduleFormValues } from "./model";

import { createCrudKit } from "@vef-framework-react/components";
import { createApiRequest, useApiClient, useQuery } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, useScheduleApi } from "../../api";
import { scheduleToParams } from "./model";

const RESOURCE = "sys/cron/schedule";

/**
 * Create and update share the schedule form shape.
 */
export type ScheduleSceneValues = CrudBasicSceneFormValues<ScheduleFormValues, ScheduleFormValues>;

export const { OperationButtonGroup: ScheduleOperationButtonGroup, ActionButtonGroup: ScheduleActionButtonGroup }
  = createCrudKit<Schedule, ScheduleSearch, ScheduleSceneValues>();

/**
 * Form mutations that collapse the schedule form into API params before
 * submitting create/update.
 */
export function useScheduleFormMutations(): {
  create: MutationFunction<ApiResult<unknown>, ScheduleFormValues>;
  update: MutationFunction<ApiResult<unknown>, ScheduleFormValues>;
} {
  const apiClient = useApiClient();

  return useMemo(
    () => {
      return {
        create: apiClient.createMutationFn<ApiResult<unknown>, ScheduleFormValues>(
          "cron_schedule_form_create",
          ({ post }) => values => post(API_PATH, { data: createApiRequest(RESOURCE, "create", scheduleToParams(values)) })
        ),
        update: apiClient.createMutationFn<ApiResult<unknown>, ScheduleFormValues>(
          "cron_schedule_form_update",
          ({ post }) => values => post(API_PATH, { data: createApiRequest(RESOURCE, "update", scheduleToParams(values)) })
        )
      };
    },
    [apiClient]
  );
}

/**
 * The job names registered on the answering node — the only legal `jobName`
 * values — as select options.
 */
export function useJobNames(): { options: Array<{ label: string; value: string }>; loading: boolean } {
  const api = useScheduleApi();
  const { data, isLoading } = useQuery({ queryFn: api.listJobs, queryKey: [api.listJobs.key] });

  return useMemo(
    () => {
      const names = data ?? [];

      return {
        options: names.map(name => { return { label: name, value: name }; }),
        loading: isLoading
      };
    },
    [data, isLoading]
  );
}
