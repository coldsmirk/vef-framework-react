import type * as ComponentsModule from "@vef-framework-react/components";
import type { CodeEditorProps } from "@vef-framework-react/components";
import type { ChangeEvent, ReactElement } from "react";

import type { LinkageFocusRef } from "../../../../store/form-store";
import type {
  DataSourceApi,
  FieldLinkage,
  FormField,
  FormSchema,
  LinkageContextSource,
  NumberField,
  SelectField,
  SwitchField,
  TextfieldField,
  UploadField
} from "../../../../types";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { dragSortableRow } from "../../../../../test-utils";
import { createDefaultRegistry } from "../../../../engine/registry/defaults";
import { RegistryProvider } from "../../../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../../../store/form-store";
import { definePropertyEntry } from "../../../../types";
import { ContextSourcesProvider } from "../../../context-sources";
import { DataSourceApisProvider } from "../../../data-source-apis";
import { PreviewRuntimeProvider } from "../../../preview-runtime-context";
import { PropertiesPanel } from "../../properties-panel";
import { commitHintForField, LinkageRulesEntry } from "./linkage-rules-entry";
import { createActionFor, switchRuleTrigger } from "./mutators";

const codeEditorRender = vi.hoisted(() => vi.fn());

function CodeEditor(props: CodeEditorProps): ReactElement {
  codeEditorRender(props.value);

  return (
    <textarea
      aria-label="mock-code-editor"
      value={props.value ?? ""}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => props.onChange?.(event.target.value)}
    />
  );
}

vi.mock("@vef-framework-react/components", async importOriginal => {
  const actual = await importOriginal<typeof ComponentsModule>();

  return {
    ...actual,
    CodeEditor
  };
});

const ENTRY = definePropertyEntry<FormField, FieldLinkage | undefined>({
  id: "linkageRules",
  label: "联动规则",
  type: "linkage-rules",
  read: field => field.linkage,
  write: (field, linkage) => { return { ...field, linkage }; }
});

const STAFF_API: DataSourceApi = {
  label: "职员查询",
  description: "按关键字查职员",
  group: "主数据",
  resource: "md/staff",
  action: "lookup",
  params: [
    {
      name: "keyword",
      label: "关键字",
      required: true
    }
  ],
  fields: [
    { path: "number", label: "工号" },
    { path: "name", label: "姓名" },
    { path: "phoneNumber", label: "手机号" },
    { path: "gender", label: "性别" }
  ]
};

const RAW_API: DataSourceApi = {
  label: "自定义查询",
  group: "其他",
  resource: "misc/query",
  action: "find"
};

const CONTEXT_SOURCES: LinkageContextSource[] = [{ key: "$applicant.name", label: "申请人姓名" }];
const DEFAULT_APIS: DataSourceApi[] = [STAFF_API, RAW_API];

const REGISTRIES = { pc: createDefaultRegistry(), mobile: createDefaultRegistry() };

function FocusDispatcher({ focus }: { focus: LinkageFocusRef }): ReactElement {
  const api = useFormEditorStoreApi();

  useEffect(() => {
    api.getState().requestLinkageFocus(focus);
  }, [api, focus]);

  return <PropertiesPanel />;
}

/**
 * The real properties panel over the real store, on the rule a diagnostic
 * points at.
 */
function renderPanel(linkage: FieldLinkage, focus: LinkageFocusRef): void {
  render(
    <PreviewRuntimeProvider value={{ serviceCapabilities: { hasRequest: true, hasNavigate: true } }}>
      <RegistryProvider registries={REGISTRIES}>
        <FormEditorStoreProvider initialState={{ schema: makeStaffSchema(linkage) }}>
          <FocusDispatcher focus={focus} />
        </FormEditorStoreProvider>
      </RegistryProvider>
    </PreviewRuntimeProvider>
  );
}

function hintOf(field: FormField): string {
  return commitHintForField(field, REGISTRIES.pc.get(field.type));
}

function alertRule(id: string, source: string): NonNullable<FieldLinkage["rules"]>[number] {
  return {
    id,
    trigger: { kind: "commit" },
    actions: [
      {
        id: `${id}_A1`,
        type: "alert",
        message: { kind: "expression", source }
      }
    ]
  };
}

