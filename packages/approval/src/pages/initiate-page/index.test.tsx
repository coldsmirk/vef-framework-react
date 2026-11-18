import type { ApiRequest } from "@vef-framework-react/core";

import userEvent from "@testing-library/user-event";
import { BusinessError, HTTP_CLIENT } from "@vef-framework-react/core";

import { ApprovalInitiatePage } from ".";
import { act, createTestApiClient, render, screen, waitFor, within } from "../../../test-utils";

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
  vi.setSystemTime(now);
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
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it("describes a window with no closing time", async () => {
    const user = userEvent.setup();
    setup(undefined, { startsAtUnixMs: interval.startsAtUnixMs });
    await user.click(await screen.findByRole("button", { name: "请假" }));
    expect(await screen.findByRole("button", { name: "提交审批" })).toBeEnabled();
    expect(screen.getByText("长期开放")).toBeInTheDocument();
    expect(screen.queryByText(/发起时段将于/)).not.toBeInTheDocument();
  });

  it("describes a window with neither boundary", async () => {
    const user = userEvent.setup();
    setup(undefined, {});
    await user.click(await screen.findByRole("button", { name: "请假" }));
    expect(await screen.findByText("此前已开放 · 长期开放")).toBeInTheDocument();
    expect(screen.queryByText(/发起时段将于/)).not.toBeInTheDocument();
  });

  it("replaces the impending warning at the deadline while the drawer stays open", async () => {
    const deadline = now + 5000;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup(undefined, { endsAtUnixMs: deadline });
    await user.click(await screen.findByRole("button", { name: "请假" }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText(/此前已开放，发起时段将于/)).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(deadline - Date.now()));
    expect(drawer.getByRole("alert")).toHaveTextContent("本次发起时段已截止");
    expect(drawer.queryByText(/此前已开放/)).not.toBeInTheDocument();
  });

  it("shows a closed window when both bounds precede the current time", async () => {
    const user = userEvent.setup();
    setup(undefined, { startsAtUnixMs: now - 1000, endsAtUnixMs: now - 1 });
    await user.click(await screen.findByRole("button", { name: "请假" }));
    expect(await screen.findByText("本次发起时段已截止")).toBeVisible();
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
