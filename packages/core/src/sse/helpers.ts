import type { SseClientOptions } from "./types";

import { SseClient } from "./client";

/**
 * Create an SSE client instance (factory).
 *
 * @param options - SSE client options.
 * @returns SSE client instance.
 */
export function createSseClient(options: SseClientOptions): SseClient {
  return new SseClient(options);
}
