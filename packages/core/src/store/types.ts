import type { If, IsNever } from "@vef-framework-react/shared";
import type { Draft } from "immer";
import type { PropsWithChildren } from "react";
import type { Mutate, StateCreator, StoreApi, UseBoundStore as UseBoundStoreInternal } from "zustand";

export type SliceStateCreator<TState, TSlice, TPersist extends boolean = false> = StateCreator<
  TState,
  [
    ["zustand/subscribeWithSelector", never],
    If<TPersist, ["zustand/persist", unknown], never>,
    ["zustand/immer", never]
  ],
  [If<TPersist, never, ["zustand/immer", never]>],
  TSlice
>;

export type UnboundStore<TState> = Mutate<StoreApi<TState>, [["zustand/subscribeWithSelector", never], ["zustand/immer", never]]>;
export type UseBoundStore<TState> = UseBoundStoreInternal<Mutate<StoreApi<TState>, [["zustand/subscribeWithSelector", never], ["zustand/immer", never]]>>;
export type UseBoundStoreWithPersist<TState> = UseBoundStoreInternal<Mutate<StoreApi<TState>, [["zustand/subscribeWithSelector", never], ["zustand/persist", unknown], ["zustand/immer", never]]>>;

/**
 * State initializer for component-scoped stores.
 *
 * Mirrors the signature of `StateCreator<TState, [["zustand/subscribeWithSelector", never], ["zustand/immer", never]], []>`
 * without depending on zustand/immer middleware type augmentations, which may not be
 * visible to consumers under pnpm's strict dependency isolation.
 */
export type ComponentStoreInitializer<TState> = (
  set: {
    (partial: TState | Partial<TState> | ((state: Draft<TState>) => void), replace?: false): void;
    (state: TState | ((state: Draft<TState>) => void), replace: true): void;
  },
  get: () => TState,
  store: StoreApi<TState>
) => TState;

/**
 * The options for the persistence
 */
export interface PersistenceOptions<TState, TSelectedState = TState> {
  /**
   * The unique name of the store
   */
  name: string;
  /**
   * The storage type of the store
   */
  storage?: "local" | "session";
  /**
   * The selector of the store
   */
  selector?: (state: TState) => TSelectedState;
}

/**
 * The props of the store provider
 */
export type StoreProviderProps<TInitialState> = PropsWithChildren<
  {
    /**
     * Storage key for state persistence.
     * Only takes effect when the store is created with persistence options.
     * Different instances should use different keys.
     */
    storageKey?: string;
  } & If<IsNever<TInitialState>, {
    /**
     * The initial state of the store
     */
    initialState?: never;
  }, {
    /**
     * The initial state of the store
     */
    initialState: TInitialState;
  }>
>;
