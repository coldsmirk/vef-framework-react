import { createEventEmitter } from "@vef-framework-react/shared";

interface NProgressEvent {
  complete: void;
  start: void;
}

export const nProgressEventEmitter = createEventEmitter<NProgressEvent>();
