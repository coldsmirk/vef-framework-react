import type { CodeEditorProps } from "@vef-framework-react/components";
import type { ChangeEvent, ReactElement } from "react";

import type { LinkageCondition, LinkageConditionGroup } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ConditionEditor } from "./condition-editor";

vi.mock("@vef-framework-react/components", async importOriginal => {
  const actual = await importOriginal<typeof import("@vef-framework-react/components")>();

  // CodeMirror does not run under jsdom; a textarea stand-in keeps the
  // value/onChange contract (the established boundary mock — see
  // components/code-editor/code-editor.spec.tsx).
  function CodeEditor(props: CodeEditorProps): ReactElement {
    return (
      <textarea
        aria-label="mock-code-editor"
        value={props.value ?? ""}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => props.onChange?.(event.target.value)}
      />
    );
  }

  return {
    ...actual,
    CodeEditor
  };
});

const SOURCE_OPTIONS: SourceFieldOption[] = [
  { value: "amount", label: "金额 · amount" },
  { value: "name", label: "名称 · name" }
];

function leaf(overrides: Partial<Extract<LinkageCondition, { kind: "leaf" }>> = {}): Extract<LinkageCondition, { kind: "leaf" }> {
  return {
    kind: "leaf",
    id: "L1",
    sourceKey: "amount",
    operator: "eq",
    value: "",
    ...overrides
  };
}

function group(children: LinkageCondition[]): LinkageConditionGroup {
  return {
    kind: "group",
    id: "G1",
    logic: "all",
    children
  };
}

interface HarnessProps {
  initial: LinkageCondition;
  sourceOptions?: SourceFieldOption[];
  onCommit: (next: LinkageCondition) => void;
}

/**
 * Stateful round-trip harness: applies each committed condition back into the
 * editor, mirroring how the properties panel re-renders the entry after a
 * store write.
 */
function Harness({
  initial,
  sourceOptions = SOURCE_OPTIONS,
  onCommit
}: HarnessProps): ReactElement {
  const [condition, setCondition] = useState(initial);

  return (
    <ConditionEditor
      condition={condition}
      sourceOptions={sourceOptions}
      onChange={next => {
        onCommit(next);
        setCondition(next);
      }}
    />
  );
}

function lastCondition(onCommit: ReturnType<typeof vi.fn>): LinkageCondition {
  return onCommit.mock.calls.at(-1)?.[0] as LinkageCondition;
}

