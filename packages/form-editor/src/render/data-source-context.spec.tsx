import type { ReactElement, ReactNode } from "react";

import type { DataSourceResolver, FieldOptionSource, FormDataSource } from "../types";

import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { noopDataSourceResolver } from "../types";
import { DataSourceProvider, useFieldOptions } from "./data-source-context";

// Function.prototype is a no-op function — useful for silencing console without
// running into `@typescript-eslint/no-empty-function`.
const silence = Function.prototype as () => void;

function wrap(dataSources: FormDataSource[], resolver: DataSourceResolver) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <DataSourceProvider dataSources={dataSources} resolver={resolver}>{children}</DataSourceProvider>;
  };
}

function optionsFor(source: FieldOptionSource, dataSources: FormDataSource[], resolver: DataSourceResolver) {
  return renderHook(() => useFieldOptions(source), { wrapper: wrap(dataSources, resolver) });
}

function Probe({ source }: { source: FieldOptionSource }): ReactElement {
  const { options } = useFieldOptions(source);

  return <span>{options.map(option => String(option.value)).join(",")}</span>;
}

describe("useFieldOptions", () => {
  it("returns a static source's options synchronously", () => {
    const { result } = optionsFor({ kind: "static", options: [{ label: "A", value: "a" }] }, [], noopDataSourceResolver);

    expect(result.current.options).toEqual([{ label: "A", value: "a" }]);
    expect(result.current.loading).toBe(false);
  });

  it("dereferences a ref to a form-global static source", () => {
    const dataSources: FormDataSource[] = [
      {
        id: "ds1",
        name: "城市",
        kind: "static",
        options: [{ label: "北京", value: "bj" }]
      }
    ];

    const { result } = optionsFor({ kind: "ref", dataSourceId: "ds1" }, dataSources, noopDataSourceResolver);

    expect(result.current.options).toEqual([{ label: "北京", value: "bj" }]);
  });

  it("resolves a remote source through the injected resolver", async () => {
    const resolver: DataSourceResolver = { resolve: vi.fn().mockResolvedValue([{ label: "C", value: "c" }]) };

    const { result } = optionsFor({ kind: "remote", request: { resource: "geo", action: "cities" } }, [], resolver);

    await waitFor(() => expect(result.current.options).toEqual([{ label: "C", value: "c" }]));
    expect(resolver.resolve).toHaveBeenCalledWith({ resource: "geo", action: "cities" }, undefined);
  });

  it("resolves a ref to a form-global remote source", async () => {
    const resolver: DataSourceResolver = { resolve: vi.fn().mockResolvedValue([{ label: "D", value: "d" }]) };
    const dataSources: FormDataSource[] = [
      {
        id: "ds2",
        name: "部门",
        kind: "remote",
        request: { resource: "org", action: "depts" }
      }
    ];

    const { result } = optionsFor({ kind: "ref", dataSourceId: "ds2" }, dataSources, resolver);

    await waitFor(() => expect(result.current.options).toEqual([{ label: "D", value: "d" }]));
  });

  it("returns no options for an unknown ref", () => {
    const { result } = optionsFor({ kind: "ref", dataSourceId: "missing" }, [], noopDataSourceResolver);

    expect(result.current.options).toEqual([]);
  });

  describe("provider-scoped cache", () => {
    it("reuses a resolved remote response across a consumer remount", async () => {
      const resolver: DataSourceResolver = { resolve: vi.fn().mockResolvedValue([{ label: "C", value: "c" }]) };
      const dataSources: FormDataSource[] = [
        {
          id: "ds",
          name: "x",
          kind: "remote",
          request: { resource: "r", action: "a" }
        }
      ];
      const source: FieldOptionSource = { kind: "ref", dataSourceId: "ds" };

      // The provider instance persists across rerenders; only the consumer
      // unmounts and remounts — the editor's edit ⇄ preview Activity
      // round-trip in miniature.
      const view = render(
        <DataSourceProvider dataSources={dataSources} resolver={resolver}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await screen.findByText("c");

      view.rerender(
        <DataSourceProvider dataSources={dataSources} resolver={resolver}>
          <span>empty</span>
        </DataSourceProvider>
      );
      view.rerender(
        <DataSourceProvider dataSources={dataSources} resolver={resolver}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await screen.findByText("c");
      expect(resolver.resolve).toHaveBeenCalledTimes(1);
    });
  });

  describe("refresh versions", () => {
    it("re-fetches a ref-to-remote source when its version nonce bumps", async () => {
      const resolver: DataSourceResolver = { resolve: vi.fn().mockResolvedValue([{ label: "A", value: "a" }]) };
      const dataSources: FormDataSource[] = [
        {
          id: "ds",
          name: "x",
          kind: "remote",
          request: { resource: "r", action: "a" }
        }
      ];
      const source: FieldOptionSource = { kind: "ref", dataSourceId: "ds" };

      const { rerender } = render(
        <DataSourceProvider dataSources={dataSources} resolver={resolver} versions={{}}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(1));

      // Bumping the source's nonce re-runs the fetch against the same request.
      rerender(
        <DataSourceProvider dataSources={dataSources} resolver={resolver} versions={{ ds: 1 }}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(2));
    });

    it("keeps the previous options while a refresh is in flight", async () => {
      // First resolve returns immediately; the refresh hangs until released, so
      // the in-flight window is observable.
      const versionsRef = { current: {} as Record<string, number> };
      const refreshGate = Promise.withResolvers<Array<{ label: string; value: string }>>();
      const resolve = vi.fn()
        .mockResolvedValueOnce([{ label: "A", value: "a" }])
        .mockReturnValueOnce(refreshGate.promise);
      const resolver: DataSourceResolver = { resolve };
      const dataSources: FormDataSource[] = [
        {
          id: "ds",
          name: "x",
          kind: "remote",
          request: { resource: "r", action: "a" }
        }
      ];
      const source: FieldOptionSource = { kind: "ref", dataSourceId: "ds" };

      const { rerender, result } = renderHook(() => useFieldOptions(source), {
        wrapper: function Wrapper({ children }: { children: ReactNode }): ReactElement {
          return (
            <DataSourceProvider dataSources={dataSources} resolver={resolver} versions={versionsRef.current}>
              {children}
            </DataSourceProvider>
          );
        }
      });

      await waitFor(() => expect(result.current.options).toEqual([{ label: "A", value: "a" }]));

      // Bump the nonce: the refresh starts, and the stale-looking options must
      // survive the in-flight window instead of blanking the consuming select.
      versionsRef.current = { ds: 1 };
      rerender();

      await waitFor(() => expect(result.current.loading).toBe(true));
      expect(result.current.options).toEqual([{ label: "A", value: "a" }]);

      refreshGate.resolve([{ label: "B", value: "b" }]);

      await waitFor(() => expect(result.current.options).toEqual([{ label: "B", value: "b" }]));
      expect(result.current.loading).toBe(false);
    });

    it("warns, flags the error, and keeps prior options when a refresh rejects", async () => {
      const versionsRef = { current: {} as Record<string, number> };
      const failure = new Error("backend down");
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(silence);
      const resolve = vi.fn()
        .mockResolvedValueOnce([{ label: "A", value: "a" }])
        .mockRejectedValueOnce(failure);
      const resolver: DataSourceResolver = { resolve };
      const dataSources: FormDataSource[] = [
        {
          id: "ds",
          name: "x",
          kind: "remote",
          request: { resource: "r", action: "a" }
        }
      ];
      const source: FieldOptionSource = { kind: "ref", dataSourceId: "ds" };

      const { rerender, result } = renderHook(() => useFieldOptions(source), {
        wrapper: function Wrapper({ children }: { children: ReactNode }): ReactElement {
          return (
            <DataSourceProvider dataSources={dataSources} resolver={resolver} versions={versionsRef.current}>
              {children}
            </DataSourceProvider>
          );
        }
      });

      await waitFor(() => expect(result.current.options).toEqual([{ label: "A", value: "a" }]));
      expect(result.current.error).toBe(false);

      versionsRef.current = { ds: 1 };
      rerender();

      await waitFor(() => expect(result.current.error).toBe(true));
      expect(result.current.loading).toBe(false);
      expect(result.current.options).toEqual([{ label: "A", value: "a" }]);
      expect(consoleWarn).toHaveBeenCalledWith(
        "[form-editor] data source \"ds\" failed to resolve:",
        failure
      );
      consoleWarn.mockRestore();
    });

    it("does not re-fetch an inline remote source when versions change", async () => {
      const resolver: DataSourceResolver = { resolve: vi.fn().mockResolvedValue([{ label: "A", value: "a" }]) };
      const source: FieldOptionSource = { kind: "remote", request: { resource: "r", action: "a" } };

      const { rerender } = render(
        <DataSourceProvider resolver={resolver} versions={{}}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(1));

      // An inline remote source has no `refreshId`, so an unrelated version bump
      // must not churn it into a re-fetch. `rerender` flushes effects in `act`, so
      // a spurious re-fetch would already have called `resolve` a second time.
      rerender(
        <DataSourceProvider resolver={resolver} versions={{ other: 1 }}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      expect(resolver.resolve).toHaveBeenCalledTimes(1);
    });
  });
});
