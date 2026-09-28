import type { RollbackTarget } from "../../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReasonModal, RollbackModal } from "./action-modals";

function renderReasonModal(onConfirm: (reason: string) => Promise<void>, onClose = vi.fn()) {
  const view = render(
    <ReasonModal open okText="撤回" title="撤回" onClose={onClose} onConfirm={onConfirm} />
  );

  return { ...view, onClose };
}

describe("ReasonModal", () => {
  it("confirms with the typed reason and closes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<(reason: string) => Promise<void>>(() => Promise.resolve());
    const { onClose } = renderReasonModal(onConfirm);

    await user.type(screen.getByRole("textbox"), "流程填错了");
    await user.click(screen.getByRole("button", { name: /撤\s*回/ }));

    expect(onConfirm).toHaveBeenCalledWith("流程填错了");
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("stays open when the confirmation fails", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<(reason: string) => Promise<void>>(() => Promise.reject(new Error("rejected")));
    const { onClose } = renderReasonModal(onConfirm);

    await user.click(screen.getByRole("button", { name: /撤\s*回/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("RollbackModal", () => {
  const TARGET: RollbackTarget = { nodeId: "node-1", name: "部门审批" };

  it("preselects the only rollback target", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<(targetNodeId: string, opinion: string) => Promise<void>>(() => Promise.resolve());

    render(<RollbackModal open targets={[TARGET]} onClose={() => undefined} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: /回\s*退/ }));

    expect(onConfirm).toHaveBeenCalledWith("node-1", "");
  });

  it("waits for a choice among several targets", () => {
    render(
      <RollbackModal
        open
        targets={[TARGET, { nodeId: "node-2", name: "财务审批" }]}
        onClose={() => undefined}
        onConfirm={() => Promise.resolve()}
      />
    );

    expect(screen.getByRole("button", { name: /回\s*退/ })).toBeDisabled();
  });
});