function makeStaffSchema(codeLinkage?: FieldLinkage): FormSchema {
  const codeField: TextfieldField = {
    id: "Field_code",
    type: "textfield",
    key: "number",
    label: "工号",
    linkage: codeLinkage
  };
  const nameField: TextfieldField = {
    id: "Field_name",
    type: "textfield",
    key: "name",
    label: "姓名"
  };
  const phoneField: TextfieldField = {
    id: "Field_phone",
    type: "textfield",
    key: "phone",
    label: "手机号"
  };
  const ageField: NumberField = {
    id: "Field_age",
    type: "number",
    key: "age",
    label: "年龄"
  };
  const activeField: SwitchField = {
    id: "Field_active",
    type: "switch",
    key: "active",
    label: "启用"
  };
  const genderField: SelectField = {
    id: "Field_gender",
    type: "select",
    key: "gender",
    label: "性别",
    dataSource: {
      kind: "static",
      options: [
        { label: "男", value: "M" },
        { label: "女", value: "F" }
      ]
    }
  };
  const attachmentField: UploadField = {
    id: "Field_upload",
    type: "upload",
    key: "attachment",
    label: "附件"
  };

  return {
    id: "Form_staff",
    version: 2,
    variables: [
      {
        id: "Var_1",
        name: "defaultCode",
        type: "string"
      }
    ],
    presentations: {
      pc: {
        children: [
          codeField,
          nameField,
          phoneField,
          ageField,
          activeField,
          genderField,
          attachmentField
        ]
      }
    }
  };
}

function StatefulLinkageHarness({
  apis = DEFAULT_APIS,
  contextSources = CONTEXT_SOURCES,
  hasNavigate = true,
  hasRequest = true,
  initialLinkage,
  onCommit,
  targetField
}: {
  initialLinkage?: FieldLinkage;
  targetField?: FormField;
  apis?: DataSourceApi[];
  contextSources?: LinkageContextSource[];
  hasRequest?: boolean;
  hasNavigate?: boolean;
  onCommit?: (next: FieldLinkage | undefined) => void;
}): ReactElement {
  const baseSchema = makeStaffSchema(initialLinkage);
  const initialField = targetField ?? baseSchema.presentations.pc.children[0] as FormField;
  const [field, setField] = useState<FormField>(initialField);
  const schema: FormSchema = {
    ...baseSchema,
    presentations: {
      pc: {
        children: baseSchema.presentations.pc.children.map(node => node.id === field.id ? field : node)
      }
    }
  };

  return (
    <PreviewRuntimeProvider value={{ serviceCapabilities: { hasRequest, hasNavigate } }}>
      <DataSourceApisProvider apis={apis}>
        <ContextSourcesProvider sources={contextSources}>
          <RegistryProvider registries={REGISTRIES}>
            <FormEditorStoreProvider initialState={{ schema }}>
              <LinkageRulesEntry
                entry={ENTRY}
                field={field}
                schema={schema}
                onChange={value => {
                  const next = value as FieldLinkage | undefined;
                  onCommit?.(next);
                  setField(current => ENTRY.write(current, next));
                }}
              />
            </FormEditorStoreProvider>
          </RegistryProvider>
        </ContextSourcesProvider>
      </DataSourceApisProvider>
    </PreviewRuntimeProvider>
  );
}

/**
 * Two steps, the second drawing from the first.
 */
function dependentSteps(withIds = true): FieldLinkage {
  return {
    rules: [
      {
        id: "R1",
        trigger: { kind: "commit" },
        actions: [
          {
            ...withIds && { id: "A1" },
            type: "api_call",
            request: { resource: "md/staff", action: "lookup" },
            output: "result"
          },
          {
            ...withIds && { id: "A2" },
            type: "select_record",
            source: { kind: "reference", path: "$steps.result" },
            output: "selected"
          }
        ]
      }
    ]
  };
}

/**
 * The steps' summaries as they stand on screen.
 */
function summaries(): string[] {
  return screen.getAllByText(/^(?:调用接口|选择记录) · /).map(element => element.textContent);
}

