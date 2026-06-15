import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createMachine, updateContext, useActor } from ".";

interface CounterContext {
  count: number;
}

type CounterEvent = { type: "increment" } | { type: "decrement" } | { type: "noop" };

const counterMachine = createMachine({
  types: {
    context: {} as CounterContext,
    events: {} as CounterEvent
  },
  context: { count: 0 },
  initial: "idle",
  states: {
    idle: {
      on: {
        increment: {
          actions: updateContext({ count: ({ context }) => context.count + 1 })
        },
        decrement: {
          actions: updateContext({ count: ({ context }) => context.count - 1 })
        },
        noop: {}
      }
    }
  }
});

const selectCount = (snapshot: { context: CounterContext }) => snapshot.context.count;
const selectScaledCount = (snapshot: { context: CounterContext }) => snapshot.context.count * 10;

describe("state-machine/useActor", () => {
  it("returns the initial value selected from the actor's snapshot", () => {
    const { result } = renderHook(() => useActor(counterMachine, selectCount));

    const [count] = result.current;

    expect(count).toBe(0);
  });

  it("re-renders with the new selected value after a transition", () => {
    const { result } = renderHook(() => useActor(counterMachine, selectCount));

    act(() => {
      result.current[1]({ type: "increment" });
    });

    expect(result.current[0]).toBe(1);
  });

  it("applies successive transitions in order", () => {
    const { result } = renderHook(() => useActor(counterMachine, selectCount));

    act(() => {
      result.current[1]({ type: "increment" });
      result.current[1]({ type: "increment" });
      result.current[1]({ type: "decrement" });
    });

    expect(result.current[0]).toBe(1);
  });

  it("keeps the same selected reference when an event does not change it (Object.is equality)", () => {
    const { result } = renderHook(() => useActor(counterMachine, selectCount));

    const [before] = result.current;

    act(() => {
      result.current[1]({ type: "noop" });
    });

    expect(result.current[0]).toBe(before);
  });

  it("returns a stable actor reference across rerenders", () => {
    const { result, rerender } = renderHook(() => useActor(counterMachine, selectCount));

    const initialTuple = result.current;
    rerender();

    expect(result.current[2]).toBe(initialTuple[2]);
  });

  it("creates an independent actor per useActor call so state does not leak", () => {
    const { result: a } = renderHook(() => useActor(counterMachine, selectCount));
    const { result: b } = renderHook(() => useActor(counterMachine, selectCount));

    act(() => {
      a.current[1]({ type: "increment" });
    });

    expect(a.current[0]).toBe(1);
    expect(b.current[0]).toBe(0);
  });

  it("applies a custom selector mapping to derive a different shape from the snapshot", () => {
    const { result } = renderHook(() => useActor(counterMachine, selectScaledCount));

    expect(result.current[0]).toBe(0);

    act(() => {
      result.current[1]({ type: "increment" });
    });

    expect(result.current[0]).toBe(10);
  });
});
