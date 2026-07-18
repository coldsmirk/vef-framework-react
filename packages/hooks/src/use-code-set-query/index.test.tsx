import type { DataOption, HttpClient } from "@vef-framework-react/core";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, renderHook, waitFor } from "../../test-utils";
import { resolveCodeSetKey, useCodeSetQuery } from "./index";

const CODE_SET_RESPONSE: Record<string, DataOption[]> = {
  status: [
    { label: "Active", value: "active" },
    { label: "Archived", value: "archived" }
  ],
  region: [{ label: "Asia", value: "asia" }]
};

function codeSetHandler(): Record<string, DataOption[]> {
  return CODE_SET_RESPONSE;
}

function codeSetFactory(_http: Readonly<HttpClient>): typeof codeSetHandler {
  return codeSetHandler;
}

describe("code-set/resolveCodeSetKey", () => {
  it("returns plain string values unchanged", () => {
    expect(resolveCodeSetKey("status")).toBe("status");
  });

  it("extracts the .key field from config objects", () => {
    expect(resolveCodeSetKey({ key: "status" })).toBe("status");
  });
});

describe("hooks/useCodeSetQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when the app context does not provide a codeSetQueryFn", () => {
    expect(() => renderHook(() => useCodeSetQuery({ status: "status" }))).toThrow(/Code set query function is not provided/);
  });

  it("maps the alias keys back to their resolved code set entries", async () => {
    const apiClient = createTestApiClient();
    const codeSetQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
      "system/code-set",
      codeSetFactory
    );

    const aliasMap = { status: "status", region: "region" } as const;
    const { result } = renderHook(
      () => useCodeSetQuery(aliasMap),
      {
        apiClient,
        appContext: { codeSetQueryFn }
      }
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toEqual({
      status: CODE_SET_RESPONSE.status,
      region: CODE_SET_RESPONSE.region
    });
  });

  it("resolves alias keys defined as config objects via the .key field", async () => {
    const apiClient = createTestApiClient();
    const codeSetQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
      "system/code-set",
      codeSetFactory
    );

    const aliasMap = { active: { key: "status" } } as const;
    const { result } = renderHook(
      () => useCodeSetQuery(aliasMap),
      {
        apiClient,
        appContext: { codeSetQueryFn }
      }
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.active).toEqual(CODE_SET_RESPONSE.status);
  });

  it("falls back to an empty array when a resolved key is missing in the response", async () => {
    const apiClient = createTestApiClient();
    const codeSetQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
      "system/code-set",
      codeSetFactory
    );

    const aliasMap = { missing: "no-such-key" } as const;
    const { result } = renderHook(
      () => useCodeSetQuery(aliasMap),
      {
        apiClient,
        appContext: { codeSetQueryFn }
      }
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.missing).toEqual([]);
  });

  it("respects the enabled=false option and never invokes the code set fetch", () => {
    const apiClient = createTestApiClient();
    const codeSetQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
      "system/code-set",
      codeSetFactory
    );

    const { result } = renderHook(
      () => useCodeSetQuery({ status: "status" } as const, { enabled: false }),
      {
        apiClient,
        appContext: { codeSetQueryFn }
      }
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
  });
});
