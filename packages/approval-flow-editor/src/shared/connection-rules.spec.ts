import type { FlowEdge } from "../types";

import { describe, expect, it } from "vitest";

import { explainConnectionRejection, validateConnection } from "./connection-rules";

function edge(id: string, source: string, target: string, sourceHandle?: string): FlowEdge {
  return {
    id,
    source,
    target,
    sourceHandle: sourceHandle ?? null
  };
}

describe("connection-rules", () => {
  describe("explainConnectionRejection", () => {
    it("allows a fresh connection between unrelated nodes", () => {
      const edges = [edge("e1", "a", "b")];

      expect(explainConnectionRejection({
        source: "b",
        sourceHandle: null,
        target: "c"
      }, edges)).toBeNull();
    });

    it("rejects self-loops", () => {
      expect(explainConnectionRejection({
        source: "a",
        sourceHandle: null,
        target: "a"
      }, [])).toBe("self");
    });

    it("rejects a second edge from an occupied source handle", () => {
      const edges = [edge("e1", "a", "b")];

      expect(explainConnectionRejection({
        source: "a",
        sourceHandle: null,
        target: "c"
      }, edges)).toBe("occupied");
    });

    it("treats distinct source handles as independent outlets", () => {
      // Condition nodes expose one handle per branch; occupying one branch
      // must not block the others.
      const edges = [edge("e1", "cond", "b", "branch_1")];

      expect(explainConnectionRejection({
        source: "cond",
        sourceHandle: "branch_2",
        target: "c"
      }, edges)).toBeNull();
    });

    it("rejects connections that would close a cycle", () => {
      const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

      expect(explainConnectionRejection({
        source: "c",
        sourceHandle: null,
        target: "a"
      }, edges)).toBe("cycle");
    });
  });

  describe("validateConnection", () => {
    it("refuses connections with missing endpoints", () => {
      expect(validateConnection({
        source: "",
        target: "b",
        sourceHandle: null,
        targetHandle: null
      }, [])).toBe(false);
    });

    it("mirrors the explain verdict for complete connections", () => {
      const edges = [edge("e1", "a", "b")];

      expect(validateConnection({
        source: "b",
        target: "c",
        sourceHandle: null,
        targetHandle: null
      }, edges)).toBe(true);
      expect(validateConnection({
        source: "a",
        target: "c",
        sourceHandle: null,
        targetHandle: null
      }, edges)).toBe(false);
    });
  });
});
