import type { RuntimeStateMap } from "./types";

import { stabilizeStateMap } from "./stabilize-state-map";

function state(over: Partial<RuntimeStateMap[string]> = {}): RuntimeStateMap[string] {
  return {
    hidden: false,
    disabled: false,
    required: false,
    assigned: false,
    ...over
  };
}

describe("stabilizeStateMap", () => {
  it("returns next verbatim when there is no prior map", () => {
    const next = { a: state() };

    expect(stabilizeStateMap(undefined, next)).toBe(next);
  });

  it("preserves the object reference for a deeply-equal entry", () => {
    const prev = { a: state(), b: state() };
    const next = { a: state(), b: state() };

    const out = stabilizeStateMap(prev, next);

    expect(out.a).toBe(prev.a);
    expect(out.b).toBe(prev.b);
  });

  it("returns a fresh reference only for the changed entry", () => {
    const prev = { a: state(), b: state() };
    const next = { a: state({ hidden: true }), b: state() };

    const out = stabilizeStateMap(prev, next);

    expect(out.a).toBe(next.a);
    expect(out.a).not.toBe(prev.a);
    expect(out.b).toBe(prev.b);
  });

  it("returns the prior whole-map reference when nothing changed", () => {
    const prev = { a: state(), b: state() };
    const next = { a: state(), b: state() };

    expect(stabilizeStateMap(prev, next)).toBe(prev);
  });

  it("returns a new map when a key is added", () => {
    const prev = { a: state() };
    const next = { a: state(), b: state() };

    const out = stabilizeStateMap(prev, next);

    expect(out).not.toBe(prev);
    expect(out.a).toBe(prev.a);
    expect(out.b).toBe(next.b);
  });

  it("returns a new map dropping a removed key", () => {
    const prev = { a: state(), b: state() };
    const next = { a: state() };

    const out = stabilizeStateMap(prev, next);

    expect(out).not.toBe(prev);
    expect(out.a).toBe(prev.a);
    expect("b" in out).toBe(false);
  });
});
