import type { ApiClientOptions, ApiRequest } from "./types";

import { ApiClient } from "./client";

const DEFAULT_VERSION = "v1";

/**
 * Creates a new API client.
 *
 * @param options - The options for the API client.
 * @returns The API client.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}

/**
 * Build an `ApiRequest` envelope. The three-arg form defaults `version` to
 * `"v1"`; the four-arg form lets callers pin a non-default version.
 *
 * @example Default version
 * ```ts
 * createApiRequest("sys/storage", "abort_upload", { claimId });
 * ```
 * @example Explicit version
 * ```ts
 * createApiRequest("sys/storage", "init_upload", "v2", { filename, size });
 * ```
 */
export function createApiRequest<P extends object, M extends object>(
  resource: string,
  action: string,
  params?: P,
  meta?: M
): ApiRequest<P, M>;

export function createApiRequest<P extends object, M extends object>(
  resource: string,
  action: string,
  version: string,
  params?: P,
  meta?: M
): ApiRequest<P, M>;

export function createApiRequest<P extends object, M extends object>(
  resource: string,
  action: string,
  versionOrParams?: string | P,
  paramsOrMeta?: P | M,
  meta?: M
): ApiRequest<P, M> {
  if (typeof versionOrParams === "string") {
    return {
      resource,
      action,
      version: versionOrParams,
      params: paramsOrMeta as P,
      meta
    };
  }

  return {
    resource,
    action,
    version: DEFAULT_VERSION,
    params: versionOrParams,
    meta: paramsOrMeta as M
  };
}
