import type { InstanceFlowGraph } from "../../types";

import { render, screen } from "@testing-library/react";

import { InstanceFlowGraphViewer } from "./index";

// Verbatim from a real my.get_instance_detail response.
const FLOW_GRAPH = {
  nodes: [
    {
      id: "start_gdboprkdxofx5tgj",
      nodeId: "d9pefljmckfiq6gg4tr0",
      kind: "start",
      position: { x: 12, y: 12 },
      data: {
        name: "开始",
        status: "passed",
        activities: [
          {
            action: "submit",
            operator: {
              id: "d81bv3h16v6c73bdmtgg",
              name: "胡彪",
              departmentId: "d56",
              departmentName: "研发部"
            },
            createdAt: "2026-08-06 10:17:41"
          }
        ],
        startedAt: "2026-08-06 10:17:40",
        finishedAt: "2026-08-06 10:17:40"
      }
    },
    {
      id: "end_vypffndrbd1w5qoy",
      nodeId: "d9pefljmckfiq6gg4trg",
      kind: "end",
      position: { x: 532, y: 12 },
      data: { name: "结束", status: "pending" }
    },
    {
      id: "approval_brstql1s2ig7a8qh",
      nodeId: "d9pefljmckfiq6gg4ts0",
      kind: "approval",
      position: { x: 272, y: 12 },
      data: {
        name: "审批节点",
        status: "active",
        executionType: "manual",
        approvalMethod: "parallel",
        passRule: "all",
        participants: [
          {
            taskId: "d9puthbmckfv3hi8r7s0",
            user: { id: "d5u47dso4l6bbjkma5dg", name: "梁应福" },
            status: "approved",
            opinion: "已阅，同意审批",
            actionTime: "2026-08-06 16:24:19"
          },
          {
            taskId: "d9puthbmckfv3hi8r7sg",
            user: { id: "d81bv3h16v6c73bdmtgg", name: "胡彪" },
            status: "pending"
          }
        ],
        startedAt: "2026-08-06 10:17:40"
      }
    }
  ],
  edges: [
    {
      id: "xy-edge__start_gdboprkdxofx5tgj-approval_brstql1s2ig7a8qh",
      source: "start_gdboprkdxofx5tgj",
      target: "approval_brstql1s2ig7a8qh"
    },
    {
      id: "xy-edge__approval_brstql1s2ig7a8qh-end_vypffndrbd1w5qoy",
      source: "approval_brstql1s2ig7a8qh",
      target: "end_vypffndrbd1w5qoy"
    }
  ]
} as unknown as InstanceFlowGraph;

describe("InstanceFlowGraphViewer against a real payload", () => {
  it("renders every node with its progress", () => {
    render(<InstanceFlowGraphViewer flowGraph={FLOW_GRAPH} />);

    expect(screen.getByText("开始")).toBeInTheDocument();
    expect(screen.getByText("审批节点")).toBeInTheDocument();
    expect(screen.getByText("结束")).toBeInTheDocument();
    expect(screen.getByText("已通过")).toBeInTheDocument();
    expect(screen.getByText("进行中")).toBeInTheDocument();
    expect(screen.getByText("未到达")).toBeInTheDocument();
  });

  it("floats the submitter above the start node and the approvers above the approval node", () => {
    render(<InstanceFlowGraphViewer flowGraph={FLOW_GRAPH} />);

    // 胡彪 appears twice: submitter on start, pending approver on the node.
    expect(screen.getAllByText("胡")).toHaveLength(2);
    expect(screen.getByText("梁")).toBeInTheDocument();
  });

  it("dashes the node the instance never reached", () => {
    const { container } = render(<InstanceFlowGraphViewer flowGraph={FLOW_GRAPH} />);

    const cards = container.querySelectorAll<HTMLElement>("[data-reached]");
    const reached = [...cards].map(card => card.dataset.reached);

    expect(reached).toEqual(["true", "false", "true"]);
  });
});

// Hover is covered in people-overlay.test.tsx rather than here: jsdom resolves
// react-flow's `@layer`-wrapped cascade backwards — `.react-flow__node`
// computes to `pointer-events: none` instead of `all`, which blocks every
// pointer interaction inside a node, the node's own name included. The
// inversion is the environment's, not the component's.
