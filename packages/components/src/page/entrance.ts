import { useLatest } from "@vef-framework-react/hooks";
import { createContext, use, useEffect, useSyncExternalStore } from "react";

/**
 * Orchestration signal for the Page entrance animation: "the page has
 * finished arriving". Secondary motion, auto-focus, guided hints, or
 * deferred heavy initialization key off it so they start after the entrance
 * instead of competing with it.
 *
 * The context carries a STABLE store reference — never a changing value — so
 * the entrance settling re-renders nothing by itself. Each consumer chooses
 * its own cost:
 * - {@link usePageEntranceEffect} runs a callback on settle (zero re-renders),
 * - {@link usePageEntranceSettled} subscribes a component to the boolean
 * (that component alone re-renders on the flip),
 * - CSS can target the Page root's `data-entrance` attribute directly.
 */
export interface PageEntranceStore {
  isSettled: () => boolean;
  /**
   * Notifies on every transition of the settled state (entering → settled
   * and, on a page reload replaying the entrance, settled → entering).
   */
  subscribe: (listener: () => void) => () => void;
}

/**
 * Mutable handle the Page component drives from its animation callbacks.
 * Internal — only the read surface ({@link PageEntranceStore}) leaves the
 * package.
 */
export interface PageEntranceController {
  store: PageEntranceStore;
  setSettled: (settled: boolean) => void;
}

export function createPageEntranceController(): PageEntranceController {
  let settled = false;
  const listeners = new Set<() => void>();

  return {
    store: {
      isSettled: () => settled,
      subscribe: listener => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      }
    },
    setSettled: next => {
      if (settled === next) {
        return;
      }

      settled = next;

      for (const listener of listeners) {
        listener();
      }
    }
  };
}

function noopUnsubscribe(): void {
  // A permanently settled store never notifies, so there is nothing to undo.
}

/**
 * Default store for content rendered outside a Page (modals, plain layouts,
 * tests): there is no entrance to wait for, so it is permanently settled.
 */
const SETTLED_STORE: PageEntranceStore = {
  isSettled: () => true,
  subscribe: () => noopUnsubscribe
};

export const PageEntranceContext = createContext<PageEntranceStore>(SETTLED_STORE);

/**
 * Whether the hosting Page's entrance animation has finished (immediately
 * `true` outside a Page). Subscribes the calling component: it re-renders
 * once when the entrance settles — use this form when the settled state
 * drives rendering. For "do something once the page has arrived", prefer
 * {@link usePageEntranceEffect}, which re-renders nothing.
 */
export function usePageEntranceSettled(): boolean {
  const store = use(PageEntranceContext);

  return useSyncExternalStore(store.subscribe, store.isSettled, store.isSettled);
}

/**
 * Runs `effect` once the hosting Page's entrance animation has settled —
 * immediately when already settled (including outside a Page). The returned
 * cleanup runs on unmount, and the effect re-arms if a page reload replays
 * the entrance. Reads the latest `effect` at fire time, so an inline closure
 * is fine.
 *
 * ```tsx
 * usePageEntranceEffect(() => {
 * chart.startEntranceSequence();
 * });
 * ```
 */
export function usePageEntranceEffect(effect: () => void | (() => void)): void {
  const store = use(PageEntranceContext);
  const effectRef = useLatest(effect);

  useEffect(() => {
    let cleanup: void | (() => void);
    let fired = false;

    const fire = (): void => {
      fired = true;
      cleanup = effectRef.current();
    };

    if (store.isSettled()) {
      fire();
    }

    const unsubscribe = store.subscribe(() => {
      if (store.isSettled()) {
        if (!fired) {
          fire();
        }

        return;
      }

      // The entrance is replaying (page reload): tear down and re-arm.
      cleanup?.();
      cleanup = undefined;
      fired = false;
    });

    return () => {
      unsubscribe();
      cleanup?.();
    };
  }, [store, effectRef]);
}
