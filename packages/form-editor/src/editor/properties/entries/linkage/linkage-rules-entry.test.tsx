import type { ReactElement, ReactNode } from "react";

import type { ButtonField, FieldLinkage, FormField, FormSchema, TextfieldField } from "../../../../types";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../../../../engine/registry/defaults";
import { RegistryProvider } from "../../../../store/engine-provider";
import { FormEditorStoreProvider } from "../../../../store/form-store";
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
 * carries the linkage under edit — so `sourceOptions` is non-empty.
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
    <RegistryProvider registries={registries}>
      <FormEditorStoreProvider initialState={{ schema }}>{children}</FormEditorStoreProvider>
    </RegistryProvider>
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
 * A schema whose only field is the target, so `sourceOptions` is empty and a new
 * rule falls back to its edge-trigger seed.
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

describe("linkage rules entry", () => {
  describe("trigger", () => {
    it("renders the condition builder for a condition trigger", () => {
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

      // The group's logic Segmented only renders under a condition trigger.
      expect(screen.getByText("全部满足")).toBeInTheDocument();
    });

    it("replaces the condition builder with a hint for an edge trigger", () => {
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

      expect(screen.getByText("当该字段的值发生变化时触发")).toBeInTheDocument();
      expect(screen.queryByText("全部满足")).not.toBeInTheDocument();
    });
  });

  describe("condition source", () => {
    it("offers the field itself as a source (a rule may key off its own value)", () => {
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

      // The leaf's source select resolves the self-reference "target" to the
      // field's own option label — self is selectable, so a field can react to
      // its own value (here: alert when it equals "x").
      expect(screen.getByText("目标 · target")).toBeInTheDocument();
    });
  });

  describe("retrigger", () => {
    it("shows the retrigger switch for a condition rule carrying an effect action", () => {
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

      renderEntry(target, vi.fn());

      expect(screen.getByRole("switch", { name: "重复触发" })).toBeInTheDocument();
    });

    it("hides the retrigger switch for a state-only condition rule", () => {
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
          }
        ]
      });

      renderEntry(target, vi.fn());

      // No effect action → re-firing has nothing to govern, so the switch is absent.
      expect(screen.queryByRole("switch", { name: "重复触发" })).not.toBeInTheDocument();
    });

    it("toggles a condition rule to 'always'", async () => {
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

      await user.click(screen.getByRole("switch", { name: "重复触发" }));

      // The toggle lives on the condition trigger, not on individual actions.
      expect(lastLinkage(onChange).rules?.[0]?.trigger).toMatchObject({
        kind: "condition",
        retrigger: "always"
      });
    });

    it("hides the retrigger switch under an edge trigger", () => {
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
          }
        ]
      });

      renderEntry(target, vi.fn());

      // An edge trigger already pulses per event, so retrigger has no meaning.
      expect(screen.queryByRole("switch", { name: "重复触发" })).not.toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("appends an action to a rule", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ type: "submit" }]
          }
        ]
      });

      renderEntry(target, onChange);

      await user.click(screen.getByRole("button", { name: "新增动作" }));

      expect(lastLinkage(onChange).rules?.[0]?.actions).toHaveLength(2);
    });

    it("removes an action when a rule has more than one", async () => {
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

      const removeButtons = screen.getAllByRole("button", { name: "删除动作" });
      expect(removeButtons).toHaveLength(2);
      await user.click(removeButtons[0] as HTMLElement);

      expect(lastLinkage(onChange).rules?.[0]?.actions).toEqual([{ type: "reset" }]);
    });

    it("renders the target picker for a set_fields action", () => {
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
          }
        ]
      });

      renderEntry(target, vi.fn());

      expect(screen.getByText("选择目标字段")).toBeInTheDocument();
    });

    it("renders the data-source picker for a refresh_data_source action", () => {
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "change" },
            actions: [{ type: "refresh_data_source", dataSourceId: "" }]
          }
        ]
      });

      renderEntry(target, vi.fn());

      expect(screen.getByText("选择数据源")).toBeInTheDocument();
    });

    it("hides the single action's remove control", () => {
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

      expect(screen.queryByRole("button", { name: "删除动作" })).not.toBeInTheDocument();
    });
  });

  describe("rules", () => {
    it("adds a condition rule when a source field exists", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(targetField(), onChange);

      await user.click(screen.getByRole("button", { name: "新建联动规则" }));

      const { rules } = lastLinkage(onChange);
      expect(rules).toHaveLength(1);
      expect(rules?.[0]?.trigger.kind).toBe("condition");
    });

    it("seeds a change rule for a keyed target with no sibling source", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderSolo(targetField(), onChange);

      // Regex (not exact): a cold-loaded DynamicIcon adds a "Placeholder Icon"
      // prefix to the button's accessible name, so match the label as a substring.
      await user.click(screen.getByRole("button", { name: /新建联动规则/ }));

      expect(lastLinkage(onChange).rules?.[0]?.trigger.kind).toBe("change");
    });

    it("seeds a click rule for a non-keyed target with no sibling source", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      // A button carries no value, so the seed must not fall back to `change`
      // (the validator rejects it on a non-keyed block) — it seeds `click`.
      renderSolo(buttonField(), onChange);

      await user.click(screen.getByRole("button", { name: /新建联动规则/ }));

      expect(lastLinkage(onChange).rules?.[0]?.trigger.kind).toBe("click");
    });
  });

  describe("action identity", () => {
    it("editing the assign literal preserves the action's id", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(assignRuleField(), onChange);

      await user.type(screen.getByPlaceholderText("赋值内容"), "x");

      expect(lastLinkage(onChange).rules?.[0]?.actions?.[0]).toEqual({
        id: "A1",
        type: "assign",
        value: { kind: "literal", value: "x" }
      });
    });

    it("switching the action type keeps the action's id", async () => {
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

      // Combobox order: trigger kind, then the action's type select.
      const [, actionTypeSelect] = screen.getAllByRole("combobox");
      await user.click(actionTypeSelect as HTMLElement);
      await user.click(await screen.findByText("重置表单"));

      expect(lastLinkage(onChange).rules?.[0]?.actions?.[0]).toEqual({ id: "A1", type: "reset" });
    });

    it("keeps focus in the assign input across a keystroke round-trip", async () => {
      const user = userEvent.setup();

      // Stateful round-trip: each commit is written back through the entry's
      // lens and re-rendered, exactly like the properties panel + store. With
      // the action's id stripped, the list key would flip from "A1" to the
      // index, remounting the editor and dropping focus after ONE keystroke.
      render(<FocusHarness />);

      const input = screen.getByPlaceholderText("赋值内容");
      await user.click(input);
      await user.keyboard("ab");

      expect(input).toHaveValue("ab");
      // Same DOM node, still focused — no unmount/remount happened.
      expect(input).toHaveFocus();
    });
  });

  describe("retrigger round-trip", () => {
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

      await user.click(screen.getByRole("switch", { name: "重复触发" }));

      const trigger = lastLinkage(onChange).rules?.[0]?.trigger;
      expect(trigger).toMatchObject({ kind: "condition" });
      // Absent, not `undefined` — the persisted schema stays minimal.
      expect(trigger).not.toHaveProperty("retrigger");
    });
  });

  describe("service capability gating", () => {
    it("hides api_call and navigate from action options when unwired, yet keeps a stored api_call editable", async () => {
      const user = userEvent.setup();
      const target = targetField({
        rules: [
          {
            id: "R1",
            trigger: { kind: "commit" },
            actions: [
              {
                id: "A1",
                type: "submit"
              },
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

      // Multi-step sequences start collapsed: the stored api_call shows its
      // summary and unsupported badge, and expands with its output intact.
      expect(screen.getByText("当前宿主不支持")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /调用接口 · hr\/staff \/ find → res/ }));
      expect(screen.getByDisplayValue("res")).toBeInTheDocument();

      // Expand step 1 and open its action type selector: api_call and navigate are omitted.
      await user.click(screen.getByRole("button", { name: /提交表单/ }));
      const [, firstActionTypeSelect] = screen.getAllByRole("combobox");
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

      const [, actionTypeSelect] = screen.getAllByRole("combobox");
      await user.click(actionTypeSelect as HTMLElement);
      expect(await screen.findByText("调用接口")).toBeInTheDocument();
      expect(screen.getByText("页面跳转")).toBeInTheDocument();
    });
  });

  describe("live diagnostics", () => {
    it("shows a rule's validator warning on its card", () => {
      const target = targetField({
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
      });

      renderEntry(target, vi.fn());

      expect(screen.getByText("步骤 1：尚未选择目标字段")).toBeInTheDocument();
    });

    it("maps issues onto the card of the rule that produced them", () => {
      const target = targetField({
        rules: [
          {
            id: "R_clean",
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
            actions: [{ id: "A1", type: "show" }]
          },
          {
            id: "R_broken",
            trigger: { kind: "change" },
            actions: [
              {
                id: "A2",
                type: "set_fields",
                assignments: [{ targetKey: "", value: { kind: "literal", value: "x" } }]
              }
            ]
          }
        ]
      });

      renderEntry(target, vi.fn());

      // Each rule card is a labelled group; the issue must land on rule 2
      // (R_broken) and only there.
      const cleanCard = screen.getByRole("group", { name: "规则 1" });
      const brokenCard = screen.getByRole("group", { name: "规则 2" });

      expect(within(brokenCard).getByText("步骤 1：尚未选择目标字段")).toBeInTheDocument();
      expect(within(cleanCard).queryByText("步骤 1：尚未选择目标字段")).not.toBeInTheDocument();
      // Exactly one card carries the message.
      expect(screen.getAllByText("步骤 1：尚未选择目标字段")).toHaveLength(1);
    });
  });
});
