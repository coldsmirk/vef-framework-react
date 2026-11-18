import type { ApiRequest } from "@vef-framework-react/core";

import type { AnnotationView, FlowGraphNode, MyInstanceDetail, SaveAnnotationParams } from "../../types";

import userEvent from "@testing-library/user-event";

import { mockApprovalApi, render, screen, waitFor, within } from "../../../test-utils";
import { InstanceDetailPanel } from "../detail";
import { AnnotationList } from "./index";
import { matchesField } from "./use-annotations";

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

function graphNode(nodeId: string, kind: FlowGraphNode["kind"], name: string): FlowGraphNode {
  return {
    id: nodeId,
    nodeId,
    kind,
    position: { x: 0, y: 0 },
    data: { name, status: "active" }
  };
}

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
      graphNode("start", "start", "提交申请"),
      graphNode("n", "approval", "部门审批"),
      graphNode("branch", "condition", "金额分支"),
      graphNode("handle", "handle", "财务办理"),
      graphNode("cc", "cc", "财务抄送"),
      graphNode("end", "end", "归档结束")
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

function setup(returned = false, canWrite = true, extraAnnotations: AnnotationView[] = []) {
  let annotations = [
    ...extraAnnotations,
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
    expect(await screen.findByText("财务办理")).toBeVisible();

    for (const name of ["提交申请", "金额分支", "财务抄送", "归档结束"]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }

    await user.click(await screen.findByText("部门审批"));
    await user.click(screen.getByText("财务办理"));
    await user.keyboard("{Escape}");
    await user.click(save);
    await waitFor(() => expect(writes[0]?.params).toMatchObject({
      taskId: "task",
      content: "请核对数量",
      audience: { scope: "nodes", nodeIds: ["n", "handle"] }
    }));
    const form = within(screen.getByRole("tabpanel", { name: "审批表单" }));
    expect(await form.findByText("请核对数量")).toBeVisible();
    expect(form.getByText("草稿")).toBeVisible();
    expect(form.getByText("指定节点可见（部门审批、财务办理）")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "流转记录" }));
    const timeline = within(screen.getByRole("tabpanel", { name: "流转记录" }));
    expect(await timeline.findByText("已发布")).toBeVisible();
    expect(timeline.getByText("已作废（待办已由他人处理）")).toBeVisible();
    expect(timeline.getByText("草稿")).toBeVisible();
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

  it("keeps the task holder's saved draft editable and deletable on the form tab", async () => {
    const user = userEvent.setup();
    const writes = setup(false, true, [
      {
        ...published,
        id: "other",
        taskId: "other-task",
        content: "另一待办的草稿",
        status: "draft"
      }
    ]);
    const form = within(await screen.findByRole("tabpanel", { name: "审批表单" }));
    await user.click(form.getByRole("button", { name: "添加批注" }));
    await user.type(form.getByRole("textbox", { name: "批注内容" }), "检查预算");
    await user.click(form.getByRole("button", { name: "保存草稿" }));
    expect(await form.findByText("草稿")).toBeVisible();
    expect(form.getByText("检查预算")).toBeVisible();
    expect(form.getByRole("button", { name: "删除草稿" })).toBeVisible();
    expect(form.queryByText("旧草稿")).not.toBeInTheDocument();
    expect(form.queryByText("另一待办的草稿")).not.toBeInTheDocument();
    await user.click(form.getByRole("button", { name: "编辑草稿" }));
    const content = form.getByRole("textbox", { name: "批注内容" });
    await user.clear(content);
    await user.type(content, "确认预算");
    await user.click(form.getByRole("button", { name: "保存草稿" }));
    expect(await form.findByRole("button", { name: "编辑草稿" })).toBeVisible();
    expect(form.getByText("确认预算")).toBeVisible();
    await user.click(form.getByRole("button", { name: "删除草稿" }));
    await waitFor(() => expect(form.queryByText("确认预算")).not.toBeInTheDocument());
    expect(writes.map(write => write.action)).toEqual(["save_annotation", "save_annotation", "delete_annotation"]);
    expect(writes[2]?.params).toEqual({ id: "draft" });
  });

  it("uses the node audience label when its names are unavailable", () => {
    render(<AnnotationList detail={{ ...detail, annotations: [{ ...published, audience: { scope: "nodes", nodeIds: ["missing"] } }] }} />, { apiClient: mockApprovalApi(() => []) });
    expect(screen.getByText("指定节点可见")).toBeVisible();
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

describe("matchesField", () => {
  it("matches a row anchor without requiring a column", () => {
    const row = { field: "lines", row: 0 };
    expect(matchesField({ ...published, anchor: row }, row)).toBe(true);
    expect(matchesField({ ...published, anchor: { ...row, column: "price" } }, row)).toBe(true);
    expect(matchesField({ ...published, anchor: { ...row, row: 1 } }, row)).toBe(false);
  });

  it("filters by column independently of row and keeps the whole-field view inclusive", () => {
    const column = { field: "lines", column: "price" };
    expect(matchesField({ ...published, anchor: column }, column)).toBe(true);
    expect(matchesField({ ...published, anchor: { ...column, row: 0 } }, column)).toBe(true);
    const quantity = {
      ...published,
      anchor: {
        field: "lines",
        row: 0,
        column: "quantity"
      }
    };
    expect(matchesField(quantity, column)).toBe(false);
    expect(matchesField(quantity, { field: "lines" })).toBe(true);
  });
});
