import { createEventEmitter as createEventEmitterInternal } from "@vef-framework-react/shared";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ProTableEvents = {
  /**
   * Trigger table data refetch
   */
  refetch: void;
  /**
   * Emitted when table starts loading data
   */
  loading: void;
  /**
   * Emitted when table finishes loading data
   */
  loaded: void;
};

export function createEventEmitter() {
  return createEventEmitterInternal<ProTableEvents>();
}
