import type { ApiRequest } from "@vef-framework-react/core";

import userEvent from "@testing-library/user-event";
import { BusinessError, HTTP_CLIENT } from "@vef-framework-react/core";

import { ApprovalInitiatePage } from ".";
import { createTestApiClient, render, screen, waitFor } from "../../../test-utils";

const now = new Date(2026, 10, 18, 10).getTime();
const interval = { startsAtUnixMs: now - 1000, endsAtUnixMs: now + 29 * 60_000 };
const base = {
  categoryId: "one",
  categoryName: "常用",
  flowCode: "leave",
  flowName: "请假",
  flowId: "1"
};
const open = { ...base, initiationWindow: { open: true, current: interval } };
const closed = {
  ...base,
  flowId: "2",
  flowCode: "expenses",
  flowName: "报销",
  initiationWindow: { open: false }
};
const unrestricted = {
  ...base,
  flowId: "3",
  flowCode: "trip",
  flowName: "出差"
};
const startForm = {
  ...base,
  version: 1,
  applicant: {},
  initiationWindow: open.initiationWindow
};
const reason = "发起时段已关闭，近期无开放时段";

function setup(failAction?: "get_start_form" | "start", current: { startsAtUnixMs?: number; endsAtUnixMs?: number } = interval) {
  const apiClient = createTestApiClient();
  vi.spyOn(Date, "now").mockReturnValue(now);
  const post = vi.spyOn(Object.getPrototypeOf(apiClient[HTTP_CLIENT]), "post")
    .mockImplementation((_url, options) => {
      const { action } = (options as { data: ApiRequest }).data;

      if (action === failAction) {
        throw new BusinessError(40_027, reason);
      }

      if (action === "find_available_flows") {
        return { data: { items: [open, closed, unrestricted], total: 3 } };
      }

      return { data: { ...startForm, initiationWindow: { open: true, current } } };
    });
  render(<ApprovalInitiatePage />, { apiClient });

  return post;
}

describe("ApprovalInitiatePage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps closed flows visible and prevents starting them", async () => {
    const user = userEvent.setup();
    const post = setup();
    const card = await screen.findByRole("button", { name: "报销" });
    expect(card).toBeDisabled();
    expect(screen.getByText("近期不开放")).toBeInTheDocument();
    await user.click(card);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "出差" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "请假" })).toBeEnabled();
  });

  it("shows the impending deadline and returns to the list if the window closes at submission", async () => {
    const user = userEvent.setup();
    setup("start");
    await user.click(await screen.findByRole("button", { name: "请假" }));
    expect(await screen.findByText(/发起时段将于.*10:29.*截止/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "提交审批" }));
    expect(await screen.findByText(reason)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it.each([
    [{ startsAtUnixMs: interval.startsAtUnixMs }, "长期开放"],
    [{}, "此前已开放 · 长期开放"]
  ] as const)("explains open-ended windows without a deadline warning (%j)", async (current, message) => {
    const user = userEvent.setup();
    setup(undefined, current);
    await user.click(await screen.findByRole("button", { name: "请假" }));
    expect(await screen.findByRole("button", { name: "提交审批" })).toBeEnabled();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/发起时段将于/)).not.toBeInTheDocument();
  });

  it("describes an unbounded start alongside a finite deadline", async () => {
    const user = userEvent.setup();
    setup(undefined, { endsAtUnixMs: interval.endsAtUnixMs });
    await user.click(await screen.findByRole("button", { name: "请假" }));
    expect(await screen.findByText(/此前已开放，发起时段将于.*10:29.*截止/)).toBeInTheDocument();
  });

  it("explains a closed window when form loading races the list", async () => {
    const user = userEvent.setup();
    setup("get_start_form");
    await user.click(await screen.findByRole("button", { name: "请假" }));
    expect(await screen.findByText(reason)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
