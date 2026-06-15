import { EventEmitter } from "@vef-framework-react/shared";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type
export type CrudEvents = {
};

export function createEventEmitter() {
  return new EventEmitter<CrudEvents>();
}
