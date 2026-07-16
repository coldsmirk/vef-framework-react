import type { MutationFunction } from "@vef-framework-react/core";

import type {
  AddAssigneeParams,
  AddCCParams,
  MarkCCReadParams,
  ProcessTaskParams,
  RemoveAssigneeParams,
  ResubmitInstanceParams,
  StartInstanceParams,
  UrgeTaskParams,
  WithdrawInstanceParams
} from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "./query";

const RESOURCE = "approval/instance";

/**
 * The runtime actions of the approval engine: submission, the per-task
 * decision, and the participant side actions. Each is a mutation triggered
 * imperatively from the detail views.
 */
export interface InstanceApi {
  start: MutationFunction<unknown, StartInstanceParams>;
  processTask: MutationFunction<unknown, ProcessTaskParams>;
  withdraw: MutationFunction<unknown, WithdrawInstanceParams>;
  resubmit: MutationFunction<unknown, ResubmitInstanceParams>;
  addCC: MutationFunction<unknown, AddCCParams>;
  markCCRead: MutationFunction<unknown, MarkCCReadParams>;
  addAssignee: MutationFunction<unknown, AddAssigneeParams>;
  removeAssignee: MutationFunction<unknown, RemoveAssigneeParams>;
  urgeTask: MutationFunction<unknown, UrgeTaskParams>;
}

/**
 * Runtime action API for approval instances and tasks.
 */
export function useInstanceApi(): InstanceApi {
  const apiClient = useApiClient();

  return useMemo<InstanceApi>(
    () => {
      function action<TParams extends object>(name: string): MutationFunction<unknown, TParams> {
        return apiClient.createMutationFn<unknown, TParams>(
          `approval_instance_${name}`,
          ({ post }) => params => post(API_PATH, { data: createApiRequest(RESOURCE, name, params) })
        );
      }

      return {
        start: action<StartInstanceParams>("start"),
        processTask: action<ProcessTaskParams>("process_task"),
        withdraw: action<WithdrawInstanceParams>("withdraw"),
        resubmit: action<ResubmitInstanceParams>("resubmit"),
        addCC: action<AddCCParams>("add_cc"),
        markCCRead: action<MarkCCReadParams>("mark_cc_read"),
        addAssignee: action<AddAssigneeParams>("add_assignee"),
        removeAssignee: action<RemoveAssigneeParams>("remove_assignee"),
        urgeTask: action<UrgeTaskParams>("urge_task")
      };
    },
    [apiClient]
  );
}
