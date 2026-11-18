import type { ApiRequest } from "@vef-framework-react/core";
import type { Ref } from "react";

import type { BusinessFormHandle } from "../plugins";
import type { MyInstanceDetail } from "../types";

import userEvent from "@testing-library/user-event";
import { useImperativeHandle, useState } from "react";

import { mockApprovalApi, render, screen, waitFor, within } from "../../test-utils";
import { StartInstanceDrawer } from "../pages/initiate-page/start-drawer";
import { ApprovalProvider } from "../plugins";
import { InstanceDetailPanel } from "./detail";

function Panel({ handle }: { handle: Ref<BusinessFormHandle> }) {
  const [value, setValue] = useState("");
  useImperativeHandle(handle, () => {
    return {
      collect() {
        if (!value) {
          return Promise.reject(new Error("请填写会议主题"));
        }

        return Promise.resolve({ subject: value });
      }
    };
  }, [value]);
  return <input aria-label="会议主题" value={value} onChange={event => setValue(event.target.value)} />;
}

const detail: MyInstanceDetail = {
  instance: {
    instanceId: "i",
    instanceNo: "2026-01",
    title: "会议申请",
    flowName: "会议审批",
    flowId: "f",
    flowCode: "meeting",
    businessKind: "meeting",
    applicant: { id: "u", name: "张三" },
    status: "running",
    createdAt: "2026-01-01"
  },
  businessView: { room: "会议室" },
  myTask: {
    nodeId: "node",
    taskId: "task",
    isOpinionRequired: false,
    rollbackTargets: [{ nodeId: "start", name: "申请人" }]
  },
  availableActions: ["approve", "transfer", "rollback"],
  flowGraph: { nodes: [], edges: [] },
  timeline: []
};

function setup(start: boolean, registered = true, view = detail) {
  const writes: ApiRequest[] = [];
  const apiClient = mockApprovalApi(request => {
    if (request.action === "get_start_form") {
      return {
        businessKind: "meeting",
        flowName: "会议审批",
        applicant: view.instance.applicant,
        version: 1
      };
    }

    if (request.action === "get_instance_detail") {
      return view;
    }

    writes.push(request);
  });
  const renderer = { StartForm: Panel, DetailView: Panel };
  render(
    <ApprovalProvider plugins={{ businessKinds: registered ? { meeting: renderer } : {} }}>
      {start ? <StartInstanceDrawer businessRef="booking" flowCode="meeting" onClose={vi.fn()} /> : <InstanceDetailPanel instanceId="i" />}
    </ApprovalProvider>,
    { apiClient }
  );
  return writes;
}

describe("business form submissions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("validates locally before starting with a single write", async () => {
    const user = userEvent.setup();
    const writes = setup(true);
    const submit = await screen.findByRole("button", { name: "提交审批" });
    await user.click(submit);
    expect(writes).toHaveLength(0);
    await user.type(screen.getByLabelText("会议主题"), "预算");
    await user.click(submit);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      resource: "approval/instance",
      action: "start",
      params: {
        flowCode: "meeting",
        businessRef: "booking",
        formData: { subject: "预算" }
      }
    });
  });

  it("sends business edits in the decision request", async () => {
    const user = userEvent.setup();
    const writes = setup(false);
    await user.type(await screen.findByLabelText("会议主题"), "决算");
    await user.click(screen.getByRole("button", { name: /通\s*过/ }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      action: "process_task",
      params: {
        taskId: "task",
        action: "approve",
        formData: { subject: "决算" }
      }
    });
  });

  it("collects the same panel for a rollback dialog", async () => {
    const user = userEvent.setup();
    const writes = setup(false);
    await user.type(await screen.findByLabelText("会议主题"), "预算修订");
    await user.click(screen.getByRole("button", { name: /回\s*退/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /回\s*退/ }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      action: "process_task",
      params: {
        action: "rollback",
        targetNodeId: "start",
        formData: { subject: "预算修订" }
      }
    });
  });

  it("disables submission for an unregistered start form", async () => {
    setup(true, false);
    expect(await screen.findByText("该业务类型未在本应用注册")).toBeVisible();
    expect(screen.getByRole("button", { name: "提交审批" })).toBeDisabled();
    expect(screen.queryByText("该流程未配置表单")).not.toBeInTheDocument();
  });

  it("disables decisions and dialogs for an unregistered detail", async () => {
    setup(false, false);
    expect(await screen.findByText("该业务类型未在本应用注册")).toBeVisible();
    expect(screen.getByRole("button", { name: /通\s*过/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /转\s*办/ })).toBeDisabled();
  });
});
