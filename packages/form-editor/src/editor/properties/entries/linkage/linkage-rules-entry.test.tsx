import type { ReactElement, ReactNode } from "react";

import type { FormEditorStoreApi } from "../../../../store/form-store";
import type { ButtonField, FieldLinkage, FormField, FormSchema, TextfieldField } from "../../../../types";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../../../../engine/registry/defaults";
import { RegistryProvider } from "../../../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../../../store/form-store";
import { definePropertyEntry } from "../../../../types";
import { PreviewRuntimeProvider } from "../../../preview-runtime-context";
import { LinkageRulesEntry } from "./linkage-rules-entry";

const entry = definePropertyEntry<FormField, FieldLinkage | undefined>({
  id: "linkageRules",
  label: "联动规则",
  type: "linkage-rules",
  read: field => field.linkage,
  write: (field, linkage) => { return { ...field, linkage }; }
});

function targetField(linkage?: FieldLinkage): TextfieldField {
  return {
    id: "Field_target",
    type: "textfield",
    key: "target",
    label: "目标",
    linkage
  };
}

/**
 * A schema with a sibling source field `trigger` and the `target` field that
 * carries the linkage under edit — so `fieldOptions` is non-empty.
 */
function schemaFor(target: TextfieldField): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_trigger",
            type: "textfield",
            key: "trigger",
            label: "触发"
          },
          target
        ]
      }
    }
  };
}

const registries = { pc: createDefaultRegistry(), mobile: createDefaultRegistry() };

function EditorProviders({ children, schema }: { children: ReactNode; schema: FormSchema }): ReactElement {
  return (
    <ConfigProvider>
      <RegistryProvider registries={registries}>
        <FormEditorStoreProvider initialState={{ schema }}>{children}</FormEditorStoreProvider>
      </RegistryProvider>
    </ConfigProvider>
  );
}

function renderEntry(target: TextfieldField, onChange: (value: unknown) => void): void {
  const schema = schemaFor(target);

  render(
    <EditorProviders schema={schema}>
      <LinkageRulesEntry entry={entry} field={target} schema={schema} onChange={onChange} />
    </EditorProviders>
  );
}

/**
 * A non-keyed presentation block — contributes no value, so it can't fire
 * `change`.
 */
function buttonField(): ButtonField {
  return {
    id: "Field_target",
    type: "button",
    label: "提交"
  };
}

/**
 * A schema whose only field is the target, so no sibling source exists and a
 * new rule falls back to its edge-trigger seed.
 */
function soloSchemaFor(target: FormField): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [target]
      }
    }
  };
}

function renderSolo(target: FormField, onChange: (value: unknown) => void): void {
  const schema = soloSchemaFor(target);

  render(
    <EditorProviders schema={schema}>
      <LinkageRulesEntry entry={entry} field={target} schema={schema} onChange={onChange} />
    </EditorProviders>
  );
}

function lastLinkage(onChange: ReturnType<typeof vi.fn>): FieldLinkage {
  return onChange.mock.calls.at(-1)?.[0] as FieldLinkage;
}

/**
 * A target field carrying one condition rule with an `assign` action whose
 * client-stable id is "A1" — the identity-preservation fixtures.
 */
function assignRuleField(): TextfieldField {
  return targetField({
    rules: [
      {
        id: "R1",
        trigger: {
          kind: "condition",
          condition: {
            kind: "group",
            logic: "all",
            children: [
              {
                kind: "leaf",
                id: "C1",
                sourceKey: "trigger",
                operator: "notEmpty"
              }
            ]
          }
        },
        actions: [
          {
            id: "A1",
            type: "assign",
            value: { kind: "literal", value: "" }
          }
        ]
      }
    ]
  });
}

function FocusHarness(): ReactElement {
  const [field, setField] = useState<FormField>(() => assignRuleField());

  return (
    <EditorProviders schema={schemaFor(assignRuleField())}>
      <LinkageRulesEntry
        entry={entry}
        field={field}
        schema={schemaFor(assignRuleField())}
        onChange={value => setField(current => entry.write(current, value as FieldLinkage | undefined))}
      />
    </EditorProviders>
  );
}

