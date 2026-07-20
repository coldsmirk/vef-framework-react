import type { AssigneeDefinition, FlowDefinition } from "../types";

import { describe, expect, it } from "vitest";

import { EDGE_MARKER_END } from "../constants";
import { fromFlowDefinition, toFlowDefinition } from "./serialization";

describe("serialization", () => {
  const approvalAssignees: AssigneeDefinition[] = [
    {
      kind: "user",
      ids: ["u1"],
      sortOrder: 1
    }
  ];
  const edgeData = { remark: "提交" };
  const definition: FlowDefinition = {
    nodes: [
      {
        id: "start_1",
        kind: "start",
        position: { x: 0, y: 0 },
        data: { name: "开始" }
      },
      {
        id: "approval_1",
        kind: "approval",
        position: { x: 200, y: 0 },
        data: {
          name: "审批",
          assignees: approvalAssignees
        }
      },
      {
        id: "end_1",
        kind: "end",
        position: { x: 400, y: 0 },
        data: { name: "结束" }
      }
    ],
    edges: [
      {
        id: "e1",
        source: "start_1",
        target: "approval_1",
        data: edgeData
      },
      {
        id: "e2",
        source: "approval_1",
        target: "end_1"
      }
    ]
  };

  it("hydrates nodes with normalized, fully-explicit data", () => {
    const { nodes } = fromFlowDefinition(definition);
    const approvalNode = nodes.find(n => n.id === "approval_1");

    expect(approvalNode?.type).toBe("approval");

    if (approvalNode?.type !== "approval") {
      return;
    }

    // The hydrated node must carry the designer defaults explicitly so a
    // round-trip serializes exactly what the config panels display.
    expect(approvalNode.data.passRule).toBe("all");
    expect(approvalNode.data.approvalMethod).toBe("parallel");
    expect(approvalNode.data.isRollbackAllowed).toBe(true);
    expect(approvalNode.data.assignees).toEqual([
      {
        kind: "user",
        ids: ["u1"],
        sortOrder: 1
      }
    ]);
  });

  it("round-trips a hydrated definition with explicit defaults", () => {
    const { nodes, edges } = fromFlowDefinition(definition);
    const serialized = toFlowDefinition(nodes, edges);

    const approvalNode = serialized.nodes.find(n => n.id === "approval_1");

    expect(approvalNode?.kind).toBe("approval");

    if (approvalNode?.kind !== "approval") {
      return;
    }

    expect(approvalNode.data?.passRule).toBe("all");
    expect(approvalNode.data?.emptyAssigneeAction).toBe("auto_pass");
    expect(serialized.edges).toHaveLength(2);
    expect(serialized.edges[0]).toMatchObject({
      id: "e1",
      source: "start_1",
      target: "approval_1"
    });
  });

  it("hydrates nodes and edges detached from the definition", () => {
    const { nodes, edges } = fromFlowDefinition(definition);
    const approvalNode = nodes.find(n => n.id === "approval_1");

    expect(approvalNode?.type).toBe("approval");

    if (approvalNode?.type !== "approval") {
      return;
    }

    // Store state must never alias host input: a host later mutating the
    // definition it passed in must not rewrite store state behind zustand.
    expect(approvalNode.position).toEqual({ x: 200, y: 0 });
    expect(approvalNode.position).not.toBe(definition.nodes[1]?.position);
    expect(approvalNode.data.assignees).toEqual(approvalAssignees);
    expect(approvalNode.data.assignees).not.toBe(approvalAssignees);
    expect(edges[0]?.data).toEqual(edgeData);
    expect(edges[0]?.data).not.toBe(edgeData);
  });

  it("emits a definition detached from the live nodes and edges", () => {
    const { nodes, edges } = fromFlowDefinition(definition);
    const serialized = toFlowDefinition(nodes, edges);
    const liveNode = nodes.find(n => n.id === "approval_1");
    const emittedNode = serialized.nodes.find(n => n.id === "approval_1");

    // The emitted definition is a snapshot the host owns: mutating it must
    // not reach back into live editor state.
    expect(emittedNode?.position).toEqual(liveNode?.position);
    expect(emittedNode?.position).not.toBe(liveNode?.position);
    expect(emittedNode?.data).toEqual(liveNode?.data);
    expect(emittedNode?.data).not.toBe(liveNode?.data);
    expect(serialized.edges[0]?.data).toEqual(edgeData);
    expect(serialized.edges[0]?.data).not.toBe(edges[0]?.data);
  });

  it("derives deletable from node rules during hydration", () => {
    const { nodes } = fromFlowDefinition(definition);

    expect(nodes.find(n => n.id === "start_1")?.deletable).toBe(false);
    expect(nodes.find(n => n.id === "end_1")?.deletable).toBe(false);
    expect(nodes.find(n => n.id === "approval_1")?.deletable).toBe(true);
  });

  it("attaches the directional arrowhead on hydration without serializing it", () => {
    const { nodes, edges } = fromFlowDefinition(definition);

    // Every hydrated edge carries the shared arrow marker so flow direction
    // survives manual layouts.
    expect(edges.every(edge => edge.markerEnd === EDGE_MARKER_END)).toBe(true);

    // The marker is editor chrome, not part of the backend contract.
    const serialized = toFlowDefinition(nodes, edges);

    for (const edge of serialized.edges) {
      expect(edge).not.toHaveProperty("markerEnd");
    }
  });
});
