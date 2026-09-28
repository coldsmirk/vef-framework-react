import type { ConditionGroup } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EditorPluginsContext } from "../../plugins";
import { ConditionEditorModal, detectMode } from "./condition-editor-modal";

const FIELD_RULE_GROUPS: ConditionGroup[] = [
  {
    conditions: [
      {
        kind: "field",
        subject: "amount",
        operator: "gt",
        value: 1000,
        expression: ""
      }
    ]
  }
];

const PLUGINS = {
  formFields: [
    {
      key: "amount",
      kind: "number" as const,
      label: "金额"
    }
  ]
};

function renderModal(conditionGroups: ConditionGroup[], onOk = vi.fn()) {
  const view = render(
    <EditorPluginsContext value={PLUGINS}>
      <ConditionEditorModal open conditionGroups={conditionGroups} readonly={false} onCancel={() => undefined} onOk={onOk} />
    </EditorPluginsContext>
  );

  return {
    ...view,
    onOk,
    rerenderWith: (next: ConditionGroup[]) => view.rerender(
      <EditorPluginsContext value={PLUGINS}>
        <ConditionEditorModal open conditionGroups={next} readonly={false} onCancel={() => undefined} onOk={onOk} />
      </EditorPluginsContext>
    )
  };
}

describe("detectMode", () => {
  it("opens a lone expression condition in expression mode", () => {
    expect(detectMode([
      {
        conditions: [
          {
            kind: "expression",
            subject: "",
            operator: "",
            value: undefined,
            expression: "x > 1"
          }
        ]
      }
    ]))
      .toBe("expression");
  });

  it("opens groups mixing field and expression rules visually", () => {
    expect(detectMode([
      {
        conditions: [
          ...FIELD_RULE_GROUPS[0]!.conditions,
          {
            kind: "expression",
            subject: "",
            operator: "",
            value: undefined,
            expression: "x > 1"
          }
        ]
      }
    ])).toBe("visual");
  });
});

describe("ConditionEditorModal", () => {
  it("seeds the draft from the stored conditions and hands edits back", async () => {
    const user = userEvent.setup();
    const { onOk } = renderModal(FIELD_RULE_GROUPS);

    await user.click(screen.getByRole("button", { name: "删除条件" }));
    await user.click(screen.getByRole("button", { name: /确\s*定/ }));

    expect(onOk).toHaveBeenCalledWith([]);
  });

  it("keeps in-progress edits when the parent re-renders with a fresh condition list", async () => {
    const user = userEvent.setup();
    const { onOk, rerenderWith } = renderModal(FIELD_RULE_GROUPS);

    await user.click(screen.getByRole("button", { name: "删除条件" }));
    rerenderWith(structuredClone(FIELD_RULE_GROUPS));
    await user.click(screen.getByRole("button", { name: /确\s*定/ }));

    expect(onOk).toHaveBeenCalledWith([]);
  });

  it("shows an expression rule mixed into a visual group", () => {
    renderModal([
      {
        conditions: [
          ...FIELD_RULE_GROUPS[0]!.conditions,
          {
            kind: "expression",
            subject: "",
            operator: "",
            value: undefined,
            expression: "formData.amount < 5000"
          }
        ]
      }
    ]);

    expect(screen.getByRole("textbox", { name: "条件表达式" })).toHaveValue("formData.amount < 5000");
  });
});
