import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "./helpers";

describe("query/createQueryClient", () => {
  describe("defaults", () => {
    it("returns an instance of QueryClient", () => {
      expect(createQueryClient()).toBeInstanceOf(QueryClient);
    });

    it("applies the default 5000ms staleTime and 300000ms gcTime when no options are passed", () => {
      const client = createQueryClient();
      const queryDefaults = client.getDefaultOptions().queries;

      expect(queryDefaults?.staleTime).toBe(5000);
      expect(queryDefaults?.gcTime).toBe(300_000);
    });

    it("honors provided staleTime and gcTime overrides", () => {
      const client = createQueryClient({ staleTime: 0, gcTime: 1000 });
      const queryDefaults = client.getDefaultOptions().queries;

      expect(queryDefaults?.staleTime).toBe(0);
      expect(queryDefaults?.gcTime).toBe(1000);
    });

    it("forwards the gcTime override to the mutations defaults as well", () => {
      const client = createQueryClient({ gcTime: 1234 });
      const mutationDefaults = client.getDefaultOptions().mutations;

      expect(mutationDefaults?.gcTime).toBe(1234);
    });

    it("disables retries by default for both queries and mutations", () => {
      const client = createQueryClient();
      const { queries, mutations } = client.getDefaultOptions();

      expect(queries?.retry).toBe(false);
      expect(mutations?.retry).toBe(false);
    });
  });

  describe("mutation cache onSuccess", () => {
    it("invalidates queries listed in mutation meta.invalidates after a successful mutation", async () => {
      const client = createQueryClient();
      // Seed two queries — one in the invalidation list, one not.
      await client.fetchQuery({ queryKey: ["users", "list"] as const, queryFn: () => "users" });
      await client.fetchQuery({ queryKey: ["invoices"] as const, queryFn: () => "invoices" });

      const usersStateBefore = client.getQueryState(["users", "list"]);
      const invoicesStateBefore = client.getQueryState(["invoices"]);

      await client.getMutationCache().build(client, {
        mutationFn: () => Promise.resolve({ ok: true }),
        meta: {
          invalidates: [["users", "list"]] as never,
          shouldShowSuccessFeedback: false
        }
      }).execute(undefined as never);

      const usersStateAfter = client.getQueryState(["users", "list"]);
      const invoicesStateAfter = client.getQueryState(["invoices"]);

      expect(usersStateAfter?.isInvalidated).toBe(true);
      expect(usersStateBefore?.isInvalidated).toBe(false);
      expect(invoicesStateAfter?.isInvalidated).toBe(false);
      expect(invoicesStateBefore?.isInvalidated).toBe(false);
    });

    it("invokes showSuccessMessage with the response's message field when feedback is enabled", async () => {
      const showSuccessMessage = vi.fn();
      const client = createQueryClient({ showSuccessMessage });

      await client.getMutationCache().build(client, {
        mutationFn: () => Promise.resolve({ message: "ok-from-api" })
      }).execute(undefined as never);

      expect(showSuccessMessage).toHaveBeenCalledWith("ok-from-api");
    });

    it("does not invoke showSuccessMessage when shouldShowSuccessFeedback is false", async () => {
      const showSuccessMessage = vi.fn();
      const client = createQueryClient({ showSuccessMessage });

      await client.getMutationCache().build(client, {
        mutationFn: () => Promise.resolve({ message: "ignored" }),
        meta: { shouldShowSuccessFeedback: false }
      }).execute(undefined as never);

      expect(showSuccessMessage).not.toHaveBeenCalled();
    });

    it("does not invoke showSuccessMessage when the response is not a plain object with a message field", async () => {
      const showSuccessMessage = vi.fn();
      const client = createQueryClient({ showSuccessMessage });

      await client.getMutationCache().build(client, {
        mutationFn: () => Promise.resolve("string-response")
      }).execute(undefined as never);

      expect(showSuccessMessage).not.toHaveBeenCalled();
    });
  });
});
