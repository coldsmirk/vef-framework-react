import type { ReactElement, ReactNode } from "react";

import type { FieldOptionSource, FormDataSource, FormServices } from "../types";

import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataSourceProvider, mapRemoteResponseToOptions, useFieldOptions } from "./data-source-context";

// Function.prototype is a no-op function — useful for silencing console without
// running into `@typescript-eslint/no-empty-function`.
const silence = Function.prototype as () => void;

function wrap(dataSources: FormDataSource[], request?: FormServices["request"]) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <DataSourceProvider dataSources={dataSources} request={request}>{children}</DataSourceProvider>;
  };
}

function optionsFor(source: FieldOptionSource, dataSources: FormDataSource[], request?: FormServices["request"]) {
  return renderHook(() => useFieldOptions(source), { wrapper: wrap(dataSources, request) });
}

function Probe({ source }: { source: FieldOptionSource }): ReactElement {
  const { options } = useFieldOptions(source);

  return <span>{options.map(option => String(option.value)).join(",")}</span>;
}

describe("mapRemoteResponseToOptions", () => {
  it("maps an array of records with default label/value keys", () => {
    expect(mapRemoteResponseToOptions([{ label: "A", value: "a" }, { label: "B", value: 2 }])).toEqual([
      { label: "A", value: "a" },
      { label: "B", value: 2 }
    ]);
  });

  it("extracts items from a paginated result and applies custom mapping", () => {
    expect(
      mapRemoteResponseToOptions(
        { items: [{ code: "E1", name: "Alice" }, { code: "E2", name: "Bob" }], total: 2 },
        { labelKey: "name", valueKey: "code" }
      )
    ).toEqual([
      { label: "Alice", value: "E1" },
      { label: "Bob", value: "E2" }
    ]);
  });
});

