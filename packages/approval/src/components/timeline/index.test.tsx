import type { TimelineEntry } from "../../types";

import { render, screen } from "@testing-library/react";

import { InstanceTimeline } from "./index";

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    kind: "approval",
    name: "审批节点",
    status: "passed",
    startedAt: "2026-07-28 10:37:53",
    ...overrides
  };
}

describe("InstanceTimeline", () => {
  it("renders an empty state when there are no entries", () => {
    render(<InstanceTimeline timeline={[]} />);

    expect(screen.getByText("暂无流转记录")).toBeInTheDocument();
  });

  it("renders the end entry with the node name as its title", () => {
    render(
      <InstanceTimeline timeline={[
        entry({
          kind: "end",
          name: "结束",
          finishedAt: "2026-07-28 10:38:08"
        })
      ]}
      />
    );

    expect(screen.getByText("结束")).toBeInTheDocument();
  });

  describe("when an entry spans two display times", () => {
    it("renders both ends of the span", () => {
      render(<InstanceTimeline timeline={[entry({ finishedAt: "2026-07-28 11:05:01" })]} />);

      expect(screen.getByText("2026-07-28 10:37 → 2026-07-28 11:05")).toBeInTheDocument();
    });
  });

  describe("when an entry opens and closes at the same moment", () => {
    it("renders a single timestamp instead of an identical span", () => {
      render(
        <InstanceTimeline timeline={[
          entry({
            kind: "end",
            name: "结束",
            startedAt: "2026-07-28 10:38:08",
            finishedAt: "2026-07-28 10:38:08"
          })
        ]}
        />
      );

      expect(screen.getByText("2026-07-28 10:38")).toBeInTheDocument();
      expect(screen.queryByText("2026-07-28 10:38 → 2026-07-28 10:38")).not.toBeInTheDocument();
    });

    // The display resolves to the minute, so seconds that differ inside one
    // minute still render as one timestamp — collapsing on the raw values
    // would leave this case reading as "10:37 → 10:37".
    it("collapses a span whose ends differ only in seconds", () => {
      render(<InstanceTimeline timeline={[entry({ startedAt: "2026-07-28 10:37:01", finishedAt: "2026-07-28 10:37:59" })]} />);

      expect(screen.getByText("2026-07-28 10:37")).toBeInTheDocument();
      expect(screen.queryByText("2026-07-28 10:37 → 2026-07-28 10:37")).not.toBeInTheDocument();
    });
  });

  describe("when an entry is still open", () => {
    it("renders only the start time", () => {
      render(<InstanceTimeline timeline={[entry({ status: "active" })]} />);

      expect(screen.getByText("2026-07-28 10:37")).toBeInTheDocument();
    });
  });
});
