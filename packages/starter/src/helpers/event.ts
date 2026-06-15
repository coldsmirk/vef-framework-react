import { createEventEmitter } from "@vef-framework-react/shared";

import { ACCESS_DENIED_EVENT, UNAUTHENTICATED_EVENT } from "../constants";

const eventBus = createEventEmitter<{
  [ACCESS_DENIED_EVENT]: void;
  [UNAUTHENTICATED_EVENT]: void;
}>();

export function dispatchCustomEvent<T = unknown>(type: string, options?: CustomEventInit<T>): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const event = new CustomEvent(type, options);
  return document.dispatchEvent(event);
}

export function emitAccessDenied(): void {
  eventBus.emit(ACCESS_DENIED_EVENT);
}

export function onAccessDenied(listener: () => void): () => void {
  return eventBus.on(ACCESS_DENIED_EVENT, listener);
}

export function emitUnauthenticated(): void {
  eventBus.emit(UNAUTHENTICATED_EVENT);
}

export function onUnauthenticated(listener: () => void): () => void {
  return eventBus.on(UNAUTHENTICATED_EVENT, listener);
}