describe("useFieldOptions", () => {
  it("returns a static source's options synchronously", () => {
    const { result } = optionsFor({ kind: "static", options: [{ label: "A", value: "a" }] }, []);

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

    const { result } = optionsFor({ kind: "ref", dataSourceId: "ds1" }, dataSources);

    expect(result.current.options).toEqual([{ label: "北京", value: "bj" }]);
  });

  it("resolves a remote source through services.request with an AbortSignal", async () => {
    const request = vi.fn().mockResolvedValue([{ label: "C", value: "c" }]);

    const { result } = optionsFor({ kind: "remote", request: { resource: "geo", action: "cities" } }, [], request);

    await waitFor(() => expect(result.current.options).toEqual([{ label: "C", value: "c" }]));
    expect(request).toHaveBeenCalledWith(
      { resource: "geo", action: "cities" },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("normalizes blank mapping keys and maps paginated responses", async () => {
    // A blank key persisted by an older designer means "the default", but
    // reading `mapping.labelKey ?? "label"` directly would take "" literally.
    const request = vi.fn().mockResolvedValue({ items: [{ label: "北京", code: "bj" }], total: 1 });

    const { result } = optionsFor({
      kind: "remote",
      request: { resource: "geo", action: "cities" },
      mapping: { labelKey: "", valueKey: "code" }
    }, [], request);

    await waitFor(() => expect(result.current.options).toEqual([{ label: "北京", value: "bj" }]));
  });

  it("resolves a ref to a form-global remote source", async () => {
    const request = vi.fn().mockResolvedValue([{ label: "D", value: "d" }]);
    const dataSources: FormDataSource[] = [
      {
        id: "ds2",
        name: "部门",
        kind: "remote",
        request: { resource: "org", action: "depts" }
      }
    ];

    const { result } = optionsFor({ kind: "ref", dataSourceId: "ds2" }, dataSources, request);

    await waitFor(() => expect(result.current.options).toEqual([{ label: "D", value: "d" }]));
  });

  it("returns no options for an unknown ref", () => {
    const { result } = optionsFor({ kind: "ref", dataSourceId: "missing" }, []);

    expect(result.current.options).toEqual([]);
  });

  it("aborts an in-flight option fetch when the last consumer unmounts", async () => {
    let capturedSignal: AbortSignal | undefined;
    const deferred = Promise.withResolvers<unknown>();
    const request = vi.fn((_req, options: { signal: AbortSignal }) => {
      capturedSignal = options.signal;
      return deferred.promise;
    });

    const { unmount } = optionsFor({ kind: "remote", request: { resource: "geo", action: "cities" } }, [], request);

    await waitFor(() => expect(capturedSignal).toBeDefined());
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  describe("provider-scoped cache", () => {
    it("reuses a resolved remote response across a consumer remount", async () => {
      const request = vi.fn().mockResolvedValue([{ label: "C", value: "c" }]);
      const dataSources: FormDataSource[] = [
        {
          id: "ds",
          name: "x",
          kind: "remote",
          request: { resource: "r", action: "a" }
        }
      ];
      const source: FieldOptionSource = { kind: "ref", dataSourceId: "ds" };

      const view = render(
        <DataSourceProvider dataSources={dataSources} request={request}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await screen.findByText("c");

      // The provider instance persists across rerenders; only the consumer
      // unmounts and remounts — the editor's edit ⇄ preview Activity
      // round-trip in miniature.
      view.rerender(
        <DataSourceProvider dataSources={dataSources} request={request}>
          <span>empty</span>
        </DataSourceProvider>
      );
      view.rerender(
        <DataSourceProvider dataSources={dataSources} request={request}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await screen.findByText("c");
      expect(request).toHaveBeenCalledTimes(1);
    });

    it("deduplicates concurrent in-flight fetches for the same resolved request", async () => {
      const deferred = Promise.withResolvers<Array<{ label: string; value: string }>>();
      const request = vi.fn(() => deferred.promise);
      const source: FieldOptionSource = { kind: "remote", request: { resource: "sys/role", action: "find_options" } };

      render(
        <DataSourceProvider request={request}>
          <Probe source={source} />
          <Probe source={source} />
          <Probe source={source} />
        </DataSourceProvider>
      );

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

      deferred.resolve([{ label: "Admin", value: "admin" }]);

      expect(await screen.findAllByText("admin")).toHaveLength(3);
      expect(request).toHaveBeenCalledTimes(1);
    });
  });

  describe("refresh versions", () => {
    it("re-fetches a ref-to-remote source when its version nonce bumps", async () => {
      const request = vi.fn().mockResolvedValue([{ label: "A", value: "a" }]);
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
        <DataSourceProvider dataSources={dataSources} request={request} versions={{}}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

      // Bumping the source's nonce re-runs the fetch against the same request.
      rerender(
        <DataSourceProvider dataSources={dataSources} request={request} versions={{ ds: 1 }}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    });

    it("keeps the previous options while a refresh is in flight", async () => {
      const versionsRef = { current: {} as Record<string, number> };
      const refreshGate = Promise.withResolvers<Array<{ label: string; value: string }>>();
      // First resolve returns immediately; the refresh hangs until released, so
      // the in-flight window is observable.
      const request = vi.fn()
        .mockResolvedValueOnce([{ label: "A", value: "a" }])
        .mockReturnValueOnce(refreshGate.promise);
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
            <DataSourceProvider dataSources={dataSources} request={request} versions={versionsRef.current}>
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
      const request = vi.fn()
        .mockResolvedValueOnce([{ label: "A", value: "a" }])
        .mockRejectedValueOnce(failure);
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
            <DataSourceProvider dataSources={dataSources} request={request} versions={versionsRef.current}>
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
      const request = vi.fn().mockResolvedValue([{ label: "A", value: "a" }]);
      const source: FieldOptionSource = { kind: "remote", request: { resource: "r", action: "a" } };

      const { rerender } = render(
        <DataSourceProvider request={request} versions={{}}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

      // An inline remote source has no `refreshId`, so an unrelated version
      // bump must not churn it into a re-fetch. `rerender` flushes effects in
      // `act`, so a spurious re-fetch would already have called `request` twice.
      rerender(
        <DataSourceProvider request={request} versions={{ other: 1 }}>
          <Probe source={source} />
        </DataSourceProvider>
      );

      expect(request).toHaveBeenCalledTimes(1);
    });
  });

  describe("host request fault tolerance", () => {
    it("converges to error state when services.request throws synchronously", async () => {
      const boom = new Error("sync failure");
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(silence);
      const request = vi.fn(() => {
        throw boom;
      });

      const { result } = optionsFor({ kind: "remote", request: { resource: "geo", action: "cities" } }, [], request);

      await waitFor(() => expect(result.current.error).toBe(true));
      expect(result.current.loading).toBe(false);
      expect(result.current.options).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledWith(
        "[form-editor] data source \"(inline remote)\" failed to resolve:",
        boom
      );
      consoleWarn.mockRestore();
    });

    it("converges to error state when services.request returns a non-Promise value", async () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(silence);
      const request = vi.fn(() => undefined as unknown as Promise<unknown>);

      const { result } = optionsFor({ kind: "remote", request: { resource: "geo", action: "cities" } }, [], request);

      await waitFor(() => expect(result.current.error).toBe(true));
      expect(result.current.loading).toBe(false);
      expect(result.current.options).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledTimes(1);
      consoleWarn.mockRestore();
    });
  });
});
