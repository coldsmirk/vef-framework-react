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
    const pending = within(screen.getByRole("tabpanel", { name: /待办/ }));
    const pendingLabel = await pending.findByText("接替 张三");
    expect(pendingLabel.closest("td")).toHaveTextContent(/^审核\s*接替 张三$/);
    await user.click(screen.getByRole("tab", { name: "已办" }));
    const completed = within(screen.getByRole("tabpanel", { name: "已办" }));
    const completedLabel = await completed.findByText("接替 王五");
    expect(completedLabel.closest("td")).toHaveTextContent(/^审核\s*接替 王五$/);
  });
});
