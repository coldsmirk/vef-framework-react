import type { FlowGraphNodeData } from "../../types";

import { collectNodePeople, personTone } from "./people";

function nodeData(overrides: Partial<FlowGraphNodeData> = {}): FlowGraphNodeData {
  return {
    name: "审批节点",
    status: "active",
    ...overrides
  };
}

describe("collectNodePeople", () => {
  it("returns nothing for a node nobody has touched", () => {
    expect(collectNodePeople(nodeData({ status: "pending" }))).toEqual([]);
  });

  it("maps assignees in the order the backend recorded them", () => {
    const people = collectNodePeople(nodeData({
      participants: [
        {
          taskId: "t-1",
          user: { id: "u-1", name: "梁应福" },
          status: "approved"
        },
        {
          taskId: "t-2",
          user: { id: "u-2", name: "胡彪" },
          status: "pending"
        }
      ]
    }));

    expect(people.map(person => person.key)).toEqual(["t-1", "t-2"]);
    expect(people.map(person => person.user.name)).toEqual(["梁应福", "胡彪"]);
    expect(people.every(person => person.kind === "participant")).toBe(true);
  });

  it("keys assignees by task so one person holding two tasks is two avatars", () => {
    const people = collectNodePeople(nodeData({
      participants: [
        {
          taskId: "t-1",
          user: { id: "u-1", name: "胡彪" },
          status: "approved"
        },
        {
          taskId: "t-2",
          user: { id: "u-1", name: "胡彪" },
          status: "pending"
        }
      ]
    }));

    expect(people.map(person => person.key)).toEqual(["t-1", "t-2"]);
  });

  it("falls back to CC recipients for a node that only notified", () => {
    const people = collectNodePeople(nodeData({
      ccRecipients: [{ user: { id: "u-3", name: "王五" }, readAt: "2026-08-06 12:00:00" }]
    }));

    expect(people).toHaveLength(1);
    expect(people[0]?.kind).toBe("cc");
    expect(people[0]?.key).toBe("u-3");
  });

  // A submit is an activity, never a task, so the applicant only reaches the
  // start node through this fallback.
  it("falls back to activity operators, which is what surfaces the submitter", () => {
    const people = collectNodePeople(nodeData({
      status: "passed",
      activities: [
        {
          action: "submit",
          operator: {
            id: "u-9",
            name: "胡彪",
            departmentName: "研发部"
          },
          createdAt: "2026-08-06 10:17:41"
        }
      ]
    }));

    expect(people).toHaveLength(1);
    expect(people[0]?.kind).toBe("operator");
    expect(people[0]?.user.name).toBe("胡彪");
  });

  it("collapses an operator's repeat actions into one avatar, keeping the first", () => {
    const people = collectNodePeople(nodeData({
      activities: [
        {
          action: "urge",
          operator: { id: "u-9", name: "胡彪" },
          createdAt: "2026-08-06 10:00:00"
        },
        {
          action: "add_cc",
          operator: { id: "u-9", name: "胡彪" },
          createdAt: "2026-08-06 11:00:00"
        },
        {
          action: "urge",
          operator: { id: "u-8", name: "王五" },
          createdAt: "2026-08-06 12:00:00"
        }
      ]
    }));

    expect(people.map(person => person.key)).toEqual(["u-9", "u-8"]);
    expect(people[0]?.kind === "operator" && people[0].activity.action).toBe("urge");
  });

  // Exactly one source per node — otherwise an approver who also urged would
  // be drawn twice above the same card.
  it("prefers assignees over both other sources", () => {
    const people = collectNodePeople(nodeData({
      participants: [
        {
          taskId: "t-1",
          user: { id: "u-1", name: "梁应福" },
          status: "pending"
        }
      ],
      ccRecipients: [{ user: { id: "u-3", name: "王五" } }],
      activities: [
        {
          action: "urge",
          operator: { id: "u-1", name: "梁应福" },
          createdAt: "2026-08-06 10:00:00"
        }
      ]
    }));

    expect(people).toHaveLength(1);
    expect(people[0]?.kind).toBe("participant");
  });
});

describe("personTone", () => {
  it.each([
    ["approved", "success"],
    ["handled", "success"],
    ["pending", "processing"],
    ["rejected", "error"],
    ["rolled_back", "warning"],
    ["waiting", "default"],
    ["skipped", "default"]
  ])("tones a %s assignee as %s", (status, expected) => {
    const [person] = collectNodePeople(nodeData({
      participants: [
        {
          taskId: "t-1",
          user: { id: "u-1", name: "梁应福" },
          status
        }
      ]
    }));

    expect(person && personTone(person)).toBe(expected);
  });

  // The field arrives untyped, so an unrecognized value must read as "no
  // outcome known" rather than borrowing one.
  it("tones an unrecognized assignee status neutrally", () => {
    const [person] = collectNodePeople(nodeData({
      participants: [
        {
          taskId: "t-1",
          user: { id: "u-1", name: "梁应福" },
          status: "invented_by_a_future_backend"
        }
      ]
    }));

    expect(person && personTone(person)).toBe("default");
  });

  it("tones a CC recipient by their read receipt", () => {
    const [unread] = collectNodePeople(nodeData({
      ccRecipients: [{ user: { id: "u-3", name: "王五" } }]
    }));
    const [read] = collectNodePeople(nodeData({
      ccRecipients: [{ user: { id: "u-3", name: "王五" }, readAt: "2026-08-06 12:00:00" }]
    }));

    expect(unread && personTone(unread)).toBe("default");
    expect(read && personTone(read)).toBe("success");
  });
});
