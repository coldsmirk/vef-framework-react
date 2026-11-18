import type { RollbackTarget } from "../../types";

import userEvent from "@testing-library/user-event";
import { BusinessError } from "@vef-framework-react/core";

import { render, screen, waitFor } from "../../../test-utils";
import { AddAssigneeModal, CCModal, ReasonModal, RollbackModal, TransferModal } from "./action-modals";

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

describe("handed-over user selections", () => {
  const moved = "张三已交接审批工作，接手人为李四";
  const unassigned = "该用户已不再承接审批工作";

  it("keeps the transfer opinion and asks for a new selection", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockRejectedValueOnce(new BusinessError(40_028, moved)).mockResolvedValue(undefined);
    const close = vi.fn();
    render(<TransferModal open onClose={close} onConfirm={confirm} />);

    const picker = screen.getByRole("combobox");
    await user.type(picker, "former{Enter}");
    await user.type(screen.getByRole("textbox"), "请协助审核");
    const submit = screen.getByRole("button", { name: /转\s*办/ });
    await user.click(submit);
    expect(await screen.findByText(moved)).toBeVisible();
    expect(submit).toBeDisabled();
    expect(close).not.toHaveBeenCalled();

    await user.type(picker, "next{Enter}");
    expect(screen.queryByText(moved)).not.toBeInTheDocument();
    await user.click(submit);
    expect(confirm).toHaveBeenLastCalledWith("next", "请协助审核");
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("keeps temporary failures visible and allows retry with the same person", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const confirm = vi.fn().mockRejectedValueOnce(new Error("网络暂不可用")).mockResolvedValue(undefined);
    render(<TransferModal open onClose={close} onConfirm={confirm} />);
    await user.type(screen.getByRole("combobox"), "former{Enter}");
    const submit = screen.getByRole("button", { name: /转\s*办/ });
    await user.click(submit);
    expect(await screen.findByText("网络暂不可用")).toBeVisible();
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("shows the server's no-successor reason in the add-assignee picker", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockRejectedValue(new BusinessError(40_028, unassigned));
    render(<AddAssigneeModal open allowedTypes={["parallel"]} onClose={vi.fn()} onConfirm={confirm} />);

    await user.type(screen.getByRole("combobox"), "former{Enter}");
    await user.click(screen.getByRole("button", { name: /加\s*签/ }));
    expect(await screen.findByText(unassigned)).toBeVisible();
  });

  it("shows the server's successor in the manual CC picker", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockRejectedValue(new BusinessError(40_028, moved));
    render(<CCModal open onClose={vi.fn()} onConfirm={confirm} />);

    await user.type(screen.getByRole("combobox"), "former{Enter}");
    await user.click(screen.getByRole("button", { name: /抄\s*送/ }));
    expect(await screen.findByText(moved)).toBeVisible();
  });
});
