import { EventEmitter } from "@vef-framework-react/shared";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type -- must stay a type alias (an interface lacks the implicit index signature the EventEmitter<Record<EventType, any>> constraint needs); the map is intentionally empty until CRUD events are introduced.
export type CrudEvents = {
};

export function createEventEmitter() {
  return new EventEmitter<CrudEvents>();
}
