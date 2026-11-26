import type { ReactElement } from "react";

import type { DraftSessionJumpConfig } from "./use-draft-session";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDraftSession } from "./use-draft-session";

interface Item {
  id: string;
  label: string;
}

interface Extra {
  index: number;
  focusStep?: number;
}

interface JumpToken {
  targetIndex: number;
  focusStep?: number;
}

const ITEMS: Item[] = [
  { id: "item_1", label: "第一项" },
  { id: "item_2", label: "第二项" }
];

function Harness({
  initialJump = null,
  onClearJump
}: {
  initialJump?: JumpToken | null;
  onClearJump?: () => void;
}): ReactElement {
  const [pending, setPending] = useState<JumpToken | null>(initialJump);
  const jump: DraftSessionJumpConfig<Item, JumpToken, Extra> = {
    pending,
    clear: () => {
      onClearJump?.();
      setPending(null);
    },
    resolve: token => {
      const entry = ITEMS[token.targetIndex];

      return entry === undefined
        ? undefined
        : {
            entry,
            extra: { index: token.targetIndex + 1, focusStep: token.focusStep }
          };
    }
  };
  const {
    close,
    closeIfEditing,
    editingId,
    handleAfterClose,
    openCreate,
    openEdit,
    registerRow,
    session
  } = useDraftSession<Item, JumpToken, Extra>({ jump });

  return (
    <div>
      <span data-testid="editing-id">{editingId ?? "none"}</span>
      <span data-testid="session-key">{session?.key ?? "none"}</span>
      <span data-testid="session-state">{session === null ? "unmounted" : `${session.mode}:${session.open ? "open" : "closing"}:${session.initial.label}:${session.extra.index}:${session.extra.focusStep ?? "none"}`}</span>

      {ITEMS.map((item, index) => (
        <div
          key={item.id}
          ref={node => registerRow(item.id, node)}
          data-testid={`row-${item.id}`}
        >
          <button type="button" onClick={() => openEdit(item, { index: index + 1 })}>{`编辑 ${item.label}`}</button>
          <button type="button" onClick={() => closeIfEditing(item.id)}>{`删除 ${item.label}`}</button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => openCreate({ id: "tpl_1", label: "模板项" }, { index: 0 })}
      >
        模板新建
      </button>

      <button type="button" onClick={close}>关闭</button>
      <button type="button" onClick={handleAfterClose}>动画结束</button>

      <button
        type="button"
        onClick={() => setPending({ targetIndex: 1, focusStep: 2 })}
      >
        触发跳转
      </button>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDraftSession", () => {
  it("opens caller-supplied create drafts, tracks editingId, and retains mounted session through close transition", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    expect(screen.getByTestId("editing-id")).toHaveTextContent("none");
    expect(screen.getByTestId("session-state")).toHaveTextContent("unmounted");

    // Caller-supplied initial value (template creation) does not mark any row as editingId.
    await user.click(screen.getByRole("button", { name: "模板新建" }));
    expect(screen.getByTestId("editing-id")).toHaveTextContent("none");
    expect(screen.getByTestId("session-key")).toHaveTextContent("1");
    expect(screen.getByTestId("session-state")).toHaveTextContent("create:open:模板项:0:none");

    // Close starts transition (still mounted with open=false) until handleAfterClose unmounts it.
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.getByTestId("session-state")).toHaveTextContent("create:closing:模板项:0:none");
    await user.click(screen.getByRole("button", { name: "动画结束" }));
    expect(screen.getByTestId("session-state")).toHaveTextContent("unmounted");

    // Editing sets editingId and keeps a reopened session alive if a stale afterClose fires.
    await user.click(screen.getByRole("button", { name: "编辑 第一项" }));
    expect(screen.getByTestId("editing-id")).toHaveTextContent("item_1");
    expect(screen.getByTestId("session-key")).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.getByTestId("editing-id")).toHaveTextContent("none");
    await user.click(screen.getByRole("button", { name: "编辑 第二项" }));
    expect(screen.getByTestId("session-key")).toHaveTextContent("3");
    await user.click(screen.getByRole("button", { name: "动画结束" }));
    expect(screen.getByTestId("editing-id")).toHaveTextContent("item_2");

    // closeIfEditing closes only when deleting the actively edited item.
    await user.click(screen.getByRole("button", { name: "删除 第一项" }));
    expect(screen.getByTestId("editing-id")).toHaveTextContent("item_2");
    await user.click(screen.getByRole("button", { name: "删除 第二项" }));
    expect(screen.getByTestId("editing-id")).toHaveTextContent("none");
    expect(screen.getByTestId("session-state")).toHaveTextContent("edit:closing:第二项:2:none");
  });

  it("clears the jump token, scrolls the resolved row into view, and opens with extra session data", async () => {
    const user = userEvent.setup();
    const clearSpy = vi.fn();
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");

    render(<Harness onClearJump={clearSpy} />);

    await user.click(screen.getByRole("button", { name: "触发跳转" }));

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrollSpy.mock.contexts).toContain(screen.getByTestId("row-item_2"));
    expect(screen.getByTestId("editing-id")).toHaveTextContent("item_2");
    expect(screen.getByTestId("session-state")).toHaveTextContent("edit:open:第二项:2:2");
  });

  it("clears an unresolvable jump token without opening a session", () => {
    const clearSpy = vi.fn();

    render(<Harness initialJump={{ targetIndex: 99 }} onClearJump={clearSpy} />);

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("session-state")).toHaveTextContent("unmounted");
  });
});
