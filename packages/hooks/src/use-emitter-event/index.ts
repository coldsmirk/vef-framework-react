import type { EventHandler, EventType } from "@vef-framework-react/shared";

import { EventEmitter } from "@vef-framework-react/shared";
import { useEffect } from "react";

/**
 * Subscribes to an EventEmitter event with automatic cleanup.
 *
 * @param emitter - EventEmitter instance to subscribe to.
 * @param eventType - Event type to listen for.
 * @param eventListener - Event handler function.
 * @example
 * ```tsx
 * function Component({ emitter }) {
 *   useEmitterEvent(emitter, 'data', (data) => {
 *     console.log('Received:', data);
 *   });
 * }
 * ```
 */
export function useEmitterEvent<TEvents extends Record<EventType, any>>(
  emitter: EventEmitter<TEvents>,
  eventType: keyof TEvents,
  eventListener: EventHandler<TEvents[keyof TEvents]>
): void {
  useEffect(() => emitter.on(eventType, eventListener), [emitter, eventType, eventListener]);
}
