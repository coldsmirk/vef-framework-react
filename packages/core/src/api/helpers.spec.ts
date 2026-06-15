import { describe, expect, it } from "vitest";

import { ApiClient } from "./client";
import { createApiClient, createApiRequest } from "./helpers";

describe("api/createApiRequest", () => {
  describe("three-argument form", () => {
    it("defaults the version to 'v1' when only resource and action are provided", () => {
      const request = createApiRequest("sys/storage", "abort_upload");

      expect(request).toEqual({
        resource: "sys/storage",
        action: "abort_upload",
        version: "v1",
        params: undefined,
        meta: undefined
      });
    });

    it("attaches params and keeps version 'v1' when params are provided", () => {
      const request = createApiRequest("sys/storage", "abort_upload", { claimId: "abc" });

      expect(request).toEqual({
        resource: "sys/storage",
        action: "abort_upload",
        version: "v1",
        params: { claimId: "abc" },
        meta: undefined
      });
    });

    it("attaches both params and meta when both are provided", () => {
      const request = createApiRequest("sys/storage", "abort_upload", { claimId: "abc" }, { trace: "req-1" });

      expect(request).toEqual({
        resource: "sys/storage",
        action: "abort_upload",
        version: "v1",
        params: { claimId: "abc" },
        meta: { trace: "req-1" }
      });
    });
  });

  describe("four-argument form (explicit version)", () => {
    it("uses the explicit version and attaches params", () => {
      const request = createApiRequest("sys/storage", "init_upload", "v2", { filename: "a.txt" });

      expect(request).toEqual({
        resource: "sys/storage",
        action: "init_upload",
        version: "v2",
        params: { filename: "a.txt" },
        meta: undefined
      });
    });

    it("uses the explicit version and attaches both params and meta", () => {
      const request = createApiRequest("sys/storage", "init_upload", "v2", { filename: "a.txt" }, { trace: "req-9" });

      expect(request).toEqual({
        resource: "sys/storage",
        action: "init_upload",
        version: "v2",
        params: { filename: "a.txt" },
        meta: { trace: "req-9" }
      });
    });
  });
});

describe("api/createApiClient", () => {
  it("returns an ApiClient instance configured with the provided options", () => {
    const client = createApiClient({ http: { baseUrl: "http://test" } });

    expect(client).toBeInstanceOf(ApiClient);
  });
});
