import { useEmitterEvent } from "@vef-framework-react/hooks";
import { createEventEmitter } from "@vef-framework-react/shared";

import {
  RELOAD_PAGE_EVENT
} from "../constants";

const eventBus = createEventEmitter<{
  [RELOAD_PAGE_EVENT]: string;
}>();

export function emitReloadPage(key: string): void {
  eventBus.emit(RELOAD_PAGE_EVENT, key);
}

export function onReloadPage(listener: (key: string) => void): () => void {
  return eventBus.on(RELOAD_PAGE_EVENT, listener);
}

export function useReloadPageEvent(listener: (key: string) => void): void {
  useEmitterEvent(eventBus, RELOAD_PAGE_EVENT, listener);
}
