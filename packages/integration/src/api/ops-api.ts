import type { MutationFunction } from "@vef-framework-react/core";

import type {
  ConnectionCheck,
  DryRunInboundParams,
  DryRunParams,
  DryRunResult,
  InboundDryRunResult,
  RouteDiagnostics,
  TestConnectionParams
} from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { API_PATH } from "./query";

/**
 * The operational actions of the integration engine: the dry-run consoles,
 * the connection probe, and the routing diagnosis. Each is a mutation because
 * it is triggered imperatively and its calls have real effects.
 */
export interface OpsApi {
  dryRun: MutationFunction<DryRunResult, DryRunParams>;
  dryRunInbound: MutationFunction<InboundDryRunResult, DryRunInboundParams>;
  testConnection: MutationFunction<ConnectionCheck, TestConnectionParams>;
  diagnoseRoutes: MutationFunction<RouteDiagnostics, void>;
}

/**
 * Operational API for the integration engine.
 */
export function useOpsApi(): OpsApi {
  const apiClient = useApiClient();

  return useMemo<OpsApi>(
    () => {
      return {
        dryRun: apiClient.createMutationFn<DryRunResult, DryRunParams>(
          "integration_ops_dry_run",
          ({ post }) => async params => {
            const result = await post<DryRunResult>(API_PATH, {
              data: createApiRequest("integration/ops", "dry_run", params),
              bodyEncoding: "gzip+base64"
            });

            return result.data;
          }
        ),
        dryRunInbound: apiClient.createMutationFn<InboundDryRunResult, DryRunInboundParams>(
          "integration_ops_dry_run_inbound",
          ({ post }) => async params => {
            const result = await post<InboundDryRunResult>(API_PATH, {
              data: createApiRequest("integration/ops", "dry_run_inbound", params),
              bodyEncoding: "gzip+base64"
            });

            return result.data;
          }
        ),
        testConnection: apiClient.createMutationFn<ConnectionCheck, TestConnectionParams>(
          "integration_ops_test_connection",
          ({ post }) => async params => {
            const result = await post<ConnectionCheck>(API_PATH, {
              data: createApiRequest("integration/ops", "test_connection", params)
            });

            return result.data;
          }
        ),
        diagnoseRoutes: apiClient.createMutationFn<RouteDiagnostics, void>(
          "integration_ops_diagnose_routes",
          ({ post }) => async () => {
            const result = await post<RouteDiagnostics>(API_PATH, { data: createApiRequest("integration/ops", "diagnose_routes") });

            return result.data;
          }
        )
      };
    },
    [apiClient]
  );
}
