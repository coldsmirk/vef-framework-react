import type { ApiRequest } from "@vef-framework-react/core";

import userEvent from "@testing-library/user-event";
import { HTTP_CLIENT } from "@vef-framework-react/core";

import { createTestApiClient, render, screen, waitFor } from "../../test-utils";
import { WorkCalendarPage } from "./work-calendar-page";

function setup(allowed: boolean) {
  const apiClient = createTestApiClient();
  const post = vi.spyOn(Object.getPrototypeOf(apiClient[HTTP_CLIENT]), "post")
    .mockImplementation((_url, options) => {
      const { data } = options as { data: ApiRequest };

      if (data.action !== "find_days") {
        return { data: null };
      }

      const month = String(data.params?.startsAt).slice(0, 7);

      return {
        data: [1, 2, 3].map(n => {
          return {
            date: `${month}-0${n}`,
            kind: "holiday",
            name: "测试假日"
          };
        })
      };
    });
  render(<WorkCalendarPage />, { apiClient, appContext: { hasPermission: code => code === "sys.calendar.manage" && allowed } });

  return post;
}

describe("WorkCalendarPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows exception names and year navigation without edit permission", async () => {
    const user = userEvent.setup();
    const post = setup(false);
    expect(await screen.findAllByText("测试假日")).toHaveLength(3);
    expect(screen.queryByLabelText("设置日期类型")).not.toBeInTheDocument();
    await user.click(screen.getByText("年视图"));
    const params = { startsAt: expect.stringMatching(/-01-01$/), endsAt: expect.stringMatching(/-12-31$/) };
    const data = expect.objectContaining({ params });
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api", expect.objectContaining({ data })));
  });

  it("saves the dragged dates in one request and restores a selected date to baseline", async () => {
    const user = userEvent.setup();
    const post = setup(true);
    const [first, , last] = await screen.findAllByRole("button", { name: /测试假日/ });
    await user.pointer([{ keys: "[MouseLeft>]", target: first }, { target: last }, { keys: "[/MouseLeft]" }]);
    expect(screen.getByText("已选 3 天")).toBeInTheDocument();
    await user.type(screen.getByLabelText("例外名称"), "春节");
    await user.click(screen.getByRole("button", { name: /保\s*存/ }));
    expect(await screen.findByText("已选 0 天")).toBeInTheDocument();
    const dates = [first, last].map(button => button!.getAttribute("aria-label")!.split(" ", 1)[0]!);
    const middle = dates[0]!.replace(/01$/, "02");
    expect(post).toHaveBeenCalledWith("/api", expect.objectContaining({
      data: expect.objectContaining({
        action: "save_overrides",
        params: {
          overrides: [
            {
              date: dates[0],
              kind: "holiday",
              name: "春节"
            },
            {
              date: middle,
              kind: "holiday",
              name: "春节"
            },
            {
              date: dates[1],
              kind: "holiday",
              name: "春节"
            }
          ]
        }
      })
    }));
    await user.click(first!);
    await user.click(screen.getByLabelText("设置日期类型"));
    await user.click(await screen.findByText("恢复基线"));
    await user.click(screen.getByRole("button", { name: /保\s*存/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api", expect.objectContaining({
      data: expect.objectContaining({
        action: "delete_overrides",
        params: { dates: [dates[0]] }
      })
    })));
  });
});
