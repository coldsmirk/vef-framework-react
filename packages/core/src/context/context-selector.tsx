import type { ComponentType, JSX, PropsWithChildren } from "react";

import { isFunction } from "@vef-framework-react/shared";
import { createContext, use, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Internal store for managing context state and subscriptions.
 */
interface Store<TValue> {
  value: TValue;
  subscribe: (listener: () => void) => () => void;
  notify: () => void;
}

/**
 * Props for the selector context provider component.
 */
export interface SelectorContextProviderProps<TValue> extends PropsWithChildren {
  value: TValue;
}

/**
 * Context hook interface with optional selector support.
 */
export interface UseSelectorContext<in out TValue> {
  /**
   * Returns the full context value.
   */
  <TStrictValue extends TValue = TValue>(): TStrictValue;
  /**
   * Returns the selected portion of the context value.
   */
  <TStrictValue extends TValue = TValue, TSelected = TStrictValue>(selector: (value: TStrictValue) => TSelected): NoInfer<TSelected>;
}

/**
 * Result of creating a selector context.
 */
export interface SelectorContextResult<TValue> {
  Provider: ComponentType<SelectorContextProviderProps<TValue>>;
  useContext: UseSelectorContext<TValue>;
}

/**
 * Creates a context with selector support for optimal re-rendering.
 * Consuming components can select specific parts of the context value.
 */
export function createContextWithSelector<TValue>(defaultValue: TValue): SelectorContextResult<TValue> {
  const Context = createContext<Store<TValue>>(createStore(defaultValue));
  Context.displayName = "Context";

  function Provider({ value, children }: SelectorContextProviderProps<TValue>): JSX.Element {
    const [store] = useState(() => createStore(value));

    useEffect(() => {
      if (Object.is(store.value, value)) {
        return;
      }

      store.value = value;
      store.notify();
    });

    return (
      <Context value={store}>
        {children}
      </Context>
    );
  }

  Provider.displayName = "SelectorContextProvider";

  function useContext<TStrictValue extends TValue = TValue>(): TStrictValue;

  function useContext<TStrictValue extends TValue = TValue, TSelected = TStrictValue>(selector: (value: TStrictValue) => TSelected): NoInfer<TSelected>;

  function useContext<TStrictValue extends TValue = TValue, TSelected = TStrictValue>(selector?: (value: TStrictValue) => TSelected): NoInfer<TSelected> | TStrictValue {
    const store = use(Context);
    const getSnapshot = () => isFunction(selector) ? selector(store.value as TStrictValue) : store.value as TStrictValue;

    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  }

  return { Provider, useContext };
}

/**
 * Creates a store for managing context state and subscriptions.
 */
function createStore<TValue>(value: TValue): Store<TValue> {
  const listeners = new Set<() => void>();

  return {
    value,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) {
        listener();
      }
    }
  };
}
