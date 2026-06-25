import type {
  Actor,
  ActorOptions,
  AnyActorLogic,
  ConditionalRequired,
  IsNotNever,
  RequiredActorOptionsKeys,
  SnapshotFrom
} from "xstate";

import { useActorRef, useSelector } from "@xstate/react";

/**
 * Custom hook for creating and using an XState actor with state selection.
 * Combines actor creation with selector-based state subscription.
 *
 * @param logic - The actor logic (state machine or other actor logic)
 * @param selector - Function to select specific data from the actor's snapshot
 * @param options - Optional actor configuration options
 * @returns A tuple containing [selectedState, sendFunction, actorRef]
 */
export function useActor<TLogic extends AnyActorLogic, TSelected>(
  logic: TLogic,
  selector: (snapshot: SnapshotFrom<TLogic>) => TSelected,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & Record<RequiredActorOptionsKeys<TLogic>, unknown>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): [TSelected, Actor<TLogic>["send"], Actor<TLogic>] {
  const actorRef = useActorRef(logic, options);
  const selected = useSelector(actorRef, selector, Object.is);

  return [selected, actorRef.send, actorRef];
}

export { useActorRef } from "@xstate/react";

export {
  Actor,
  createActor,
  createMachine,
  assign as updateContext,
  type ActorLogic,
  type ActorOptions,
  type AnyActorLogic,
  type AnyMachineSnapshot,
  type AnyStateMachine,
  type MachineConfig,
  type MachineContext,
  type MachineSnapshot,
  type RequiredActorOptionsKeys,
  type SnapshotFrom,
  type StateMachine
} from "xstate";
