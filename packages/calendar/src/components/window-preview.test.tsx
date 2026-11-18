import { HTTP_CLIENT } from "@vef-framework-react/core";

import { createTestApiClient, render, screen } from "../../test-utils";
import { WindowPreview } from "./window-preview";

function rpc(action: string, params: object) {
  return expect.objectContaining({
    data: {
      resource: "sys/calendar",
      action,
      version: "v1",
      params
    }
  });
}

describe("WindowPreview", () => {
  afterEach(() => vi.restoreAllMocks());

  it("annotates server intervals with holidays through their last included date", async () => {
    const apiClient = createTestApiClient();
    const rule = { timezone: "Asia/Shanghai", windows: [{}] };
    const interval = { startsAtUnixMs: Date.parse("2026-09-30T20:00:00+08:00"), endsAtUnixMs: Date.parse("2026-10-02T00:00:00+08:00") };
    const post = vi.spyOn(Object.getPrototypeOf(apiClient[HTTP_CLIENT]), "post")
      .mockResolvedValueOnce({ data: { status: { open: false }, windows: [interval] } })
      .mockResolvedValueOnce({
        data: [
          {
            date: "2026-10-01",
            kind: "holiday",
            name: "国庆节"
          }
        ]
      });

    render(<WindowPreview from={1000} limit={3} rule={rule} />, { apiClient });
    expect(await screen.findByText("国庆节")).toBeInTheDocument();

    expect(post).toHaveBeenCalledWith("/api", rpc("preview_windows", {
      rule,
      from: 1000,
      limit: 3
    }));
    expect(post).toHaveBeenCalledWith("/api", rpc("find_days", { startsAt: "2026-09-30", endsAt: "2026-10-01" }));
  });

  it("labels missing bounds without formatting fallback timestamps as endpoints", async () => {
    const apiClient = createTestApiClient();
    const instant = Date.UTC(2026, 0, 2, 9);
    const post = vi.spyOn(Object.getPrototypeOf(apiClient[HTTP_CLIENT]), "post");
    post.mockResolvedValue({ data: [] });
    const rule = { timezone: "UTC", windows: [{}] };
    const windows = [{ endsAtUnixMs: instant }, { startsAtUnixMs: instant + 60_000 }];
    post.mockResolvedValueOnce({ data: { status: { open: true }, windows } });
    const { rerender } = render(<WindowPreview from={instant - 3_600_000} rule={rule} />, { apiClient });
    expect(await screen.findByText(/此前已开放 · .*09:00/)).toBeInTheDocument();
    expect(screen.getByText(/09:01 · 长期开放/)).toBeInTheDocument();
    post.mockResolvedValueOnce({ data: { status: { open: true }, windows: [{}] } });
    rerender(<WindowPreview from={instant} rule={rule} />);
    expect(await screen.findByText("此前已开放 · 长期开放")).toBeInTheDocument();
  });

  it("displays the server validation reason", async () => {
    const apiClient = createTestApiClient();
    vi.spyOn(Object.getPrototypeOf(apiClient[HTTP_CLIENT]), "post").mockRejectedValue(new Error("开始与结束时间不能相同"));
    render(<WindowPreview rule={{ windows: [{}] }} />, { apiClient });
    expect(await screen.findByText("开始与结束时间不能相同")).toBeInTheDocument();
  });
});