function StoreBackedHarness({ onReady }: { onReady: (api: FormEditorStoreApi) => void }): ReactElement | null {
  const api = useFormEditorStoreApi();
  const schema = useFormEditorStore(state => state.schema);
  const field = schema.presentations.pc.children.find(node => node.id === "Field_target");

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  if (!field || field.type !== "textfield") {
    return null;
  }

  return (
    <LinkageRulesEntry
      entry={entry}
      field={field}
      schema={schema}
      onChange={value => {
        api.getState().editField({
          fieldId: field.id,
          updater: current => entry.write(current, value as FieldLinkage | undefined)
        });
      }}
    />
  );
}

function renderStoreBacked(target: TextfieldField = targetField()): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;
  const schema = schemaFor(target);

  render(
    <EditorProviders schema={schema}>
      <StoreBackedHarness
        onReady={api => {
          captured = api;
        }}
      />
    </EditorProviders>
  );

  if (!captured) {
    throw new Error("Store API was not captured");
  }

  return captured;
}

function storeTarget(api: FormEditorStoreApi): TextfieldField {
  const node = api.getState().schema.presentations.pc.children.find(item => item.id === "Field_target");

  if (!node || node.type !== "textfield") {
    throw new Error("Target field missing from store");
  }

  return node;
}

async function openRuleDialog(user: ReturnType<typeof userEvent.setup>, ruleNumber = 1): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: `编辑规则 ${ruleNumber}` }));

  return screen.findByRole("dialog");
}