describe("ConditionEditor", () => {
  describe("leaf editing", () => {
    it("switching the operator to 为空 clears the value and hides the value input", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={group([leaf({ value: "10" })])} onCommit={onCommit} />);

      expect(screen.getByPlaceholderText("比较值")).toBeInTheDocument();

      const [, operatorSelect] = screen.getAllByRole("combobox");
      await user.click(operatorSelect as HTMLElement);
      await user.click(await screen.findByText("为空"));

      expect(lastCondition(onCommit)).toEqual(group([
        {
          kind: "leaf",
          id: "L1",
          sourceKey: "amount",
          operator: "empty"
        }
      ]));
      expect(screen.queryByPlaceholderText("比较值")).not.toBeInTheDocument();
    });

    it("changing the source field keeps the leaf's identity", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={group([leaf()])} onCommit={onCommit} />);

      const [sourceSelect] = screen.getAllByRole("combobox");
      await user.click(sourceSelect as HTMLElement);
      await user.click(await screen.findByText("名称 · name"));

      expect(lastCondition(onCommit)).toEqual(group([leaf({ sourceKey: "name" })]));
    });

    it("typing in the value input keeps the leaf's identity", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={group([leaf({ value: "1" })])} onCommit={onCommit} />);

      await user.type(screen.getByPlaceholderText("比较值"), "0");

      expect(lastCondition(onCommit)).toEqual(group([leaf({ value: "10" })]));
    });

    it("renders a dangling source key with a 未找到字段 affordance", () => {
      render(<Harness initial={group([leaf({ sourceKey: "ghost" })])} onCommit={vi.fn()} />);

      expect(screen.getByText("ghost（未找到字段）")).toBeInTheDocument();
    });
  });

  describe("removing the last row", () => {
    it("reseeds the root group with a fresh leaf instead of leaving it empty", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={group([leaf()])} onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: "删除条件" }));

      // Exactly one fresh seeded leaf — never an empty group, and not the
      // deleted row resurrected (its id differs).
      expect(lastCondition(onCommit)).toMatchObject({
        kind: "group",
        children: [
          {
            kind: "leaf",
            sourceKey: "amount",
            id: expect.not.stringMatching(/^L1$/)
          }
        ]
      });
    });

    it("keeps a single unconfigured leaf row when no source field exists", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={group([leaf({ sourceKey: "ghost" })])} sourceOptions={[]} onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: "删除条件" }));

      // Never an empty group (empty `all` is always-true at runtime) — a
      // single unconfigured leaf row remains.
      expect(lastCondition(onCommit)).toMatchObject({
        kind: "group",
        children: [{ kind: "leaf", sourceKey: "" }]
      });
    });

    it("removes the enclosing nested group when its last leaf is deleted", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();
      const nested: LinkageConditionGroup = {
        kind: "group",
        id: "G2",
        logic: "any",
        children: [leaf({ id: "L2", sourceKey: "name" })]
      };

      render(<Harness initial={group([leaf(), nested])} onCommit={onCommit} />);

      // The nested group's leaf is the second 删除条件 control.
      const removeButtons = screen.getAllByRole("button", { name: "删除条件" });
      await user.click(removeButtons[1] as HTMLElement);

      expect(lastCondition(onCommit)).toEqual(group([leaf()]));
    });
  });

  describe("nesting cap", () => {
    it("offers 新增条件组 at the root only", () => {
      render(<Harness initial={group([group([leaf()])])} onCommit={vi.fn()} />);

      // Two group editors are on screen (root + nested) but only the root may
      // nest further.
      expect(screen.getAllByRole("button", { name: /新增条件$/ })).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: /新增条件组/ })).toHaveLength(1);
    });
  });

  describe("group ↔ expression switching", () => {
    it("switches a pristine group to expression mode instantly", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={group([leaf()])} onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /切换到表达式/ }));

      expect(lastCondition(onCommit)).toMatchObject({ kind: "expression", source: "" });
    });

    it("asks for confirmation before discarding an authored group", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={group([leaf({ value: "10" })])} onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /切换到表达式/ }));

      // Nothing committed yet — the destructive replace waits for the confirm.
      expect(onCommit).not.toHaveBeenCalled();

      await user.click(await screen.findByRole("button", { name: "切 换" }));

      expect(lastCondition(onCommit)).toMatchObject({ kind: "expression" });
    });

    it("switches an empty expression to a seeded visual group instantly", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          initial={{
            kind: "expression",
            id: "E1",
            source: ""
          }}
          onCommit={onCommit}
        />
      );

      await user.click(screen.getByRole("button", { name: /切换到可视化/ }));

      expect(lastCondition(onCommit)).toMatchObject({
        kind: "group",
        children: [{ kind: "leaf", sourceKey: "amount" }]
      });
    });

    it("asks for confirmation before discarding an authored expression", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          initial={{
            kind: "expression",
            id: "E1",
            source: "field.a > 1"
          }}
          onCommit={onCommit}
        />
      );

      await user.click(screen.getByRole("button", { name: /切换到可视化/ }));

      expect(onCommit).not.toHaveBeenCalled();

      await user.click(await screen.findByRole("button", { name: "切 换" }));

      expect(lastCondition(onCommit)).toMatchObject({ kind: "group" });
    });

    it("keeps the expression and shows a notice when no source field can seed the visual mode", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          sourceOptions={[]}
          initial={{
            kind: "expression",
            id: "E1",
            source: "field.a > 1"
          }}
          onCommit={onCommit}
        />
      );

      await user.click(screen.getByRole("button", { name: /切换到可视化/ }));

      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByText(/暂时无法切换到可视化条件/)).toBeInTheDocument();
    });
  });

  describe("identity preservation", () => {
    it("keeps the root expression's id while typing", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          initial={{
            kind: "expression",
            id: "E1",
            source: "x"
          }}
          onCommit={onCommit}
        />
      );

      await user.type(screen.getByLabelText("mock-code-editor"), "y");

      expect(lastCondition(onCommit)).toEqual({
        kind: "expression",
        id: "E1",
        source: "xy"
      });
    });

    it("keeps a nested expression child's id while typing", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          initial={group([
            {
              kind: "expression",
              id: "E2",
              source: "a"
            }
          ])}
          onCommit={onCommit}
        />
      );

      await user.type(screen.getByLabelText("mock-code-editor"), "b");

      expect(lastCondition(onCommit)).toEqual(group([
        {
          kind: "expression",
          id: "E2",
          source: "ab"
        }
      ]));
    });
  });

  describe("bare leaf at root", () => {
    it("renders the group chrome and wraps the leaf on the first edit", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={leaf()} onCommit={onCommit} />);

      // Group chrome (the logic segmented control) is present.
      expect(screen.getByText("全部满足")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /新增条件$/ }));

      // The original leaf keeps its identity inside the wrapper, followed by
      // the freshly added row.
      expect(lastCondition(onCommit)).toMatchObject({
        kind: "group",
        children: [leaf(), { kind: "leaf", sourceKey: "amount" }]
      });
    });
  });
});
