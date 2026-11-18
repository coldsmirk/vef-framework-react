import type { ApiRequest } from "@vef-framework-react/core";

import type { AnnotationView, MyInstanceDetail, SaveAnnotationParams } from "../../types";

import userEvent from "@testing-library/user-event";

import { mockApprovalApi, render, screen, waitFor, within } from "../../../test-utils";
import { InstanceDetailPanel } from "../detail";

const author = { id: "u", name: "张三" };
const published: AnnotationView = {
  id: "a1",
  instanceId: "i",
  nodeId: "n",
  nodeName: "部门审批",
  visitId: "visit",
  taskId: "task",
  author,
  content: "请补充预算",
  status: "published",
  audience: { scope: "applicant" },
  anchor: { field: "cost" }
};
const detail: MyInstanceDetail = {
  instance: {
    instanceId: "i",
    instanceNo: "2026",
    title: "采购申请",
    flowId: "f",
    flowCode: "buy",
    flowName: "采购",
    applicant: author,
    status: "running",
    createdAt: "2026-11-18"
  },
  myTask: {
    taskId: "task",
    nodeId: "n",
    isOpinionRequired: false
  },
  availableActions: ["approve"],
  timeline: [
    {
      kind: "approval",
      nodeId: "n",
      visitId: "visit",
      name: "部门审批",
      startedAt: "2026-11-18"
    }
  ],
  flowGraph: {
    nodes: [
      {
        id: "n",
        nodeId: "n",
        kind: "approval",
        position: { x: 0, y: 0 },
        data: { name: "部门审批", status: "active" }
      }
    ],
    edges: []
  },
  formSchema: {
    id: "f",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "cost",
            type: "textfield",
            key: "cost",
            label: "预算"
          }
        ]
      }
    }
  }
};

function setup(returned = false, canWrite = true) {
  let annotations = [
    published,
    {
      ...published,
      id: "old",
      status: "discarded" as const,
      content: "旧草稿"
    }
  ];
  const writes: ApiRequest[] = [];
  const apiClient = mockApprovalApi(req => {
    if (req.action === "get_instance_detail") {
      return returned
        ? {
            ...detail,
            instance: { ...detail.instance, status: "returned" },
            myTask: undefined,
            availableActions: ["resubmit"],
            annotations
          }
        : { ...detail, annotations };
    }

    writes.push(req);

    if (req.action === "save_annotation") {
      const params = req.params as SaveAnnotationParams;
      const value: AnnotationView = {
        ...published,
        status: "draft",
        ...params,
        id: params.id ?? "draft"
      };
      annotations = [...annotations.filter(a => a.id !== value.id), value];
      return value;
    }

    if (req.action === "delete_annotation") {
      annotations = annotations.filter(a => a.id !== req.params?.id);
    }
  });
  render(<InstanceDetailPanel instanceId="i" />, { apiClient, appContext: { hasPermission: () => canWrite } });
  return writes;
}

describe("instance annotations", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds a node-scoped draft, edits its audience through search and deletes it under the timeline entry", async () => {
    const user = userEvent.setup();
    const writes = setup();
    await user.click(await screen.findByRole("button", { name: "添加批注" }));
    await user.type(screen.getByRole("textbox", { name: "批注内容" }), "请核对数量");
    await user.click(screen.getByRole("combobox", { name: "可见范围" }));
    await user.click(await screen.findByText("指定节点"));
    const save = screen.getByRole("button", { name: "保存草稿" });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "可见节点" }));
    await user.click(await screen.findByText("部门审批"));
    await user.keyboard("{Escape}");
    await user.click(save);
    await waitFor(() => expect(writes[0]?.params).toMatchObject({
      taskId: "task",
      content: "请核对数量",
      audience: { scope: "nodes", nodeIds: ["n"] }
    }));
    await user.click(screen.getByRole("tab", { name: "流转记录" }));
    expect(await screen.findByText("已发布")).toBeVisible();
    expect(screen.getByText("已作废（待办已由他人处理）")).toBeVisible();
    expect(screen.getByText("草稿")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "编辑草稿" }));
    const input = screen.getByRole("textbox", { name: "批注内容" });
    await user.clear(input);
    await user.type(input, "改给财务");
    await user.click(screen.getByRole("combobox", { name: "可见范围" }));
    await user.click(await screen.findByText("指定人员"));
    const people = screen.getByRole("combobox", { name: "可见人员" });
    await user.type(people, "张");
    await user.click(await screen.findByTitle("张三"));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(writes[1]?.params).toMatchObject({
      id: "draft",
      content: "改给财务",
      audience: { scope: "users", userIds: ["u"] }
    }));
    await user.click(await screen.findByRole("button", { name: "编辑草稿" }));
    await user.click(screen.getByRole("button", { name: "删除草稿" }));
    await waitFor(() => expect(screen.queryByText("改给财务")).not.toBeInTheDocument());
    expect(writes[2]).toMatchObject({ action: "delete_annotation", params: { id: "draft" } });
  });

  it("saves and revises an applicant response without sending an anchor or audience", async () => {
    const user = userEvent.setup();
    const writes = setup(true);
    await user.click(await screen.findByRole("button", { name: "回应批注" }));
    await user.click(screen.getByRole("radio", { name: "不采纳" }));
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeDisabled();
    await user.type(screen.getByLabelText("回应说明"), "已包含在总额中");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(writes[0]?.params).toMatchObject({
      parentId: "a1",
      content: "已包含在总额中",
      resolution: "declined"
    }));
    expect(writes[0]?.params).not.toHaveProperty("audience");
    expect(writes[0]?.params).not.toHaveProperty("anchor");
    expect(await screen.findByText("不采纳")).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "编辑回应" }));
    await user.click(screen.getByRole("radio", { name: "已修改" }));
    await user.clear(screen.getByLabelText("回应说明"));
    await user.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(writes[1]?.params).toMatchObject({
      id: "draft",
      parentId: "a1",
      resolution: "addressed",
      content: ""
    }));
    expect(await screen.findByText("已修改")).toBeVisible();
  });

  it("opens a field's counted annotations read-only without write permission", async () => {
    const user = userEvent.setup();
    setup(false, false);
    await user.click(await screen.findByRole("button", { name: "2 条批注" }));
    const dialog = within(await screen.findByRole("dialog", { name: /预算/ }));
    expect(dialog.getByText("请补充预算")).toBeVisible();
    expect(dialog.getByText("旧草稿")).toBeVisible();
    expect(screen.queryByRole("button", { name: "添加批注" })).not.toBeInTheDocument();
  });
});
