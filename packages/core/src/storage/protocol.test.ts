import type { ApiResult, HttpClient, RequestOptions } from "../http";
import type { ProtocolContext, ResolveFilesResponse } from "./protocol";

import { describe, expect, it } from "vitest";

import { UploadProtocolError } from "./errors";
import { DEFAULT_API_PATH, DEFAULT_FILE_RESOURCE, DEFAULT_VERSION, resolveFiles } from "./protocol";

interface PostCall {
  url: string;
  data: unknown;
}

function makeContext(
  respond: () => unknown
): { ctx: ProtocolContext; calls: PostCall[] } {
  const calls: PostCall[] = [];

  const http = {
    post: <R>(url: string, options?: RequestOptions & { data?: unknown }): Promise<ApiResult<R>> => {
      calls.push({ url, data: options?.data });

      return Promise.resolve({
        code: 0,
        message: "ok",
        data: respond()
      } as ApiResult<R>);
    }
  } as unknown as Readonly<HttpClient>;

  return {
    ctx: {
      http,
      apiPath: DEFAULT_API_PATH,
      resource: DEFAULT_FILE_RESOURCE,
      version: DEFAULT_VERSION
    },
    calls
  };
}

describe("storage/resolveFiles", () => {
  it("posts the registry envelope the backend resource expects", async () => {
    const files: ResolveFilesResponse["files"] = [
      {
        key: "priv/2026/08/04/9f3c.pdf",
        originalFilename: "季度报告.pdf",
        contentType: "application/pdf",
        size: 2048,
        status: "claimed",
        uploadedAt: "2026-08-04 09:00:00",
        uploadedBy: "u-1"
      }
    ];

    const { ctx, calls } = makeContext(() => {
      return { files };
    });

    const response = await resolveFiles(ctx, ["priv/2026/08/04/9f3c.pdf"]);

    expect(response.files).toEqual(files);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api");
    expect(calls[0]?.data).toEqual({
      resource: "sys/storage/file",
      action: "resolve",
      version: "v1",
      params: { keys: ["priv/2026/08/04/9f3c.pdf"] },
      meta: undefined
    });
  });

  it("wraps transport failures in an UploadProtocolError", async () => {
    const { ctx } = makeContext(() => {
      throw new Error("network down");
    });

    await expect(resolveFiles(ctx, ["priv/whatever.bin"])).rejects.toBeInstanceOf(UploadProtocolError);
  });
});
