import userEvent from "@testing-library/user-event";
import { BusinessError, HTTP_CLIENT } from "@vef-framework-react/core";

import { mockApprovalApi, render, screen, within } from "../../../test-utils";
import { TasksPanel } from "./tasks";

describe("TasksPanel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows who the assignee took over from in the same table cell", async () => {
    const apiClient = mockApprovalApi(() => {
      return {
        items: [
          {
            taskId: "task",
            instanceTitle: "",
            assignee: { id: "new", name: "李四" },
            instanceNo: "BX-2026-016",
            predecessor: { id: "old", name: "张三" },
            status: "pending"
          }
        ],
        total: 1
      };
    });
    render(<TasksPanel reassignPermission="approval.task.reassign" />, { apiClient });

    const cell = await screen.findByRole("cell", { name: /李四.*接替 张三/ });
    expect(screen.getByText("BX-2026-016")).toBeVisible();
    expect(within(cell).getByText("李四")).toBeVisible();
    expect(within(cell).getByText("接替 张三")).toBeVisible();
  });

  it("explains a handed-over target in the reassign picker", async () => {
    const user = userEvent.setup();
    const reason = "张三已交接审批工作，接手人为李四";
    const apiClient = mockApprovalApi(({ action }) => {
      if (action === "reassign_task") {
        throw new BusinessError(40_028, reason);
      }

      return {
        items: [
          {
            taskId: "task",
            instanceTitle: "差旅申请",
            assignee: { id: "a", name: "陈晨" },
            status: "pending"
          }
        ],
        total: 1
      };
    });
    render(<TasksPanel reassignPermission="approval.task.reassign" />, { apiClient });
    await user.click(await screen.findByRole("button", { name: /改\s*派/ }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("改派任务")).toBeInTheDocument();
    await user.type(dialog.getByRole("combobox"), "former{Enter}");
    await user.click(dialog.getByRole("button", { name: /改\s*派/ }));
    expect(await dialog.findByText(reason)).toBeVisible();
    expect(Object.getPrototypeOf(apiClient[HTTP_CLIENT]).post).toHaveBeenCalledWith("/api", expect.objectContaining({ skipErrorMessage: true, data: expect.objectContaining({ action: "reassign_task" }) }));
  });
});
