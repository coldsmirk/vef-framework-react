import type { StateCreator } from "zustand";

import type { PersistenceOptions, UseBoundStore, UseBoundStoreWithPersist } from "./types";

import { constantCase, identity } from "@vef-framework-react/shared";
import { create } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

/**
 * Create a store with the given initializer
 *
 * @param initializer - The initializer for the store
 * @returns The store
 */
export function createStore<TState extends { name: string }>(
  initializer: StateCreator<
    TState,
    [["zustand/subscribeWithSelector", never], ["zustand/immer", never]],
    []
  >
): UseBoundStore<TState> {
  return create<TState>()(subscribeWithSelector(immer(initializer)));
}

/**
 * Create a persisted store with the given initializer and persistence options
 *
 * @param initializer - The initializer for the store
 * @param persistenceOptions - The persistence options for the store
 * @returns The store
 */
export function createPersistedStore<TState>(
  initializer: StateCreator<
    TState,
    [["zustand/subscribeWithSelector", never], ["zustand/persist", unknown], ["zustand/immer", never]],
    []
  >,
  persistenceOptions: PersistenceOptions<TState, unknown>
): UseBoundStoreWithPersist<TState> {
  const {
    name,
    storage,
    selector
  } = persistenceOptions;
  const storageKey = `__VEF_STORE__${constantCase(name)}__`;
  const storageProvider = storage === "local" ? localStorage : sessionStorage;
  const persistedInitializer = persist(immer(initializer), {
    name: storageKey,
    version: 1,
    storage: createJSONStorage(() => storageProvider),
    partialize: selector ?? identity
  });

  return create<TState>()(
    subscribeWithSelector(persistedInitializer)
  );
}
