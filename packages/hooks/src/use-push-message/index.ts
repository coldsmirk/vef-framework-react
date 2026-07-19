import type { PushClient, PushMessageHandler } from "@vef-framework-react/core";

import { useEffect } from "react";

/**
 * Subscribes to server push messages of one envelope type with automatic
 * cleanup. Pass `"*"` to receive every message.
 *
 * @param client - Push client instance (typically an app-level singleton).
 * @param type - Envelope type to listen for.
 * @param handler - Message handler.
 * @example
 * ```tsx
 * function OrderBadge({ pushClient }) {
 *   usePushMessage(pushClient, "order.status_changed", (message) => {
 *     console.log("Order updated:", message.payload);
 *   });
 * }
 * ```
 */
export function usePushMessage<TPayload = unknown>(
  client: PushClient,
  type: string,
  handler: PushMessageHandler<TPayload>
): void {
  useEffect(() => client.subscribe(type, handler), [client, type, handler]);
}
