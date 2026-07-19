import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { ApiResult, MutationFunction, PaginationResult, QueryFunction } from "@vef-framework-react/core";

import type {
  PreviewFiresParams,
  PreviewFiresResult,
  Schedule,
  ScheduleDetail,
  ScheduleNameParams,
  ScheduleParams,
  ScheduleSearch
} from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH, splitQueryParams } from "./query";

const RESOURCE = "sys/cron/schedule";

/**
 * The query and mutation functions for the durable schedule store. Addressing
 * is by `name` (there is no id-keyed delete and no batch delete), and every
 * mutation shares the single `cron.schedule.manage` permission on the backend.
 */
export interface ScheduleApi {
  findPage: QueryFunction<PaginationResult<Schedule>, PaginatedQueryParams<ScheduleSearch>>;
  get: QueryFunction<ScheduleDetail, ScheduleNameParams>;
  listJobs: QueryFunction<string[]>;
  previewFires: QueryFunction<PreviewFiresResult, PreviewFiresParams>;
  create: MutationFunction<ApiResult<unknown>, ScheduleParams>;
  update: MutationFunction<ApiResult<unknown>, ScheduleParams>;
  remove: MutationFunction<ApiResult<unknown>, ScheduleNameParams>;
  pause: MutationFunction<ApiResult<unknown>, ScheduleNameParams>;
  resume: MutationFunction<ApiResult<unknown>, ScheduleNameParams>;
  triggerNow: MutationFunction<ApiResult<unknown>, ScheduleNameParams>;
}

/**
 * Schedule management API for the durable cron store.
 */
export function useScheduleApi(): ScheduleApi {
  const apiClient = useApiClient();

  return useMemo<ScheduleApi>(
    () => {
      return {
        findPage: apiClient.createQueryFn<PaginationResult<Schedule>, PaginatedQueryParams<ScheduleSearch>>(
          "cron_schedule_find_page",
          ({ post }) => async queryParams => {
            const { params, pagination } = splitQueryParams(queryParams);
            // The framework select carries `isEnabled` as a string; the wire eq
            // filter wants a real boolean, so convert it here (dropped when unset).
            const { isEnabled, ...rest } = params;
            const search = isEnabled === "true"
              ? { ...rest, isEnabled: true }
              : isEnabled === "false"
                ? { ...rest, isEnabled: false }
                : rest;
            const result = await post<PaginationResult<Schedule>>(API_PATH, {
              data: createApiRequest(RESOURCE, "find_page", search, pagination)
            });

            return result.data;
          }
        ),
        get: apiClient.createQueryFn<ScheduleDetail, ScheduleNameParams>(
          "cron_schedule_get",
          ({ post }) => async params => {
            const result = await post<ScheduleDetail>(API_PATH, { data: createApiRequest(RESOURCE, "get", params) });

            return result.data;
          }
        ),
        listJobs: apiClient.createQueryFn<string[]>(
          "cron_schedule_list_jobs",
          ({ post }) => async () => {
            const result = await post<string[]>(API_PATH, { data: createApiRequest(RESOURCE, "list_jobs") });

            return result.data;
          }
        ),
        previewFires: apiClient.createQueryFn<PreviewFiresResult, PreviewFiresParams>(
          "cron_schedule_preview_fires",
          ({ post }) => async params => {
            const result = await post<PreviewFiresResult>(API_PATH, { data: createApiRequest(RESOURCE, "preview_fires", params) });

            return result.data;
          }
        ),
        create: apiClient.createMutationFn<ApiResult<unknown>, ScheduleParams>(
          "cron_schedule_create",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "create", params) })
        ),
        update: apiClient.createMutationFn<ApiResult<unknown>, ScheduleParams>(
          "cron_schedule_update",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "update", params) })
        ),
        remove: apiClient.createMutationFn<ApiResult<unknown>, ScheduleNameParams>(
          "cron_schedule_delete",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "delete", { name: params.name }) })
        ),
        pause: apiClient.createMutationFn<ApiResult<unknown>, ScheduleNameParams>(
          "cron_schedule_pause",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "pause", { name: params.name }) })
        ),
        resume: apiClient.createMutationFn<ApiResult<unknown>, ScheduleNameParams>(
          "cron_schedule_resume",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "resume", { name: params.name }) })
        ),
        triggerNow: apiClient.createMutationFn<ApiResult<unknown>, ScheduleNameParams>(
          "cron_schedule_trigger_now",
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, "trigger_now", { name: params.name }) })
        )
      };
    },
    [apiClient]
  );
}
