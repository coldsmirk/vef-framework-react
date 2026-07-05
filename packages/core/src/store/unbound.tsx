import type { Except, MaybeNull } from "@vef-framework-react/shared";
import type { ComponentType, Context, ReactNode } from "react";
import type { StateCreator } from "zustand";

import type { ComponentStoreInitializer, PersistenceOptions, StoreProviderProps, UnboundStore } from "./types";

import { constantCase, identity, isPlainObject, mergeWith } from "@vef-framework-react/shared";
import { useIsomorphicLayoutEffect } from "motion/react";
import { createContext, use, useRef } from "react";
import { createStore, useStore as useZustandStore } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const STORAGE_KEY_PREFIX = "__VEF_COMPONENT_STORE__";

/**
 * Global context cache to handle React Fast Refresh
 */
const contextCache = new Map<string, Context<MaybeNull<UnboundStore<unknown>>>>();

/**
 * Hook signature for accessing store state with optional selector
 */
export interface UseStore<in out TState> {
  (): TState;
  <TSelected>(selector: (state: TState) => TSelected): NoInfer<TSelected>;
}

/**
 * Result type returned by createComponentStore
 */
export interface ComponentStoreResult<TState, TInitialState extends Partial<TState> = never> {
  StoreProvider: ComponentType<StoreProviderProps<TInitialState>>;
  useStoreApi: <TStrictState extends TState = TState>() => UnboundStore<TStrictState>;
  useStore: UseStore<TState>;
}

/**
 * Creates a component-scoped store with React Context
 *
 * @param name - The name of the store (used for context display name and error messages)
 * @param initializer - The Zustand state initializer function
 * @param persistOptions - Optional persistence configuration. When provided, the StoreProvider
 *   accepts a `storageKey` prop to enable state persistence via Zustand's persist middleware.
 * @returns Object containing StoreProvider, useStoreApi, and useStore
 */
export function createComponentStore<TState, TInitialState extends Partial<TState> = never>(
  name: string,
  initializer: ComponentStoreInitializer<TState>,
  persistOptions?: Except<PersistenceOptions<TState, Partial<TState>>, "name">
): ComponentStoreResult<TState, TInitialState> {
  const contextKey = `${name}StoreContext`;
  let CachedContext = contextCache.get(contextKey) as Context<MaybeNull<UnboundStore<TState>>> | undefined;

  if (!CachedContext) {
    CachedContext = createContext<MaybeNull<UnboundStore<TState>>>(null);
    CachedContext.displayName = contextKey;
    contextCache.set(contextKey, CachedContext as Context<MaybeNull<UnboundStore<unknown>>>);
  }

  const StoreContext = CachedContext;

  function StoreProvider({
    children,
    initialState,
    storageKey
  }: StoreProviderProps<TInitialState>): ReactNode {
    const storeRef = useRef<UnboundStore<TState>>(null);
    const initializedRef = useRef(false);
    const initialStateRef = useRef<unknown>(initialState);

    initialStateRef.current = initialState;

    if (!storeRef.current || !initializedRef.current) {
      const castedInitializer = initializer as StateCreator<TState, [["zustand/subscribeWithSelector", never], ["zustand/immer", never]], []>;

      if (storageKey && persistOptions) {
        const fullStorageKey = `${STORAGE_KEY_PREFIX}${constantCase(storageKey)}__`;
        const storageProvider = persistOptions.storage === "local" ? localStorage : sessionStorage;
        const immerInitializer = immer(
          castedInitializer as StateCreator<
            TState,
            [["zustand/subscribeWithSelector", never], ["zustand/persist", unknown], ["zustand/immer", never]],
            []
          >
        );
        const persistedInitializer = persist(immerInitializer, {
          name: fullStorageKey,
          version: 1,
          storage: createJSONStorage(() => storageProvider),
          partialize: (persistOptions.selector ?? identity) as (state: TState) => Partial<TState>
        });

        storeRef.current = createStore<TState>()(
          subscribeWithSelector(persistedInitializer)
        );
      } else {
        storeRef.current = createStore<TState>()(
          subscribeWithSelector(immer(castedInitializer))
        );
      }

      initializedRef.current = true;
    }

    useIsomorphicLayoutEffect(() => {
      if (!isPlainObject(initialStateRef.current) || !storeRef.current) {
        return;
      }

      storeRef.current.setState(state => {
        mergeWith(
          state as Record<string, unknown>,
          initialStateRef.current as Partial<Record<string, unknown>>,
          true
        );
      });
    }, []);

    return (
      <StoreContext value={storeRef.current}>
        {children}
      </StoreContext>
    );
  }

  function useStoreApi<TStrictState extends TState = TState>(): UnboundStore<TStrictState> {
    const store = use(StoreContext);

    if (!store) {
      const isDev = import.meta.env.DEV;
      const message = `${name}Store is not found in the React context. Ensure the component is wrapped in ${name}StoreProvider.`;
      const devHint = isDev
        ? "\n\nDev hint: If this error appears after hot reload, try refreshing the page."
        : "";

      throw new Error(message + devHint);
    }

    return store as UnboundStore<TStrictState>;
  }

  function useStore<TStrictState extends TState = TState, TSelected = TStrictState>(
    selector?: (state: TStrictState) => TSelected
  ): TSelected | TStrictState {
    const store = useStoreApi<TStrictState>();
    return useZustandStore(store, selector!);
  }

  return {
    StoreProvider,
    useStoreApi,
    useStore
  };
}
