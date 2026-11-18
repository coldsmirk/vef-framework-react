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
            instanceTitle: "差旅申请",
            assignee: { id: "new", name: "李四" },
            predecessor: { id: "old", name: "张三" },
            status: "pending"
          }
        ],
        total: 1
      };
    });
    render(<TasksPanel reassignPermission="approval.task.reassign" />, { apiClient });

    const cell = await screen.findByRole("cell", { name: /李四.*接替 张三/ });
    expect(within(cell).getByText("李四")).toBeVisible();
    expect(within(cell).getByText("接替 张三")).toBeVisible();
  });
});
