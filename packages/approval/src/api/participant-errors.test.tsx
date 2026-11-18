import { HTTP_CLIENT } from "@vef-framework-react/core";

import { mockApprovalApi, renderHook } from "../../test-utils";
import { useInstanceApi } from "./instance-api";

describe("participant action error reporting", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lets the picker own transfer, add-assignee and CC errors while preserving other task error messages", async () => {
    const apiClient = mockApprovalApi(() => null);
    const { result } = renderHook(() => useInstanceApi({ inlineUserErrors: true }), { apiClient });
    await apiClient.executeMutation({
      mutationFn: result.current.processTask,
      params: {
        taskId: "t",
        action: "transfer",
        transferToId: "user"
      }
    });
    await apiClient.executeMutation({
      mutationFn: result.current.addAssignee,
      params: {
        taskId: "t",
        userIds: ["user"],
        addType: "after"
      }
    });
    await apiClient.executeMutation({ mutationFn: result.current.addCC, params: { instanceId: "i", ccUserIds: ["user"] } });
    await apiClient.executeMutation({ mutationFn: result.current.processTask, params: { taskId: "t", action: "approve" } });
    const { post } = Object.getPrototypeOf(apiClient[HTTP_CLIENT]);

    for (const [index, action] of ["process_task", "add_assignee", "add_cc"].entries()) {
      expect(post).toHaveBeenNthCalledWith(index + 1, "/api", expect.objectContaining({ skipErrorMessage: true, data: expect.objectContaining({ action }) }));
    }

    expect(post).toHaveBeenNthCalledWith(4, "/api", expect.not.objectContaining({ skipErrorMessage: true }));
  });

  it("keeps global messages for API consumers using the default options", async () => {
    const apiClient = mockApprovalApi(() => null);
    const { result } = renderHook(() => useInstanceApi(), { apiClient });
    await apiClient.executeMutation({
      mutationFn: result.current.processTask,
      params: {
        taskId: "t",
        action: "transfer",
        transferToId: "user"
      }
    });
    expect(Object.getPrototypeOf(apiClient[HTTP_CLIENT]).post).toHaveBeenCalledWith("/api", expect.not.objectContaining({ skipErrorMessage: true }));
  });
});
