import type { HttpClientOptions } from "./types";

import { HttpClient } from "./client";
import { BusinessError } from "./errors";

/**
 * Create the http client.
 *
 * @param options - The options for the http client.
 * @returns The http client.
 */
export function createHttpClient(options: HttpClientOptions): Readonly<HttpClient> {
  return Object.freeze(new HttpClient(options));
}

/**
 * Type guard to check if an error is a BusinessError.
 *
 * @param error - The error to check.
 * @returns True if the error is a BusinessError.
 */
export function isBusinessError(error: unknown): error is BusinessError {
  return error instanceof BusinessError;
}
