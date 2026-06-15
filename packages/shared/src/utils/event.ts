import type { EventHandlerMap, EventType, Handler } from "mitt";

import mitt from "mitt";

/**
 * Type-safe event emitter wrapper around mitt library.
 */
export class EventEmitter<TEvents extends Record<EventType, any> = Record<EventType, unknown>> {
  readonly #bus = mitt<TEvents>();

  /**
   * Subscribe to an event. Returns unsubscribe function.
   */
  on<const TEventType extends keyof TEvents>(
    eventType: TEventType,
    eventListener: Handler<TEvents[TEventType]>
  ): () => void {
    this.#bus.on(eventType, eventListener);

    return () => {
      this.#bus.off(eventType, eventListener);
    };
  }

  /**
   * Emit an event with optional payload.
   */
  emit<const TEventType extends keyof TEvents>(
    eventType: undefined extends TEvents[TEventType] ? TEventType : never
  ): void;
  emit<const TEventType extends keyof TEvents>(
    eventType: TEventType,
    eventPayload: TEvents[TEventType]
  ): void;
  emit<const TEventType extends keyof TEvents>(
    eventType: TEventType,
    eventPayload?: TEvents[TEventType]
  ): void {
    if (eventPayload === undefined) {
      this.#bus.emit(eventType as never);
    } else {
      this.#bus.emit(eventType, eventPayload);
    }
  }

  /**
   * Remove listener(s) for an event type.
   */
  off<const TEventType extends keyof TEvents>(
    eventType: TEventType,
    eventListener?: Handler<TEvents[TEventType]>
  ): void {
    this.#bus.off(eventType, eventListener);
  }

  /**
   * Remove all listeners from all events.
   */
  clear(): void {
    this.#bus.all.clear();
  }

  /**
   * Get all registered listeners (for debugging).
   */
  getAllListeners(): EventHandlerMap<TEvents> {
    return this.#bus.all;
  }
}

/**
 * Create a new EventEmitter instance.
 *
 * @example
 * ```typescript
 * interface AppEvents {
 *   'user:login': { userId: string };
 *   'user:logout': void;
 * }
 *
 * const emitter = createEventEmitter<AppEvents>();
 * const unsubscribe = emitter.on('user:login', ({ userId }) => {
 *   console.log(`User ${userId} logged in`);
 * });
 * ```
 */
export function createEventEmitter<TEvents extends Record<EventType, any> = Record<EventType, unknown>>(): EventEmitter<TEvents> {
  return new EventEmitter<TEvents>();
}

export { type Handler as EventHandler, type EventType } from "mitt";
