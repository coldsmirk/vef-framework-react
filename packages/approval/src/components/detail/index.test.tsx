import type { ApiRequest } from "@vef-framework-react/core";
import type { FormSchema } from "@vef-framework-react/form-editor";

import userEvent from "@testing-library/user-event";

import { mockApprovalApi, render, screen, waitFor } from "../../../test-utils";
import { ApprovalProvider } from "../../plugins";
import { InstanceDetailPanel } from "./index";

const LOOKUP_SCHEMA: FormSchema = {
  id: "Form_detail_lookup",
  version: 2,
  presentations: {
    pc: {
      children: [
        {
          id: "Field_empCode",
          type: "textfield",
          key: "empCode",
          label: "工号",
          linkage: {
            rules: [
              {
                id: "Rule_lookup",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: {
                      resource: "hr/staff",
                      action: "find",
                      params: { code: { kind: "reference", path: "$form.empCode" } }
                    },
                    output: "staff"
                  },
                  {
                    type: "set_fields",
                    assignments: [
                      {
                        targetKey: "staffName",
                        value: { kind: "reference", path: "$steps.staff.name" }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        },
        {
          id: "Field_staffName",
          type: "textfield",
          key: "staffName",
          label: "姓名"
        },
        {
          id: "Field_remark",
          type: "textfield",
          key: "remark",
          label: "说明",
          validate: { required: true }
        }
      ]
    }
  }
};

function setupDetail(requestService: (req: unknown) => Promise<unknown>) {
  const processCalls: ApiRequest[] = [];
  const client = mockApprovalApi(req => {
    if (req.action === "process_task") {
      processCalls.push(req);
      return null;
    }

    return {
      instance: {
        instanceId: "inst-1",
        instanceNo: "APV-001",
        title: "职员审批",
        flowName: "职员变更",
        flowCode: "staff-change",
        flowId: "flow-1",
        applicant: { id: "u-1", name: "周宁" },
        status: "running",
        createdAt: "2026-11-24",
        formData: {
          empCode: "",
          staffName: "",
          remark: ""
        }
      },
      formSchema: LOOKUP_SCHEMA,
      myTask: {
        taskId: "task-1",
        isOpinionRequired: false
      },
      availableActions: ["approve", "reject"],
      annotations: [],
      flowGraph: { nodes: [], edges: [] },
      timeline: []
    };
  });

  render(
    <ApprovalProvider plugins={{ services: { request: requestService } }}>
      <InstanceDetailPanel instanceId="inst-1" />
    </ApprovalProvider>,
    { apiClient: client }
  );

  return processCalls;
}

describe("InstanceDetailPanel pending form sequences", () => {
  it("waits for an in-flight lookup backfill before approving and submits the backfilled formData", async () => {
    const user = userEvent.setup();
    const deferred = Promise.withResolvers<unknown>();
    const requestService = vi.fn(() => deferred.promise);
    const processCalls = setupDetail(requestService);

    const codeInput = await screen.findByRole("textbox", { name: "工号" });
    await user.type(screen.getByRole("textbox", { name: "说明" }), "核对通过");
    await user.type(codeInput, "E001{Enter}");

    expect(requestService).toHaveBeenCalledTimes(1);

    // Click approve while the lookup request is still pending.
    await user.click(screen.getByRole("button", { name: /通\s*过/ }));
    await Promise.resolve();
    expect(processCalls).toHaveLength(0);

    deferred.resolve({ name: "Ada Lovelace" });

    await waitFor(() => {
      expect(processCalls).toHaveLength(1);
    });
    expect(processCalls[0]).toMatchObject({
      action: "process_task",
      params: {
        taskId: "task-1",
        action: "approve",
        formData: {
          empCode: "E001",
          staffName: "Ada Lovelace",
          remark: "核对通过"
        }
      }
    });
  });

  it("waits for an in-flight lookup backfill before rejecting while still bypassing required-field validation", async () => {
    const user = userEvent.setup();
    const deferred = Promise.withResolvers<unknown>();
    const requestService = vi.fn(() => deferred.promise);
    const processCalls = setupDetail(requestService);

    const codeInput = await screen.findByRole("textbox", { name: "工号" });
    // Leave required "说明" empty to confirm reject still bypasses required checks.
    await user.type(codeInput, "E002{Enter}");

    expect(requestService).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /拒\s*绝/ }));
    await Promise.resolve();
    expect(processCalls).toHaveLength(0);

    deferred.resolve({ name: "Grace Hopper" });

    await waitFor(() => {
      expect(processCalls).toHaveLength(1);
    });
    expect(processCalls[0]).toMatchObject({
      action: "process_task",
      params: {
        taskId: "task-1",
        action: "reject",
        formData: {
          empCode: "E002",
          staffName: "Grace Hopper",
          remark: ""
        }
      }
    });
  });
});
