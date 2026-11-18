import type { ApiRequest } from "@vef-framework-react/core";

import type { PickerProps } from "../../index";

import userEvent from "@testing-library/user-event";
import { Select } from "@vef-framework-react/components";

import { mockApprovalApi, render, screen, within } from "../../../test-utils";
import { APPROVAL_PERMISSIONS } from "../../permissions";
import { ApprovalProvider } from "../../plugins";
import { ApprovalAdminPage } from "./index";

const former = { id: "former", name: "张三" };
const other = { id: "other", name: "陈晨" };
const instances = [
  { instanceId: "i1", title: "差旅申请" },
  { instanceId: "i2", title: "采购申请" },
  { instanceId: "i3", title: "费用报销" }
].map(row => {
  return {
    ...row,
    instanceNo: row.instanceId,
    flowName: "审批流程",
    applicant: former,
    status: "running",
    createdAt: "2026-11-18 09:00:00"
  };
});

function DirectoryPicker(props: PickerProps) {
  return (
    <Select
      {...props}
      aria-label="搜索交接人员"
      maxTagCount={1}
      mode="multiple"
      options={[former, other].map(({ id, name }) => { return { value: id, label: name }; })}
      showSearch={{ optionFilterProp: "label" }}
      virtual={false}
    />
  );
}

function setup(allowed = true) {
  const respond = vi.fn(({ action, params }: ApiRequest) => {
    switch (action) {
      case "find_instances": {
        return { items: instances, total: instances.length };
      }

      case "apply_handovers": {
        return {
          transferred: [
            {
              instanceId: "i1",
              taskId: "t1",
              predecessor: former,
              successor: { id: "s", name: "李四" }
            }
          ],
          unassigned: [
            {
              instanceId: "i2",
              ccRecordId: "cc",
              predecessor: other
            }
          ],
          awaitingApplicant: ["i3"]
        };
      }

      case "get_instance_detail": {
        return {
          instance: instances.find(row => row.instanceId === params?.instanceId),
          timeline: [],
          flowGraph: { nodes: [], edges: [] }
        };
      }

      default: {
        throw new Error(`Unexpected action: ${action}`);
      }
    }
  });

  const permissions = new Set<string>([APPROVAL_PERMISSIONS.instance.query, APPROVAL_PERMISSIONS.instance.detail]);

  if (allowed) {
    permissions.add(APPROVAL_PERMISSIONS.handover.apply);
  }

  render(
    <ApprovalProvider plugins={{ pickers: { user: DirectoryPicker } }}>
      <ApprovalAdminPage />
    </ApprovalProvider>,
    { apiClient: mockApprovalApi(respond), appContext: { hasPermission: code => permissions.has(code) } }
  );

  return respond;
}

describe("ApplyHandoversAction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hides the action when an instance administrator lacks the handover permission", async () => {
    setup(false);
    await screen.findByText("差旅申请");
    expect(screen.queryByRole("button", { name: "按交接转移待办" })).not.toBeInTheDocument();
  });

  it("applies the searched people and opens the matching instance from each result group", async () => {
    const user = userEvent.setup();
    const respond = setup();
    await user.click(await screen.findByRole("button", { name: "按交接转移待办" }));
    const form = within(await screen.findByRole("dialog"));
    expect(form.getByText("按交接转移待办")).toBeInTheDocument();
    const run = form.getByRole("button", { name: "执行交接" });
    expect(run).toBeDisabled();
    const picker = form.getByRole("combobox", { name: "搜索交接人员" });
    await user.type(picker, "张");
    await user.click(await screen.findByRole("option", { name: "张三" }));
    await user.type(picker, "陈");
    await user.click(await screen.findByRole("option", { name: "陈晨" }));
    await user.click(run);

    expect(await form.findByText("交接处理结果")).toBeInTheDocument();
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({
      resource: "approval/admin",
      action: "apply_handovers",
      params: { userIds: ["former", "other"] }
    }));
    const moved = form.getByRole("region", { name: "已转移（1）" });
    const unassigned = form.getByRole("region", { name: "无接手人待处理（1）" });
    const awaiting = form.getByRole("region", { name: "待申请人处理的实例（1）" });
    expect(moved).toHaveTextContent("张三 → 李四");
    expect(unassigned).toHaveTextContent("抄送回执");
    expect(unassigned).toHaveTextContent("陈晨");

    for (const [region, row] of [[moved, instances[0]!], [unassigned, instances[1]!], [awaiting, instances[2]!]] as const) {
      await user.click(within(region).getByRole("button", { name: row.title }));
      const heading = await screen.findByText("审批详情");
      const detail = within(heading.closest<HTMLElement>("[role=\"dialog\"]")!);
      expect(await detail.findByText(row.title)).toBeInTheDocument();
      expect(respond).toHaveBeenCalledWith(expect.objectContaining({ action: "get_instance_detail", params: { instanceId: row.instanceId } }));
      await user.keyboard("{Escape}");
    }

    await user.click(form.getByRole("button", { name: /完\s*成/ }));
    expect(screen.queryByText("交接处理结果")).not.toBeInTheDocument();
  });
});
