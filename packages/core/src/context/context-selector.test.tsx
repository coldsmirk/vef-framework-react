import type { JSX, PropsWithChildren } from "react";

import { render, renderHook, screen } from "@testing-library/react";
import { memo } from "react";
import { describe, expect, it, vi } from "vitest";

import { createContextWithSelector } from "./context-selector";

interface Theme {
  primary: string;
  secondary: string;
}

describe("context/createContextWithSelector", () => {
  it("returns the full context value when no selector is provided", () => {
    const { Provider, useContext: useTheme } = createContextWithSelector<Theme>({
      primary: "blue",
      secondary: "white"
    });

    function wrapper({ children }: PropsWithChildren): JSX.Element {
      return <Provider value={{ primary: "red", secondary: "yellow" }}>{children}</Provider>;
    }

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current).toEqual({ primary: "red", secondary: "yellow" });
  });

  it("returns the default value when consumed outside any provider", () => {
    const { useContext: useTheme } = createContextWithSelector<Theme>({
      primary: "default",
      secondary: "default"
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current).toEqual({ primary: "default", secondary: "default" });
  });

  it("returns the selected portion when a selector is provided", () => {
    const { Provider, useContext: useTheme } = createContextWithSelector<Theme>({
      primary: "blue",
      secondary: "white"
    });

    function wrapper({ children }: PropsWithChildren): JSX.Element {
      return <Provider value={{ primary: "navy", secondary: "ivory" }}>{children}</Provider>;
    }

    const { result } = renderHook(() => useTheme(theme => theme.primary), { wrapper });

    expect(result.current).toBe("navy");
  });

  it("re-renders subscribers only when their selected slice changes", () => {
    const { Provider, useContext: useTheme } = createContextWithSelector<Theme>({
      primary: "blue",
      secondary: "white"
    });
    const primaryRenders = vi.fn();
    const secondaryRenders = vi.fn();

    const PrimaryWatcher = memo((): JSX.Element => {
      const primary = useTheme(theme => theme.primary);
      primaryRenders(primary);
      return <span data-testid="primary">{primary}</span>;
    });
    PrimaryWatcher.displayName = "PrimaryWatcher";

    const SecondaryWatcher = memo((): JSX.Element => {
      const secondary = useTheme(theme => theme.secondary);
      secondaryRenders(secondary);
      return <span data-testid="secondary">{secondary}</span>;
    });
    SecondaryWatcher.displayName = "SecondaryWatcher";

    function App({ value }: { value: Theme }): JSX.Element {
      return (
        <Provider value={value}>
          <PrimaryWatcher />
          <SecondaryWatcher />
        </Provider>
      );
    }

    const initial: Theme = { primary: "blue", secondary: "white" };
    const { rerender } = render(<App value={initial} />);
    const secondaryRendersBefore = secondaryRenders.mock.calls.length;
    const primaryRendersBefore = primaryRenders.mock.calls.length;

    rerender(<App value={{ primary: "navy", secondary: "white" }} />);

    expect(screen.getByTestId("primary")).toHaveTextContent("navy");
    expect(primaryRenders.mock.calls.length - primaryRendersBefore).toBe(1);
    expect(secondaryRenders.mock.calls.length).toBe(secondaryRendersBefore);
  });
});
