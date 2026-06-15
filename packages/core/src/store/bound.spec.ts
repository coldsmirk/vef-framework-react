import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPersistedStore, createStore } from "./bound";

interface Counter {
  name: string;
  count: number;
  increment: () => void;
  setCount: (next: number) => void;
}

describe("store/createStore (bound)", () => {
  it("initializes with the value returned by the initializer", () => {
    const useStore = createStore<Counter>(set => {
      return {
        name: "counter",
        count: 0,
        increment: () => set(state => {
          state.count += 1;
        }),
        setCount: next => set(state => {
          state.count = next;
        })
      };
    });

    expect(useStore.getState().count).toBe(0);
  });

  it("applies updates produced by an immer recipe", () => {
    const useStore = createStore<Counter>(set => {
      return {
        name: "counter",
        count: 0,
        increment: () => set(state => {
          state.count += 1;
        }),
        setCount: next => set(state => {
          state.count = next;
        })
      };
    });

    useStore.getState().increment();
    useStore.getState().increment();

    expect(useStore.getState().count).toBe(2);
  });

  it("supports selective subscriptions via subscribeWithSelector", () => {
    const useStore = createStore<Counter>(set => {
      return {
        name: "counter",
        count: 0,
        increment: () => set(state => {
          state.count += 1;
        }),
        setCount: next => set(state => {
          state.count = next;
        })
      };
    });
    const listener = vi.fn();
    const unsubscribe = useStore.subscribe(state => state.count, listener);

    useStore.getState().increment();
    expect(listener).toHaveBeenCalledWith(1, 0);

    unsubscribe();
    useStore.getState().increment();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("store/createPersistedStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("persists state to localStorage under the constant-cased name", () => {
    const useStore = createPersistedStore<Counter>(set => {
      return {
        name: "counter",
        count: 0,
        increment: () => set(state => {
          state.count += 1;
        }),
        setCount: next => set(state => {
          state.count = next;
        })
      };
    }, { name: "demoCounter", storage: "local" });

    useStore.getState().setCount(5);

    expect(localStorage.getItem("__VEF_STORE__DEMO_COUNTER__")).toContain("\"count\":5");
  });

  it("partializes the persisted slice when a selector is provided", () => {
    const useStore = createPersistedStore<Counter>(set => {
      return {
        name: "counter",
        count: 0,
        increment: () => set(state => {
          state.count += 1;
        }),
        setCount: next => set(state => {
          state.count = next;
        })
      };
    }, {
      name: "demoSlice",
      storage: "session",
      selector: state => { return { count: state.count }; }
    });

    useStore.getState().setCount(7);
    const raw = sessionStorage.getItem("__VEF_STORE__DEMO_SLICE__");
    const parsed = JSON.parse(raw!) as { state: { count: number; increment?: unknown } };

    expect(parsed.state.count).toBe(7);
    expect(parsed.state.increment).toBeUndefined();
  });

  it("rehydrates persisted state when a new store is created with the same name", () => {
    sessionStorage.setItem(
      "__VEF_STORE__DEMO_REHYDRATE__",
      JSON.stringify({ state: { count: 42 }, version: 1 })
    );

    const useStore = createPersistedStore<Counter>(set => {
      return {
        name: "counter",
        count: 0,
        increment: () => set(state => {
          state.count += 1;
        }),
        setCount: next => set(state => {
          state.count = next;
        })
      };
    }, { name: "demoRehydrate", storage: "session" });

    expect(useStore.getState().count).toBe(42);
  });
});