describe("action sequence designer", () => {
  describe("control-specific commit hints and event guards", () => {
    it("describes how each control commits", () => {
      expect(hintOf({
        id: "F1",
        type: "textfield",
        key: "k1"
      })).toBe("按回车，或离开输入框且内容变化时触发");
      expect(hintOf({
        id: "F2",
        type: "textarea",
        key: "k2"
      })).toBe("离开输入框且内容变化时触发");
      expect(hintOf({
        id: "F3",
        type: "switch",
        key: "k3"
      })).toBe("值改变后立即触发");
    });

    it("adds, edits, and removes a when guard on an event trigger", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <StatefulLinkageHarness
          initialLinkage={{
            rules: [
              {
                id: "R1",
                trigger: { kind: "commit" },
                actions: [
                  {
                    id: "A1",
                    type: "alert",
                    message: { kind: "literal", value: "ok" }
                  }
                ]
              }
            ]
          }}
          onCommit={onCommit}
        />
      );

      expect(screen.getByText("按回车，或离开输入框且内容变化时触发")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /添加执行条件/ }));

      expect(screen.getByText("仅在满足条件时执行")).toBeInTheDocument();
      const afterAdd = onCommit.mock.calls.at(-1)?.[0] as FieldLinkage;
      expect(afterAdd.rules?.[0]?.trigger).toMatchObject({
        kind: "commit",
        when: {
          kind: "group",
          children: [
            {
              kind: "leaf",
              sourceKey: "number",
              operator: "notEmpty"
            }
          ]
        }
      });

      await user.click(screen.getByRole("button", { name: "移除条件" }));
      const afterRemove = onCommit.mock.calls.at(-1)?.[0] as FieldLinkage;
      expect(afterRemove.rules?.[0]?.trigger).toEqual({ kind: "commit" });
    });

    it("preserves guards across trigger kind switches", () => {
      const guard = {
        kind: "group" as const,
        logic: "all" as const,
        children: [
          {
            kind: "leaf" as const,
            sourceKey: "number",
            operator: "notEmpty" as const
          }
        ]
      };
      const eventRule = {
        id: "R1",
        trigger: { kind: "commit" as const, when: guard },
        actions: [
          {
            id: "A1",
            type: "alert" as const,
            message: { kind: "literal" as const, value: "hi" }
          }
        ]
      };

      const toBlur = switchRuleTrigger(eventRule, "blur", true, "name");
      expect(toBlur.trigger).toEqual({ kind: "blur", when: guard });

      const toCondition = switchRuleTrigger(eventRule, "condition", true, "name");
      expect(toCondition.trigger).toEqual({ kind: "condition", condition: guard });

      const backToCommit = switchRuleTrigger(toCondition, "commit", true, "name");
      expect(backToCommit.trigger).toEqual({ kind: "commit", when: guard });
    });
  });

  describe("lookup-and-fill template and step summary / collapse", () => {
    it("offers 查询并回填 template only on writable leaf fields when request service is wired", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      const { unmount } = render(<StatefulLinkageHarness hasRequest onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /模板/ }));
      await user.click(await screen.findByText("查询并回填"));

      const committed = onCommit.mock.calls.at(-1)?.[0] as FieldLinkage;
      expect(committed.rules).toHaveLength(1);
      expect(committed.rules?.[0]?.trigger).toMatchObject({
        kind: "commit",
        when: {
          kind: "group",
          children: [
            {
              kind: "leaf",
              sourceKey: "number",
              operator: "notEmpty"
            }
          ]
        }
      });
      expect(committed.rules?.[0]?.actions).toMatchObject([
        { type: "api_call", output: "result" },
        {
          type: "select_record",
          source: { kind: "reference", path: "$steps.result" },
          output: "selected",
          whenNone: "continue"
        },
        { type: "set_fields" }
      ]);

      // Multi-step sequence starts collapsed with plain-Chinese summaries.
      expect(screen.getByText(/调用接口 · 未选择接口 → result/)).toBeInTheDocument();
      expect(screen.getByText(/选择记录 · result → selected/)).toBeInTheDocument();
      expect(screen.getByText(/设置字段 · 未配置写入项/)).toBeInTheDocument();

      unmount();

      // Without host `request` service, the template button is absent.
      render(<StatefulLinkageHarness hasRequest={false} />);
      expect(screen.queryByRole("button", { name: /模板/ })).not.toBeInTheDocument();
    });

    it("omits 查询并回填 template on non-writable upload fields", () => {
      const uploadField: UploadField = {
        id: "Field_upload",
        type: "upload",
        key: "attachment",
        label: "附件"
      };

      render(<StatefulLinkageHarness hasRequest targetField={uploadField} />);
      expect(screen.queryByRole("button", { name: /模板/ })).not.toBeInTheDocument();
    });
  });

  describe("step outputs, catalog api_call, select_record, and set_fields matching", () => {
    it("allocates unique output names and seeds select_record source from prior step", () => {
      const a1 = createActionFor("api_call", []);
      expect(a1).toMatchObject({ type: "api_call", output: "result" });

      const a2 = createActionFor("api_call", [a1]);
      expect(a2).toMatchObject({ type: "api_call", output: "result_2" });

      const s1 = createActionFor("select_record", [a1, a2]);
      expect(s1).toMatchObject({
        type: "select_record",
        output: "selected",
        source: { kind: "reference", path: "$steps.result_2" }
      });
    });

    it("draws a select_record only from the results before it, and names it apart from all", () => {
      const call = createActionFor("api_call");
      const select = createActionFor("select_record", [call]);

      expect(createActionFor("select_record", [createActionFor("submit"), call, select], 0)).toMatchObject({
        output: "selected_2",
        source: { kind: "reference", path: "" }
      });
    });

    it("propagates output renames, supports 按名称匹配, and previews inferred select_record columns", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <StatefulLinkageHarness
          initialLinkage={{
            rules: [
              {
                id: "R1",
                trigger: { kind: "commit" },
                actions: [
                  {
                    id: "A1",
                    type: "api_call",
                    request: {
                      resource: "md/staff",
                      action: "lookup",
                      params: { keyword: { kind: "reference", path: "number" } }
                    },
                    output: "result"
                  },
                  {
                    id: "A2",
                    type: "select_record",
                    source: { kind: "reference", path: "$steps.result" },
                    output: "selected",
                    whenNone: "continue"
                  },
                  {
                    id: "A3",
                    type: "set_fields",
                    assignments: [{ targetKey: "", value: { kind: "literal", value: "" } }]
                  }
                ]
              }
            ]
          }}
          onCommit={onCommit}
        />
      );

      // Collapsed summary shows the catalog API label.
      expect(screen.getByText("调用接口 · 职员查询 → result")).toBeInTheDocument();

      // Open step 3 (set_fields) in the wide DraftModal and run 按名称匹配.
      const modalButtons = screen.getAllByRole("button", { name: "弹窗编辑步骤" });
      await user.click(modalButtons[2] as HTMLElement);

      const dialog = await screen.findByRole("dialog");
      // Two prior steps declare fields (selected + result), so clicking opens dropdown.
      await user.click(within(dialog).getByRole("button", { name: /按名称匹配/ }));
      await user.click(await screen.findByText(/步骤 2 · 职员查询 · 选中记录/));

      // The rule's own field (工号) is left out although the step declares it.
      expect(within(dialog).getByRole("status")).toHaveTextContent(/已按名称匹配并新增 3 项写入/);
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      const afterMatch = onCommit.mock.calls.at(-1)?.[0] as FieldLinkage;
      const setFieldsAction = afterMatch.rules?.[0]?.actions[2];
      expect(setFieldsAction).toMatchObject({
        type: "set_fields",
        assignments: [
          { targetKey: "name", value: { kind: "reference", path: "$steps.selected.name" } },
          { targetKey: "phone", value: { kind: "reference", path: "$steps.selected.phoneNumber" } },
          { targetKey: "gender", value: { kind: "reference", path: "$steps.selected.gender" } }
        ]
      });

      // Expand step 2 (select_record) and check auto-inferred columns preview.
      await user.click(screen.getByRole("button", { name: /选择记录 · result → selected/ }));
      expect(screen.getByText("留空时展示后续步骤引用的列：姓名、手机号、性别")).toBeInTheDocument();

      // Rename step 1's output in modal and verify step 2's source follows automatically.
      const updatedModalButtons = screen.getAllByRole("button", { name: "弹窗编辑步骤" });
      await user.click(updatedModalButtons[0] as HTMLElement);
      const apiDialog = await screen.findByRole("dialog");
      const outputInput = within(apiDialog).getByLabelText("结果名");
      await user.clear(outputInput);
      await user.type(outputInput, "staffList");
      await user.click(within(apiDialog).getByRole("button", { name: "确定" }));

      const afterRename = onCommit.mock.calls.at(-1)?.[0] as FieldLinkage;
      expect(afterRename.rules?.[0]?.actions[0]).toMatchObject({ type: "api_call", output: "staffList" });
      expect(afterRename.rules?.[0]?.actions[1]).toMatchObject({
        type: "select_record",
        source: { kind: "reference", path: "$steps.staffList" }
      });
    });

    it("renders typed literal controls in set_fields for number, switch, and static select targets", () => {
      render(
        <StatefulLinkageHarness
          initialLinkage={{
            rules: [
              {
                id: "R1",
                trigger: { kind: "commit" },
                actions: [
                  {
                    id: "A1",
                    type: "set_fields",
                    assignments: [
                      { targetKey: "age", value: { kind: "literal", value: 28 } },
                      { targetKey: "active", value: { kind: "literal", value: true } },
                      { targetKey: "gender", value: { kind: "literal", value: "M" } }
                    ]
                  }
                ]
              }
            ]
          }}
        />
      );

      // Single-step rule opens expanded: number spinbutton, switch segmented, and static select.
      expect(screen.getByRole("spinbutton")).toHaveValue("28");
      expect(screen.getByText("开启")).toBeInTheDocument();
      expect(screen.getByText("男")).toBeInTheDocument();
    });

    it("warns before deleting a step referenced by later steps", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();
      const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);

      try {
        render(
          <StatefulLinkageHarness
            initialLinkage={{
              rules: [
                {
                  id: "R1",
                  trigger: { kind: "commit" },
                  actions: [
                    {
                      id: "A1",
                      type: "api_call",
                      request: { resource: "md/staff", action: "lookup" },
                      output: "result"
                    },
                    {
                      id: "A2",
                      type: "select_record",
                      source: { kind: "reference", path: "$steps.result" },
                      output: "selected"
                    }
                  ]
                }
              ]
            }}
            onCommit={onCommit}
          />
        );

        const deleteButtons = screen.getAllByRole("button", { name: "删除动作" });
        await user.click(deleteButtons[0] as HTMLElement);

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(onCommit).not.toHaveBeenCalled();

        confirmSpy.mockReturnValue(true);
        await user.click(deleteButtons[0] as HTMLElement);
        expect((onCommit.mock.calls.at(-1)?.[0] as FieldLinkage).rules?.[0]?.actions).toHaveLength(1);
      } finally {
        confirmSpy.mockRestore();
      }
    });

    it("starts an untouched value over when its target changes", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <StatefulLinkageHarness
          initialLinkage={{
            rules: [
              {
                id: "R1",
                trigger: { kind: "commit" },
                actions: [
                  {
                    id: "A1",
                    type: "set_fields",
                    assignments: [{ targetKey: "active", value: { kind: "literal", value: false } }]
                  }
                ]
              }
            ]
          }}
          onCommit={onCommit}
        />
      );

      await user.click(screen.getByRole("combobox", { name: "目标字段" }));
      await user.click(await screen.findByText("姓名 · name"));

      expect((onCommit.mock.calls.at(-1)?.[0] as FieldLinkage).rules?.[0]?.actions[0]).toMatchObject({
        assignments: [{ targetKey: "name", value: { kind: "literal", value: "" } }]
      });
    });

    it("marks stored api_call with 当前宿主不支持 when request service is unwired", async () => {
      const user = userEvent.setup();

      render(
        <StatefulLinkageHarness
          hasRequest={false}
          initialLinkage={{
            rules: [
              {
                id: "R1",
                trigger: { kind: "commit" },
                actions: [
                  {
                    id: "A1",
                    type: "api_call",
                    request: { resource: "md/staff", action: "lookup" },
                    output: "result"
                  }
                ]
              }
            ]
          }}
        />
      );

      expect(screen.getByText("当前宿主不支持")).toBeInTheDocument();
      expect(screen.getByText(/当前宿主未接入接口调用，执行到此步骤会失败/)).toBeInTheDocument();

      // Still editable: changing onError works and updates the badge.
      const onErrorSelect = screen.getByLabelText("失败处理");
      await user.click(onErrorSelect);
      await user.click(await screen.findByText("忽略失败，继续后续步骤"));
      expect(screen.getByText("失败继续")).toBeInTheDocument();
    });
  });

  describe("moving a step", () => {
    const HANDLES = { name: /^拖动排序步骤/ };

    function shownSteps(): string[] {
      return screen.getAllByRole("button", HANDLES).map(handle => handle.getAttribute("aria-label") as string);
    }

    async function dragFirstStepLast(): Promise<void> {
      await dragSortableRow({
        handles: screen.getAllByRole("button", HANDLES),
        from: 0,
        to: 1
      });
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("shows the steps in their own order again once a move that breaks references is declined", async () => {
      const onCommit = vi.fn();
      const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);

      render(<StatefulLinkageHarness initialLinkage={dependentSteps()} onCommit={onCommit} />);
      await dragFirstStepLast();

      expect(confirmSpy).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("步骤 1 引用了结果「result」，它要到步骤 2 才产生"));
      expect(onCommit).not.toHaveBeenCalled();
      expect(shownSteps()).toEqual(["拖动排序步骤 1", "拖动排序步骤 2"]);
      expect(summaries()).toEqual([expect.stringContaining("调用接口"), expect.stringContaining("选择记录")]);
    });

    it("moves the step once the move is confirmed", async () => {
      const onCommit = vi.fn();

      vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      render(<StatefulLinkageHarness initialLinkage={dependentSteps()} onCommit={onCommit} />);
      await dragFirstStepLast();

      expect((onCommit.mock.calls.at(-1)?.[0] as FieldLinkage).rules?.[0]?.actions.map(action => action.id)).toEqual(["A2", "A1"]);
      expect(summaries()).toEqual([expect.stringContaining("选择记录"), expect.stringContaining("调用接口")]);
    });

    it("shows the steps as committed where they came without ids", async () => {
      const onCommit = vi.fn();

      vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      render(<StatefulLinkageHarness initialLinkage={dependentSteps(false)} onCommit={onCommit} />);
      await dragFirstStepLast();

      expect((onCommit.mock.calls.at(-1)?.[0] as FieldLinkage).rules?.[0]?.actions.map(action => action.type)).toEqual([
        "select_record",
        "api_call"
      ]);
      expect(summaries()).toEqual([expect.stringContaining("选择记录"), expect.stringContaining("调用接口")]);
    });
  });

  describe("diagnostic jump", () => {
    const lookupRules: FieldLinkage = {
      rules: [
        {
          id: "R1",
          trigger: { kind: "commit" },
          actions: [
            {
              id: "A1",
              type: "api_call",
              request: { resource: "md/staff", action: "lookup" },
              output: "result"
            },
            {
              id: "A2",
              type: "set_fields",
              assignments: [{ targetKey: "", value: { kind: "literal", value: "" } }]
            }
          ]
        },
        alertRule("R2", "1")
      ]
    };

    it("opens the 联动 tab and expands the step", async () => {
      renderPanel(lookupRules, {
        nodeId: "Field_code",
        ruleIndex: 0,
        actionIndex: 1
      });

      expect(await screen.findByText("选择目标字段")).toBeInTheDocument();
    });

    it("leaves the step alone once it has been shown", async () => {
      const user = userEvent.setup();
      const scroll = vi.spyOn(Element.prototype, "scrollIntoView");

      renderPanel(lookupRules, {
        nodeId: "Field_code",
        ruleIndex: 0,
        actionIndex: 1
      });

      await user.click(await screen.findByRole("button", { name: /设置字段/ }));
      scroll.mockClear();
      await user.click(screen.getByRole("button", { name: /调用接口/ }));
      await user.click(within(screen.getByRole("group", { name: "规则 1" })).getByLabelText("失败处理"));
      await user.click(await screen.findByText("忽略失败，继续后续步骤"));

      expect(screen.getByText("失败继续")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /设置字段/ })).toHaveAttribute("aria-expanded", "false");
      expect(scroll).not.toHaveBeenCalled();
    });

    it("scrolls a rule into view when the issue names no step", async () => {
      const scroll = vi.spyOn(Element.prototype, "scrollIntoView");

      renderPanel(lookupRules, { nodeId: "Field_code", ruleIndex: 1 });

      const card = await screen.findByRole("group", { name: "规则 2" });

      await waitFor(() => expect(scroll.mock.contexts).toContain(card));
    });
  });

  describe("editing one rule", () => {
    it("renders no other rule again", async () => {
      const user = userEvent.setup();

      renderPanel({ rules: [alertRule("R1", "first"), alertRule("R2", "second")] }, { nodeId: "Field_code", ruleIndex: 0 });

      const card = await screen.findByRole("group", { name: "规则 1" });
      const [editor] = within(card).getAllByLabelText("mock-code-editor");

      codeEditorRender.mockClear();
      await user.type(editor as HTMLElement, "!");

      await waitFor(() => expect(codeEditorRender).toHaveBeenCalledWith("first!"));
      expect(codeEditorRender).not.toHaveBeenCalledWith("second");
    });
  });
});
