import type { DataOption, HttpClient } from "@vef-framework-react/core";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, renderHook, waitFor } from "../../test-utils";
import { resolveDictKey, useDictionaryQuery } from "./index";

const DICTIONARY_RESPONSE: Record<string, DataOption[]> = {
  status: [
    { label: "Active", value: "active" },
    { label: "Archived", value: "archived" }
  ],
  region: [{ label: "Asia", value: "asia" }]
};

function dictionaryHandler(): Record<string, DataOption[]> {
  return DICTIONARY_RESPONSE;
}

function dictionaryFactory(_http: Readonly<HttpClient>): typeof dictionaryHandler {
  return dictionaryHandler;
}

describe("dictionary/resolveDictKey", () => {
  it("returns plain string values unchanged", () => {
    expect(resolveDictKey("status")).toBe("status");
  });

  it("extracts the .key field from config objects", () => {
    expect(resolveDictKey({ key: "status" })).toBe("status");
  });
});

describe("hooks/useDictionaryQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when the app context does not provide a dictionaryQueryFn", () => {
    expect(() => renderHook(() => useDictionaryQuery({ status: "status" }))).toThrow(/Dictionary query function is not provided/);
  });

  it("maps the alias keys back to their resolved dictionary entries", async () => {
    const apiClient = createTestApiClient();
    const dictionaryQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
      "system/dictionary",
      dictionaryFactory
    );

    const aliasMap = { status: "status", region: "region" } as const;
    const { result } = renderHook(
      () => useDictionaryQuery(aliasMap),
      {
        apiClient,
        appContext: { dictionaryQueryFn }
      }
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toEqual({
      status: DICTIONARY_RESPONSE.status,
      region: DICTIONARY_RESPONSE.region
    });
  });

  it("resolves alias keys defined as config objects via the .key field", async () => {
    const apiClient = createTestApiClient();
    const dictionaryQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
      "system/dictionary",
      dictionaryFactory
    );

    const aliasMap = { active: { key: "status" } } as const;
    const { result } = renderHook(
      () => useDictionaryQuery(aliasMap),
      {
        apiClient,
        appContext: { dictionaryQueryFn }
      }
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.active).toEqual(DICTIONARY_RESPONSE.status);
  });

  it("falls back to an empty array when a resolved key is missing in the response", async () => {
    const apiClient = createTestApiClient();
    const dictionaryQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
      "system/dictionary",
      dictionaryFactory
    );

    const aliasMap = { missing: "no-such-key" } as const;
    const { result } = renderHook(
      () => useDictionaryQuery(aliasMap),
      {
        apiClient,
        appContext: { dictionaryQueryFn }
      }
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.missing).toEqual([]);
  });

  it("respects the enabled=false option and never invokes the dictionary fetch", () => {
    const apiClient = createTestApiClient();
    const dictionaryQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
      "system/dictionary",
      dictionaryFactory
    );

    const { result } = renderHook(
      () => useDictionaryQuery({ status: "status" } as const, { enabled: false }),
      {
        apiClient,
        appContext: { dictionaryQueryFn }
      }
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
  });
});