beforeEach(() => {
  vi.spyOn(globalThis, "matchMedia").mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  } as unknown as MediaQueryList));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("linkage rules entry", () => {
  describe("compact list rows", () => {
    it("summarizes trigger kinds, single and multiple steps, and issue markers", () => {
      const target = targetField({
        rules: [
          {
            id: "R_cond",
            trigger: {
              kind: "condition",
              condition: {
                kind: "group",
                logic: "all",
                children: [
                  {
                    kind: "leaf",
                    sourceKey: "trigger",
                    operator: "gte",
                    value: "18"
                  }
                ]
              }
            },
            actions: [
              {
                id: "A1",
                type: "alert",
                level: "info",
                message: { kind: "literal", value: "达标" }
              }
            ]
          },
          {
            id: "R_event",
            trigger: { kind: "commit" },
            actions: [
              { id: "A2", type: "submit" },
              {
                id: "A3",
                type: "set_fields",
                assignments: [{ targetKey: "", value: { kind: "literal", value: "x" } }]
              }
            ]
          },
          {
            id: "R_expr",
            trigger: {
              kind: "condition",
              condition: { kind: "expression", source: "field.trigger === 'ok'" }
            },
            actions: [{ id: "A4", type: "show" }]
          }
        ]
      });

      renderEntry(target, vi.fn());

      const rows = screen.getAllByRole("listitem");
      expect(rows).toHaveLength(3);

      expect(within(rows[0]!).getByText("规则 1")).toBeInTheDocument();
      expect(within(rows[0]!).getByText("触发 大于等于 18 时")).toBeInTheDocument();
      expect(within(rows[0]!).getByText("提示消息 · 信息 · 达标")).toBeInTheDocument();
      expect(within(rows[0]!).queryByText(/项问题/)).not.toBeInTheDocument();

      expect(within(rows[1]!).getByText("规则 2")).toBeInTheDocument();
      expect(within(rows[1]!).getByText("目标 输入完成时")).toBeInTheDocument();
      expect(within(rows[1]!).getByText("2 个步骤：提交表单 → 设置字段")).toBeInTheDocument();
      expect(within(rows[1]!).getByText("1 项问题")).toBeInTheDocument();

      expect(within(rows[2]!).getByText("规则 3")).toBeInTheDocument();
      expect(within(rows[2]!).getByText("满足表达式时")).toBeInTheDocument();
      expect(within(rows[2]!).getByText("显示")).toBeInTheDocument();
      expect(within(rows[2]!).queryByText(/项问题/)).not.toBeInTheDocument();
    });

    it("keeps edit, duplicate, and delete as keyboard-accessible sibling buttons", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ id: "A1", type: "submit" }]
          }
        ]
      });

      renderEntry(target, vi.fn());

      const editBtn = screen.getByRole("button", { name: "编辑规则 1" });
      const duplicateBtn = screen.getByRole("button", { name: "复制规则 1" });
      const deleteBtn = screen.getByRole("button", { name: "删除规则 1" });

      expect(editBtn.contains(duplicateBtn)).toBe(false);
      expect(editBtn.contains(deleteBtn)).toBe(false);

      editBtn.focus();
      expect(editBtn).toHaveFocus();
      await user.keyboard("{Enter}");

      expect(await screen.findByRole("dialog", { name: "规则 1 · 目标" })).toBeInTheDocument();
    });

    it("duplicates a rule right after the original with a fresh id and deletes immediately with undo", async () => {
      const user = userEvent.setup();
      const api = renderStoreBacked(targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ id: "A1", type: "submit" }]
          },
          {
            id: "R2",
            trigger: { kind: "blur" },
            actions: [{ id: "A2", type: "reset" }]
          }
        ]
      }));

      await user.click(screen.getByRole("button", { name: "复制规则 1" }));

      const afterDup = storeTarget(api).linkage?.rules ?? [];
      expect(afterDup).toHaveLength(3);
      expect(afterDup[0]?.id).toBe("R1");
      expect(afterDup[1]?.id).not.toBe("R1");
      expect(afterDup[1]?.trigger).toEqual({ kind: "change" });
      expect(afterDup[1]?.actions[0]?.id).not.toBe("A1");
      expect(afterDup[2]?.id).toBe("R2");
      expect(api.getState().past).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "删除规则 2" }));
      expect(storeTarget(api).linkage?.rules?.map(rule => rule.id)).toEqual(["R1", "R2"]);
      expect(api.getState().past).toHaveLength(2);

      act(() => {
        api.getState().undo();
      });
      expect(storeTarget(api).linkage?.rules).toHaveLength(3);
    });
  });

  describe("adding, editing, and closing the rule dialog", () => {
    it("inserts nothing on cancel and inserts the rule as one undo step on confirm", async () => {
      const user = userEvent.setup();
      const api = renderStoreBacked();

      await user.click(screen.getByRole("button", { name: /新建联动规则/ }));
      let dialog = await screen.findByRole("dialog", { name: "新建联动规则" });
      expect(storeTarget(api).linkage).toBeUndefined();

      await user.click(within(dialog).getByRole("button", { name: "取消" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "新建联动规则" })).not.toBeInTheDocument();
      });
      expect(storeTarget(api).linkage).toBeUndefined();
      expect(api.getState().past).toHaveLength(0);

      await user.click(screen.getByRole("button", { name: /新建联动规则/ }));
      dialog = await screen.findByRole("dialog", { name: "新建联动规则" });
      await user.type(within(dialog).getByPlaceholderText("比较值"), "18");
      await user.click(within(dialog).getByRole("button", { name: "新增动作" }));
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      const rules = storeTarget(api).linkage?.rules ?? [];
      expect(rules).toHaveLength(1);
      expect(rules[0]?.trigger.kind).toBe("condition");
      expect(rules[0]?.actions).toHaveLength(2);
      expect(api.getState().past).toHaveLength(1);

      act(() => {
        api.getState().undo();
      });
      expect(storeTarget(api).linkage).toBeUndefined();
    });

    it("asks confirmation before closing a dirty draft and keeps edits when declining", async () => {
      const user = userEvent.setup();
      const api = renderStoreBacked(targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ id: "A1", type: "submit" }]
          }
        ]
      }));

      // Clean close asks nothing.
      let dialog = await openRuleDialog(user, 1);
      await user.click(within(dialog).getByRole("button", { name: "取消" }));
      expect(screen.queryByText("放弃未保存的修改？")).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "规则 1 · 目标" })).not.toBeInTheDocument();
      });

      // Dirty close declined keeps edits intact.
      dialog = await openRuleDialog(user, 1);
      await user.click(within(dialog).getByRole("button", { name: "新增动作" }));
      await user.click(within(dialog).getByRole("button", { name: "取消" }));

      expect(await screen.findByText("关闭后本次修改将不会保存。")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "继续编辑" }));
      await waitFor(() => {
        expect(screen.queryByText("关闭后本次修改将不会保存。")).not.toBeInTheDocument();
      });
      expect(within(dialog).getAllByRole("button", { name: "删除动作" })).toHaveLength(2);

      // Dirty close accepted discards the draft and leaves the store untouched.
      await user.click(within(dialog).getByRole("button", { name: "取消" }));
      expect(await screen.findByText("关闭后本次修改将不会保存。")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "放弃修改" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "规则 1 · 目标" })).not.toBeInTheDocument();
      });
      expect(storeTarget(api).linkage?.rules?.[0]?.actions).toHaveLength(1);
      expect(api.getState().past).toHaveLength(0);
    });

    it("seeds a change rule for a keyed target with no sibling source", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderSolo(targetField(), onChange);

      await user.click(screen.getByRole("button", { name: /新建联动规则/ }));
      const dialog = await screen.findByRole("dialog", { name: "新建联动规则" });
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(lastLinkage(onChange).rules?.[0]?.trigger.kind).toBe("change");
    });

    it("seeds a click rule for a non-keyed target with no sibling source", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderSolo(buttonField(), onChange);

      await user.click(screen.getByRole("button", { name: /新建联动规则/ }));
      const dialog = await screen.findByRole("dialog", { name: "新建联动规则" });
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(lastLinkage(onChange).rules?.[0]?.trigger.kind).toBe("click");
    });
  });

  describe("trigger and condition editing inside dialog", () => {
    it("renders the condition builder for a condition trigger", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "group",
                logic: "all",
                children: [
                  {
                    kind: "leaf",
                    sourceKey: "trigger",
                    operator: "eq",
                    value: "x"
                  }
                ]
              }
            },
            actions: [{ type: "show" }]
          }
        ]
      });

      renderEntry(target, vi.fn());

      const dialog = await openRuleDialog(user);
      expect(within(dialog).getByText("全部满足")).toBeInTheDocument();
    });

    it("replaces the condition builder with a hint for an edge trigger", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ type: "submit" }]
          }
        ]
      });

      renderEntry(target, vi.fn());

      const dialog = await openRuleDialog(user);
      expect(within(dialog).getByText("当该字段的值发生变化时触发")).toBeInTheDocument();
      expect(within(dialog).queryByText("全部满足")).not.toBeInTheDocument();
    });

    it("offers the field itself as a condition source", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "group",
                logic: "all",
                children: [
                  {
                    kind: "leaf",
                    sourceKey: "target",
                    operator: "eq",
                    value: "x"
                  }
                ]
              }
            },
            actions: [
              {
                type: "alert",
                level: "info",
                message: { kind: "literal", value: "hi" }
              }
            ]
          }
        ]
      });

      renderEntry(target, vi.fn());

      const dialog = await openRuleDialog(user);
      expect(within(dialog).getByText("目标 · target")).toBeInTheDocument();
    });
  });

  describe("retrigger", () => {
    it("shows the retrigger switch for a condition rule carrying an effect action and toggles to 'always'", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "group",
                logic: "all",
                children: [
                  {
                    kind: "leaf",
                    sourceKey: "trigger",
                    operator: "notEmpty"
                  }
                ]
              }
            },
            actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
          }
        ]
      });

      renderEntry(target, onChange);

      const dialog = await openRuleDialog(user);
      await user.click(within(dialog).getByRole("switch", { name: "重复触发" }));
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(lastLinkage(onChange).rules?.[0]?.trigger).toMatchObject({
        kind: "condition",
        retrigger: "always"
      });
    });

    it("hides the retrigger switch for state-only and edge-triggered rules", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "group",
                logic: "all",
                children: [
                  {
                    kind: "leaf",
                    sourceKey: "trigger",
                    operator: "notEmpty"
                  }
                ]
              }
            },
            actions: [{ type: "show" }]
          },
          {
            id: "R2",
            trigger: { kind: "change" },
            actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
          }
        ]
      });

      renderEntry(target, vi.fn());

      let dialog = await openRuleDialog(user, 1);
      expect(within(dialog).queryByRole("switch", { name: "重复触发" })).not.toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "取消" }));

      dialog = await openRuleDialog(user, 2);
      expect(within(dialog).queryByRole("switch", { name: "重复触发" })).not.toBeInTheDocument();
    });

    it("removes the retrigger key entirely when toggled off", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: {
              kind: "condition",
              retrigger: "always",
              condition: {
                kind: "group",
                logic: "all",
                children: [
                  {
                    kind: "leaf",
                    sourceKey: "trigger",
                    operator: "notEmpty"
                  }
                ]
              }
            },
            actions: [
              {
                id: "A1",
                type: "alert",
                message: { kind: "literal", value: "hi" }
              }
            ]
          }
        ]
      });

      renderEntry(target, onChange);

      const dialog = await openRuleDialog(user);
      await user.click(within(dialog).getByRole("switch", { name: "重复触发" }));
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      const trigger = lastLinkage(onChange).rules?.[0]?.trigger;
      expect(trigger).toMatchObject({ kind: "condition" });
      expect(trigger).not.toHaveProperty("retrigger");
    });
  });

  describe("actions and identity", () => {
    it("appends and removes actions inside the dialog", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ type: "submit" }, { type: "reset" }]
          }
        ]
      });

      renderEntry(target, onChange);

      const dialog = await openRuleDialog(user);
      const removeButtons = within(dialog).getAllByRole("button", { name: "删除动作" });
      expect(removeButtons).toHaveLength(2);
      await user.click(removeButtons[0] as HTMLElement);
      expect(within(dialog).queryByRole("button", { name: "删除动作" })).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect(lastLinkage(onChange).rules?.[0]?.actions).toEqual([{ type: "reset" }]);
    });

    it("renders the target picker for set_fields and the data-source picker for refresh_data_source", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [
              {
                type: "set_fields",
                assignments: [{ targetKey: "", value: { kind: "literal", value: "" } }]
              }
            ]
          },
          {
            id: "R2",
            trigger: { kind: "change" },
            actions: [{ type: "refresh_data_source", dataSourceId: "" }]
          }
        ]
      });

      renderEntry(target, vi.fn());

      let dialog = await openRuleDialog(user, 1);
      expect(within(dialog).getByText("选择目标字段")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "取消" }));

      dialog = await openRuleDialog(user, 2);
      expect(within(dialog).getByText("选择数据源")).toBeInTheDocument();
    });

    it("preserves action id across literal edits, type switches, and typing focus", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(assignRuleField(), onChange);

      const dialog = await openRuleDialog(user);
      const input = within(dialog).getByPlaceholderText("赋值内容");
      await user.click(input);
      await user.keyboard("ab");
      expect(input).toHaveValue("ab");
      expect(input).toHaveFocus();

      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect(lastLinkage(onChange).rules?.[0]?.actions?.[0]).toEqual({
        id: "A1",
        type: "assign",
        value: { kind: "literal", value: "ab" }
      });
    });

    it("keeps focus across a keystroke round-trip inside the stateful harness", async () => {
      const user = userEvent.setup();

      render(<FocusHarness />);

      const dialog = await openRuleDialog(user);
      const input = within(dialog).getByPlaceholderText("赋值内容");
      await user.click(input);
      await user.keyboard("xy");

      expect(input).toHaveValue("xy");
      expect(input).toHaveFocus();
    });

    it("keeps the action id when switching action type", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ id: "A1", type: "submit" }]
          }
        ]
      });

      renderEntry(target, onChange);

      const dialog = await openRuleDialog(user);
      const [, actionTypeSelect] = within(dialog).getAllByRole("combobox");
      await user.click(actionTypeSelect as HTMLElement);
      await user.click(await screen.findByText("重置表单"));
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(lastLinkage(onChange).rules?.[0]?.actions?.[0]).toEqual({ id: "A1", type: "reset" });
    });
  });

  describe("service capability gating", () => {
    it("hides api_call and navigate when unwired, yet keeps a stored api_call editable", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "commit" },
            actions: [
              { id: "A1", type: "submit" },
              {
                id: "A2",
                type: "api_call",
                request: { resource: "hr/staff", action: "find" },
                output: "res"
              }
            ]
          }
        ]
      });
      const schema = schemaFor(target);

      render(
        <PreviewRuntimeProvider value={{ serviceCapabilities: { hasRequest: false, hasNavigate: false } }}>
          <EditorProviders schema={schema}>
            <LinkageRulesEntry entry={entry} field={target} schema={schema} onChange={vi.fn()} />
          </EditorProviders>
        </PreviewRuntimeProvider>
      );

      const dialog = await openRuleDialog(user);
      expect(within(dialog).getByText("当前宿主不支持")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: /调用接口 · hr\/staff \/ find → res/ }));
      expect(within(dialog).getByDisplayValue("res")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: /提交表单/ }));
      const [, firstActionTypeSelect] = within(dialog).getAllByRole("combobox");
      await user.click(firstActionTypeSelect as HTMLElement);
      expect(screen.queryByRole("option", { name: "调用接口" })).not.toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "页面跳转" })).not.toBeInTheDocument();
    });

    it("offers api_call and navigate when host services are wired", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "commit" },
            actions: [{ id: "A1", type: "submit" }]
          }
        ]
      });
      const schema = schemaFor(target);

      render(
        <PreviewRuntimeProvider value={{ serviceCapabilities: { hasRequest: true, hasNavigate: true } }}>
          <EditorProviders schema={schema}>
            <LinkageRulesEntry entry={entry} field={target} schema={schema} onChange={vi.fn()} />
          </EditorProviders>
        </PreviewRuntimeProvider>
      );

      const dialog = await openRuleDialog(user);
      const [, actionTypeSelect] = within(dialog).getAllByRole("combobox");
      await user.click(actionTypeSelect as HTMLElement);
      expect(await screen.findByText("调用接口")).toBeInTheDocument();
      expect(screen.getByText("页面跳转")).toBeInTheDocument();
    });
  });

  describe("draft diagnostics", () => {
    it("recomputes diagnostics live from the draft and still allows saving a rule with issues", async () => {
      const user = userEvent.setup();
      const api = renderStoreBacked(targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [
              {
                id: "A1",
                type: "set_fields",
                assignments: [{ targetKey: "", value: { kind: "literal", value: "x" } }]
              }
            ]
          }
        ]
      }));

      // Row shows the committed issue count.
      expect(screen.getByText("1 项问题")).toBeInTheDocument();

      const dialog = await openRuleDialog(user);
      expect(within(dialog).getByText("步骤 1：尚未选择目标字段")).toBeInTheDocument();

      // Fixing the target in the draft clears the diagnostic immediately before 确定.
      await user.click(within(dialog).getByRole("combobox", { name: "目标字段" }));
      await user.click(await screen.findByText("触发 · trigger"));

      await waitFor(() => {
        expect(within(dialog).queryByText("步骤 1：尚未选择目标字段")).not.toBeInTheDocument();
      });

      // Adding a new blank assignment introduces a draft diagnostic immediately,
      // and saving a rule that still carries issues remains allowed.
      await user.click(within(dialog).getByRole("button", { name: "新增字段赋值" }));
      expect(await within(dialog).findByText("步骤 1：尚未选择目标字段")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect(storeTarget(api).linkage?.rules?.[0]?.actions[0]).toMatchObject({
        type: "set_fields",
        assignments: [
          { targetKey: "trigger", value: { kind: "literal", value: "x" } },
          { targetKey: "", value: { kind: "literal", value: "" } }
        ]
      });
    });
  });
});
