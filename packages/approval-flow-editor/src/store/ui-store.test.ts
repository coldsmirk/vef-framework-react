import type { FlowValidationError } from "../shared/flow-validation";

import { describe, expect, it } from "vitest";

import { countIssuesByNode } from "./ui-store";

describe("countIssuesByNode", () => {
  it("returns an empty record for a clean flow", () => {
    expect(countIssuesByNode([])).toEqual({});
  });

  it("groups node-scoped issues and skips graph-level ones", () => {
    const issues: FlowValidationError[] = [
      {
        code: "node_outgoing_count",
        message: "出边数量错误",
        nodeId: "a"
      },
      {
        code: "node_unreachable",
        message: "不可达",
        nodeId: "a"
      },
      {
        code: "rollback_target_self",
        message: "回退自身",
        nodeId: "b"
      },
      { code: "graph_cycle", message: "存在环路" }
    ];

    expect(countIssuesByNode(issues)).toEqual({ a: 2, b: 1 });
  });
});
