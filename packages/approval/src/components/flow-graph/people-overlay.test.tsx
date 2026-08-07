import type { NodePerson } from "./people";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NodePeopleOverlay } from "./people-overlay";

function participant(id: string, name: string, status = "pending"): NodePerson {
  return {
    kind: "participant",
    key: `task-${id}`,
    user: { id, name },
    participant: {
      taskId: `task-${id}`,
      user: { id, name },
      status
    }
  };
}

function people(count: number): NodePerson[] {
  return Array.from({ length: count }, (_, index) => participant(`u-${index}`, `审批人${index}`));
}

describe("NodePeopleOverlay", () => {
  it("renders nothing for a node nobody has touched", () => {
    const { container } = render(<NodePeopleOverlay people={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one avatar per person while they fit", () => {
    render(<NodePeopleOverlay people={people(3)} />);

    // Avatars carry the first character of the display name.
    expect(screen.getAllByText("审")).toHaveLength(3);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("collapses the overflow into a +N avatar", () => {
    render(<NodePeopleOverlay people={people(7)} />);

    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("honors a custom visible count", () => {
    render(<NodePeopleOverlay maxCount={2} people={people(7)} />);

    expect(screen.getByText("+5")).toBeInTheDocument();
  });

  // The default antd popover would show the raw hidden avatars; the point of
  // overriding it is that the overflow stays as readable as what it replaced.
  it("names the hidden people in the overflow popover", async () => {
    const user = userEvent.setup();

    render(
      <NodePeopleOverlay
        maxCount={1}
        people={[
          participant("u-1", "梁应福", "approved"),
          participant("u-2", "胡彪", "pending")
        ]}
      />
    );

    await user.hover(screen.getByText("+1"));

    expect(await screen.findByText("胡彪")).toBeInTheDocument();
    expect(await screen.findByText("待处理")).toBeInTheDocument();
  });

  it("opens the person's own record on hover", async () => {
    const user = userEvent.setup();

    render(
      <NodePeopleOverlay people={[
        {
          kind: "participant",
          key: "task-1",
          user: {
            id: "u-1",
            name: "梁应福",
            departmentName: "研发部"
          },
          participant: {
            taskId: "task-1",
            user: { id: "u-1", name: "梁应福" },
            status: "approved",
            opinion: "已阅，同意审批",
            actionTime: "2026-08-06 16:24:19"
          }
        }
      ]}
      />
    );

    await user.hover(screen.getByText("梁"));

    expect(await screen.findByText("梁应福")).toBeInTheDocument();
    expect(await screen.findByText("研发部")).toBeInTheDocument();
    expect(await screen.findByText("已通过")).toBeInTheDocument();
    expect(await screen.findByText("已阅，同意审批")).toBeInTheDocument();
  });

  it("shows a CC recipient's read receipt", async () => {
    const user = userEvent.setup();

    render(
      <NodePeopleOverlay people={[
        {
          kind: "cc",
          key: "u-3",
          user: { id: "u-3", name: "王五" },
          recipient: { user: { id: "u-3", name: "王五" }, readAt: "2026-08-06 12:00:00" }
        }
      ]}
      />
    );

    await user.hover(screen.getByText("王"));

    expect(await screen.findByText("已读")).toBeInTheDocument();
  });

  it("shows what an activity operator did", async () => {
    const user = userEvent.setup();

    render(
      <NodePeopleOverlay people={[
        {
          kind: "operator",
          key: "u-9",
          user: { id: "u-9", name: "胡彪" },
          activity: {
            action: "submit",
            operator: { id: "u-9", name: "胡彪" },
            createdAt: "2026-08-06 10:17:41"
          }
        }
      ]}
      />
    );

    await user.hover(screen.getByText("胡"));

    expect(await screen.findByText("提交")).toBeInTheDocument();
  });
});
