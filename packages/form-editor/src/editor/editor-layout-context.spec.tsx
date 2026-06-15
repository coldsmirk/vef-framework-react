import type { ReactElement } from "react";

import { act, render, screen } from "@testing-library/react";

import { resolveEditorLayoutMode, useEditorLayoutMeasure } from "./editor-layout-context";

/**
 * Scripted stand-in for the global no-op ResizeObserver mock: records the
 * callback and observed element so a test can drive resizes imperatively.
 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  observed: Element[] = [];

  readonly #callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  unobserve(): void {
    // scripted fake
  }

  disconnect(): void {
    // scripted fake
  }

  resize(width: number): void {
    this.#callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }
}

let commitCount = 0;

function Harness(): ReactElement {
  commitCount += 1;

  const { mode, ref } = useEditorLayoutMeasure();

  return <div ref={ref} data-testid="shell">{mode}</div>;
}

function lastObserver(): FakeResizeObserver {
  const observer = FakeResizeObserver.instances.at(-1);

  if (!observer) {
    throw new Error("No ResizeObserver was constructed");
  }

  return observer;
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  commitCount = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveEditorLayoutMode", () => {
  it("maps widths to the documented bands", () => {
    expect(resolveEditorLayoutMode(0)).toBe("comfortable");
    expect(resolveEditorLayoutMode(1280)).toBe("comfortable");
    expect(resolveEditorLayoutMode(1279)).toBe("compact");
    expect(resolveEditorLayoutMode(1100)).toBe("compact");
    expect(resolveEditorLayoutMode(1099)).toBe("drawer");
  });
});

describe("useEditorLayoutMeasure", () => {
  it("observes the attached element", () => {
    render(<Harness />);

    expect(lastObserver().observed).toContain(screen.getByTestId("shell"));
  });

  it("commits a new mode when the width crosses a threshold", () => {
    render(<Harness />);

    act(() => lastObserver().resize(1000));
    expect(screen.getByTestId("shell")).toHaveTextContent("drawer");

    act(() => lastObserver().resize(1150));
    expect(screen.getByTestId("shell")).toHaveTextContent("compact");

    act(() => lastObserver().resize(1400));
    expect(screen.getByTestId("shell")).toHaveTextContent("comfortable");
  });

  it("does not re-render for per-pixel resizes inside one band", () => {
    render(<Harness />);

    act(() => lastObserver().resize(1000));

    const after = commitCount;

    // A host splitter drag delivers one resize per pixel; only a band change
    // may commit state.
    act(() => lastObserver().resize(1001));
    act(() => lastObserver().resize(1010));
    act(() => lastObserver().resize(1098));

    expect(commitCount).toBe(after);
    expect(screen.getByTestId("shell")).toHaveTextContent("drawer");
  });
});
