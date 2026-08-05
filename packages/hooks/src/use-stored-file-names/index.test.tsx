import type { ResolvedFile } from "@vef-framework-react/core";

import { afterEach, describe, expect, it, vi } from "vitest";

import { renderHook, waitFor } from "../../test-utils";
import { useStoredFileNames } from "./index";

const REPORT_KEY = "priv/2026/08/04/9f3c.pdf";
const BUDGET_KEY = "priv/2026/08/04/1a2b.xlsx";

const mocks = vi.hoisted(() => {
  return { resolveFiles: vi.fn() };
});

vi.mock("@vef-framework-react/core", async importActual => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest's importActual type parameter requires an inline `typeof import(...)` to type the real module.
  const actual = await importActual<typeof import("@vef-framework-react/core")>();
  return {
    ...actual,
    resolveFiles: mocks.resolveFiles
  };
});

function resolved(key: string, originalFilename: string): ResolvedFile {
  return {
    key,
    originalFilename,
    contentType: "application/pdf",
    size: 1024,
    status: "claimed",
    uploadedAt: "2026-08-04 09:00:00",
    uploadedBy: "u-1"
  };
}

describe("hooks/useStoredFileNames", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("resolves stored keys into their recorded upload metadata", async () => {
    mocks.resolveFiles.mockResolvedValue({ files: [resolved(REPORT_KEY, "季度报告.pdf")] });

    const { result } = renderHook(() => useStoredFileNames([REPORT_KEY]));

    await waitFor(() => {
      expect(result.current[REPORT_KEY]).toBeDefined();
    });

    expect(result.current[REPORT_KEY]?.originalFilename).toBe("季度报告.pdf");
  });

  it("asks the registry for a sorted, deduplicated key set", async () => {
    mocks.resolveFiles.mockResolvedValue({ files: [resolved(REPORT_KEY, "季度报告.pdf")] });

    const { result } = renderHook(() => useStoredFileNames([REPORT_KEY, REPORT_KEY, BUDGET_KEY]));

    await waitFor(() => {
      expect(result.current[REPORT_KEY]).toBeDefined();
    });

    expect(mocks.resolveFiles).toHaveBeenCalledTimes(1);
    expect(mocks.resolveFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "sys/storage/file",
        apiPath: "/api",
        version: "v1"
      }),
      [BUDGET_KEY, REPORT_KEY]
    );
  });

  it("omits keys the backend did not resolve", async () => {
    mocks.resolveFiles.mockResolvedValue({ files: [resolved(REPORT_KEY, "季度报告.pdf")] });

    const { result } = renderHook(() => useStoredFileNames([REPORT_KEY, BUDGET_KEY]));

    await waitFor(() => {
      expect(result.current[REPORT_KEY]).toBeDefined();
    });

    expect(result.current[BUDGET_KEY]).toBeUndefined();
  });

  it("does not call the backend when there is nothing to resolve", () => {
    const { result } = renderHook(() => useStoredFileNames([]));

    expect(result.current).toEqual({});
    expect(mocks.resolveFiles).not.toHaveBeenCalled();
  });

  // Names are decoration: a failing lookup must leave the caller with an
  // empty map to fall back from, never an exception.
  it("degrades to an empty map when the lookup fails", async () => {
    mocks.resolveFiles.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useStoredFileNames([REPORT_KEY]));

    await waitFor(() => {
      expect(mocks.resolveFiles).toHaveBeenCalled();
    });

    expect(result.current).toEqual({});
  });
});
