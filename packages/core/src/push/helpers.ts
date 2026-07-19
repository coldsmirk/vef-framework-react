import type { PushClientOptions } from "./types";

import { PushClient } from "./client";

/**
 * Create a push client instance (factory).
 *
 * @param options - Push client options.
 * @returns Push client instance.
 */
export function createPushClient(options: PushClientOptions = {}): PushClient {
  return new PushClient(options);
}
