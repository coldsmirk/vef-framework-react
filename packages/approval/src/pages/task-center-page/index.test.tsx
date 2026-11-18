import userEvent from "@testing-library/user-event";

import { ApprovalTaskCenterPage } from ".";
import { mockApprovalApi, render, screen, within } from "../../../test-utils";

describe("ApprovalTaskCenterPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("attributes pending and completed tasks to their original seat holders", async () => {
    const user = userEvent.setup();
    const apiClient = mockApprovalApi(({ action }) => {
      if (action === "get_pending_counts") {
        return { pendingTaskCount: 1, unreadCcCount: 0 };
      }

      const pending = action === "find_pending_tasks";

      return {
        items: [
          {
            taskId: "task",
            instanceId: "instance",
            instanceNo: "A001",
            instanceTitle: pending ? "差旅申请" : "费用报销",
            applicant: { id: "applicant", name: "陈晨" },
            nodeName: "审核",
            predecessor: { id: "former", name: pending ? "张三" : "王五" },
            status: pending ? "pending" : "approved"
          }
        ],
        total: 1
      };
    });

    render(<ApprovalTaskCenterPage />, { apiClient });
    expect(await within(screen.getByRole("tabpanel", { name: /待办/ })).findByText("接替 张三")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "已办" }));
    expect(await within(screen.getByRole("tabpanel", { name: "已办" })).findByText("接替 王五")).toBeInTheDocument();
  });
});
