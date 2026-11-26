import type * as ComponentsModule from "@vef-framework-react/components";
import type { CodeEditorProps } from "@vef-framework-react/components";
import type { ChangeEvent, ReactElement } from "react";

import type { FormEditorStoreApi, LinkageFocusRef } from "../../../../store/form-store";
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

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";
import { Profiler, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dragSortableRow } from "../../../../../test-utils";
import { createDefaultRegistry } from "../../../../engine/registry/defaults";
import { RegistryProvider } from "../../../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../../../store/form-store";
import { definePropertyEntry } from "../../../../types";
import { ContextSourcesProvider } from "../../../context-sources";
import { DataSourceApisProvider } from "../../../data-source-apis";
import { PreviewRuntimeProvider } from "../../../preview-runtime-context";
import { PropertiesPanel } from "../../properties-panel";
import { commitHintForField, LinkageRulesEntry } from "./linkage-rules-entry";
import { createActionFor, switchRuleTrigger } from "./mutators";

/**
 * The dialog opened last, which sits on top: a confirmation raised from inside
 * the rule dialog has buttons of the same names as the rule dialog's own.
 */
function topDialog(): HTMLElement {
  const dialogs = screen.getAllByRole("dialog");
  const top = dialogs.at(-1);

  if (top === undefined) {
    throw new Error("No dialog is open");
  }

  return top;
}

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
function renderPanel(
  linkage: FieldLinkage | undefined,
  focus: LinkageFocusRef,
  formLinkage?: FieldLinkage
): void {
  render(
    <ConfigProvider>
      <PreviewRuntimeProvider value={{ serviceCapabilities: { hasRequest: true, hasNavigate: true } }}>
        <DataSourceApisProvider apis={DEFAULT_APIS}>
          <RegistryProvider registries={REGISTRIES}>
            <FormEditorStoreProvider initialState={{ schema: makeStaffSchema(linkage, formLinkage) }}>
              <FocusDispatcher focus={focus} />
            </FormEditorStoreProvider>
          </RegistryProvider>
        </DataSourceApisProvider>
      </PreviewRuntimeProvider>
    </ConfigProvider>
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

function makeStaffSchema(codeLinkage?: FieldLinkage, formLinkage?: FieldLinkage): FormSchema {
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
    ...formLinkage && { linkage: formLinkage },
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
    <ConfigProvider>
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
    </ConfigProvider>
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
 * The steps' summaries as they stand inside the open dialog.
 */
function summaries(container: HTMLElement): string[] {
  return within(container).getAllByText(/^(?:调用接口|选择记录) · /).map(element => element.textContent);
}

async function openFirstRule(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: "编辑规则 1" }));

  return screen.findByRole("dialog");
}

beforeEach(() => {
  codeEditorRender.mockClear();
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

    it("adds, edits, and removes a when guard on an event trigger inside the dialog", async () => {
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

      const dialog = await openFirstRule(user);
      expect(within(dialog).getByText("按回车，或离开输入框且内容变化时触发")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: /添加执行条件/ }));
      expect(within(dialog).getByText("仅在满足条件时执行")).toBeInTheDocument();
      // Nothing written until 确定.
      expect(onCommit).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "确定" }));
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

      const reopened = await openFirstRule(user);
      await user.click(within(reopened).getByRole("button", { name: "移除条件" }));
      await user.click(within(reopened).getByRole("button", { name: "确定" }));
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
    it("opens 查询并回填 in the dialog and commits only on confirm", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      const { unmount } = render(<StatefulLinkageHarness hasRequest onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /模板/ }));
      await user.click(await screen.findByText("查询并回填"));

      let dialog = await screen.findByRole("dialog", { name: "新建联动规则" });
      expect(onCommit).not.toHaveBeenCalled();

      // Multi-step sequence starts collapsed with plain-Chinese summaries inside the dialog.
      expect(within(dialog).getByText(/调用接口 · 未选择接口 → result/)).toBeInTheDocument();
      expect(within(dialog).getByText(/选择记录 · result → selected/)).toBeInTheDocument();
      expect(within(dialog).getByText(/设置字段 · 未配置写入项/)).toBeInTheDocument();

      // Cancelling inserts nothing.
      await user.click(within(dialog).getByRole("button", { name: "取消" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "新建联动规则" })).not.toBeInTheDocument();
      });
      expect(onCommit).not.toHaveBeenCalled();

      // Re-opening via template and confirming commits the rule and renders its compact row.
      await user.click(screen.getByRole("button", { name: /模板/ }));
      await user.click(await screen.findByText("查询并回填"));
      dialog = await screen.findByRole("dialog", { name: "新建联动规则" });
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

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

      expect(screen.getByText("工号 输入完成时 · 工号 不为空")).toBeInTheDocument();
      expect(screen.getByText("3 个步骤：调用接口 → 选择记录 → 设置字段")).toBeInTheDocument();

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

  describe("step outputs, in-place complex editing, select_record, and set_fields matching", () => {
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

    it("edits complex steps in place with no second dialog, runs 按名称匹配, previews inferred columns, and propagates output renames", async () => {
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

      const dialog = await openFirstRule(user);

      // Single dialog layer: no nested "弹窗编辑步骤" button.
      expect(within(dialog).queryByRole("button", { name: "弹窗编辑步骤" })).not.toBeInTheDocument();
      expect(within(dialog).getByText("调用接口 · 职员查询 → result")).toBeInTheDocument();

      // Expand step 3 (set_fields) in place and run 按名称匹配.
      await user.click(within(dialog).getByRole("button", { name: /设置字段 · 未配置写入项/ }));
      expect(screen.getAllByRole("dialog")).toHaveLength(1);

      await user.click(within(dialog).getByRole("button", { name: /按名称匹配/ }));
      await user.click(await screen.findByText(/步骤 2 · 职员查询 · 选中记录/));

      // The rule's own field (工号) is left out although the step declares it.
      expect(within(dialog).getByRole("status")).toHaveTextContent(/已按名称匹配并新增 3 项写入/);

      // Expand step 2 (select_record) in place and check auto-inferred columns preview.
      await user.click(within(dialog).getByRole("button", { name: /选择记录 · result → selected/ }));
      expect(within(dialog).getByText("留空时展示后续步骤引用的列：姓名、手机号、性别")).toBeInTheDocument();

      // Expand step 1 (api_call) in place, rename its output, and save the whole rule at once.
      await user.click(within(dialog).getByRole("button", { name: /调用接口 · 职员查询 → result/ }));
      const outputInput = within(dialog).getByDisplayValue("result");
      await user.clear(outputInput);
      await user.type(outputInput, "staffList");

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(onCommit).toHaveBeenCalledTimes(1);
      const afterSave = onCommit.mock.calls.at(-1)?.[0] as FieldLinkage;
      expect(afterSave.rules?.[0]?.actions[0]).toMatchObject({ type: "api_call", output: "staffList" });
      expect(afterSave.rules?.[0]?.actions[1]).toMatchObject({
        type: "select_record",
        source: { kind: "reference", path: "$steps.staffList" }
      });
      expect(afterSave.rules?.[0]?.actions[2]).toMatchObject({
        type: "set_fields",
        assignments: [
          { targetKey: "name", value: { kind: "reference", path: "$steps.selected.name" } },
          { targetKey: "phone", value: { kind: "reference", path: "$steps.selected.phoneNumber" } },
          { targetKey: "gender", value: { kind: "reference", path: "$steps.selected.gender" } }
        ]
      });
    });

    it("blocks 确定 and focuses the offending step when a required output is blank or duplicated", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <StatefulLinkageHarness
          initialLinkage={dependentSteps()}
          onCommit={onCommit}
        />
      );

      const dialog = await openFirstRule(user);

      // Expand step 2 (select_record), clear its required output, then collapse it.
      const step2Toggle = within(dialog).getByRole("button", { name: /选择记录/ });
      await user.click(step2Toggle);
      const outputInput = within(dialog).getByDisplayValue("selected");
      await user.clear(outputInput);
      await user.click(step2Toggle);
      expect(step2Toggle).toHaveAttribute("aria-expanded", "false");

      // Clicking 确定 blocks save, re-expands step 2, and displays the alert.
      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect(onCommit).not.toHaveBeenCalled();
      expect(step2Toggle).toHaveAttribute("aria-expanded", "true");
      expect(within(dialog).getByRole("alert")).toHaveTextContent("请填写结果名，供后续步骤引用");

      // Typing a duplicate name ("result", already owned by step 1) also blocks 确定.
      await user.type(within(dialog).getByLabelText(/结果名/), "result");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect(onCommit).not.toHaveBeenCalled();
      expect(within(dialog).getByRole("alert")).toHaveTextContent("结果名「result」与本规则其它步骤重复");

      // Fixing to a unique valid name lets 确定 commit cleanly.
      const inputAgain = within(dialog).getByLabelText(/结果名/);
      await user.clear(inputAgain);
      await user.type(inputAgain, "picked");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect((onCommit.mock.calls.at(-1)?.[0] as FieldLinkage).rules?.[0]?.actions[1]).toMatchObject({
        type: "select_record",
        output: "picked"
      });
    });

    it("renders typed literal controls in set_fields for number, switch, and static select targets", async () => {
      const user = userEvent.setup();

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

      const dialog = await openFirstRule(user);
      // Single-step rule opens expanded: number spinbutton, switch segmented, and static select.
      expect(within(dialog).getByRole("spinbutton")).toHaveValue("28");
      expect(within(dialog).getByText("开启")).toBeInTheDocument();
      expect(within(dialog).getByText("男")).toBeInTheDocument();
    });

    it("warns before deleting a step referenced by later steps", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <StatefulLinkageHarness
          initialLinkage={dependentSteps()}
          onCommit={onCommit}
        />
      );

      const dialog = await openFirstRule(user);
      const deleteButtons = within(dialog).getAllByRole("button", { name: "删除动作" });
      await user.click(deleteButtons[0] as HTMLElement);

      expect(await screen.findByText(/步骤 2 引用了该步骤的结果/)).toBeInTheDocument();
      await user.click(within(topDialog()).getByRole("button", { name: "取消" }));
      await waitFor(() => {
        expect(screen.queryByText(/步骤 2 引用了该步骤的结果/)).not.toBeInTheDocument();
      });
      expect(within(dialog).getAllByRole("button", { name: "删除动作" })).toHaveLength(2);

      await user.click(within(dialog).getAllByRole("button", { name: "删除动作" })[0] as HTMLElement);
      expect(await screen.findByText(/步骤 2 引用了该步骤的结果/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "仍然删除" }));
      await waitFor(() => {
        expect(within(dialog).queryByRole("button", { name: "删除动作" })).not.toBeInTheDocument();
      });

      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect((onCommit.mock.calls.at(-1)?.[0] as FieldLinkage).rules?.[0]?.actions).toHaveLength(1);
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

      const dialog = await openFirstRule(user);
      await user.click(within(dialog).getByRole("combobox", { name: "目标字段" }));
      await user.click(await screen.findByText("姓名 · name"));
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

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

      const dialog = await openFirstRule(user);
      expect(within(dialog).getByText("当前宿主不支持")).toBeInTheDocument();
      expect(within(dialog).getByText(/当前宿主未接入接口调用，执行到此步骤会失败/)).toBeInTheDocument();

      // Still editable: changing onError works and updates the badge.
      const onErrorSelect = within(dialog).getByLabelText("失败处理");
      await user.click(onErrorSelect);
      await user.click(await screen.findByText("忽略失败，继续后续步骤"));
      expect(within(dialog).getByText("失败继续")).toBeInTheDocument();
    });
  });

  describe("moving a step inside the dialog", () => {
    const HANDLES = { name: /^拖动排序步骤/ };

    function shownSteps(dialog: HTMLElement): string[] {
      return within(dialog).getAllByRole("button", HANDLES).map(handle => handle.getAttribute("aria-label") as string);
    }

    async function dragFirstStepLast(dialog: HTMLElement): Promise<void> {
      await dragSortableRow({
        handles: within(dialog).getAllByRole("button", HANDLES),
        from: 0,
        to: 1
      });
    }

    it("shows the steps in their own order again once a move that breaks references is declined", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<StatefulLinkageHarness initialLinkage={dependentSteps()} onCommit={onCommit} />);
      const dialog = await openFirstRule(user);
      await dragFirstStepLast(dialog);

      expect(await screen.findByText(/步骤 1 引用了结果「result」，它要到步骤 2 才产生/)).toBeInTheDocument();
      await user.click(within(topDialog()).getByRole("button", { name: "取消" }));
      await waitFor(() => {
        expect(screen.queryByText(/步骤 1 引用了结果「result」，它要到步骤 2 才产生/)).not.toBeInTheDocument();
      });

      expect(onCommit).not.toHaveBeenCalled();
      expect(shownSteps(dialog)).toEqual(["拖动排序步骤 1", "拖动排序步骤 2"]);
      expect(summaries(dialog)).toEqual([expect.stringContaining("调用接口"), expect.stringContaining("选择记录")]);
    });

    it("moves the step once the move is confirmed", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<StatefulLinkageHarness initialLinkage={dependentSteps()} onCommit={onCommit} />);
      const dialog = await openFirstRule(user);
      await dragFirstStepLast(dialog);

      expect(await screen.findByText(/步骤 1 引用了结果「result」，它要到步骤 2 才产生/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "仍然移动" }));
      await waitFor(() => {
        expect(screen.queryByText(/步骤 1 引用了结果「result」，它要到步骤 2 才产生/)).not.toBeInTheDocument();
      });

      expect(summaries(dialog)).toEqual([expect.stringContaining("选择记录"), expect.stringContaining("调用接口")]);
      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect((onCommit.mock.calls.at(-1)?.[0] as FieldLinkage).rules?.[0]?.actions.map(action => action.id)).toEqual(["A2", "A1"]);
    });

    it("shows the steps as committed where they came without ids", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<StatefulLinkageHarness initialLinkage={dependentSteps(false)} onCommit={onCommit} />);
      const dialog = await openFirstRule(user);
      await dragFirstStepLast(dialog);

      expect(await screen.findByText(/步骤 1 引用了结果「result」，它要到步骤 2 才产生/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "仍然移动" }));
      await waitFor(() => {
        expect(screen.queryByText(/步骤 1 引用了结果「result」，它要到步骤 2 才产生/)).not.toBeInTheDocument();
      });

      expect(summaries(dialog)).toEqual([expect.stringContaining("选择记录"), expect.stringContaining("调用接口")]);
      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect((onCommit.mock.calls.at(-1)?.[0] as FieldLinkage).rules?.[0]?.actions.map(action => action.type)).toEqual([
        "select_record",
        "api_call"
      ]);
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

    it("opens the 联动 tab, opens the rule dialog, and expands and scrolls to the step", async () => {
      const scroll = vi.spyOn(Element.prototype, "scrollIntoView");

      renderPanel(lookupRules, {
        nodeId: "Field_code",
        ruleIndex: 0,
        actionIndex: 1
      });

      const dialog = await screen.findByRole("dialog", { name: "规则 1 · 工号" });
      expect(within(dialog).getByText("选择目标字段")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: /设置字段/ })).toHaveAttribute("aria-expanded", "true");
      await waitFor(() => expect(scroll).toHaveBeenCalled());
    });

    it("leaves the step alone once it has been shown", async () => {
      const user = userEvent.setup();
      const scroll = vi.spyOn(Element.prototype, "scrollIntoView");

      renderPanel(lookupRules, {
        nodeId: "Field_code",
        ruleIndex: 0,
        actionIndex: 1
      });

      const dialog = await screen.findByRole("dialog", { name: "规则 1 · 工号" });
      await user.click(within(dialog).getByRole("button", { name: /设置字段/ }));
      scroll.mockClear();
      await user.click(within(dialog).getByRole("button", { name: /调用接口/ }));
      await user.click(within(dialog).getByLabelText("失败处理"));
      await user.click(await screen.findByText("忽略失败，继续后续步骤"));

      expect(within(dialog).getByText("失败继续")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: /设置字段/ })).toHaveAttribute("aria-expanded", "false");
      expect(scroll).not.toHaveBeenCalled();
    });

    it("opens the rule dialog and scrolls its row when the issue names no step", async () => {
      const scroll = vi.spyOn(Element.prototype, "scrollIntoView");

      renderPanel(lookupRules, { nodeId: "Field_code", ruleIndex: 1 });

      expect(await screen.findByRole("dialog", { name: "规则 2 · 工号" })).toBeInTheDocument();
      const rows = screen.getAllByRole("listitem");
      await waitFor(() => expect(scroll.mock.contexts).toContain(rows[1]));
    });

    it("opens the 表单 tab and the form-event rule dialog for a form-level issue", async () => {
      renderPanel(undefined, {
        nodeId: null,
        ruleIndex: 0,
        actionIndex: 0
      }, {
        rules: [
          {
            id: "R_form",
            trigger: { kind: "load" },
            actions: [
              {
                id: "A_form",
                type: "set_variable",
                variable: "",
                value: { kind: "literal", value: "1" }
              }
            ]
          }
        ]
      });

      const dialog = await screen.findByRole("dialog", { name: "规则 1 · 表单事件" });
      expect(within(dialog).getByPlaceholderText("变量名")).toBeInTheDocument();
      expect(within(dialog).getByText("步骤 1：尚未填写目标变量名")).toBeInTheDocument();
    });
  });

  describe("performance", () => {
    it("mounts CodeMirror only while a rule dialog is open and ignores $vars and unrelated field changes", async () => {
      const user = userEvent.setup();
      let storeApi: FormEditorStoreApi | null = null;
      const onEntryRender = vi.fn();
      const initialSchema = makeStaffSchema({ rules: [alertRule("R1", "first"), alertRule("R2", "second")] });

      function PerfHarness(): ReactElement | null {
        const api = useFormEditorStoreApi();
        const field = useFormEditorStore(state => state.schema.presentations.pc.children[0]);

        useEffect(() => {
          storeApi = api;
        }, [api]);

        if (!field || field.type !== "textfield") {
          return null;
        }

        return (
          <Profiler id="linkage-entry" onRender={onEntryRender}>
            <LinkageRulesEntry
              entry={ENTRY}
              field={field}
              schema={initialSchema}
              onChange={value => {
                api.getState().editField({
                  fieldId: field.id,
                  updater: current => ENTRY.write(current, value as FieldLinkage | undefined)
                });
              }}
            />
          </Profiler>
        );
      }

      render(
        <ConfigProvider>
          <PreviewRuntimeProvider value={{ serviceCapabilities: { hasRequest: true, hasNavigate: true } }}>
            <DataSourceApisProvider apis={DEFAULT_APIS}>
              <RegistryProvider registries={REGISTRIES}>
                <FormEditorStoreProvider initialState={{ schema: initialSchema }}>
                  <PerfHarness />
                </FormEditorStoreProvider>
              </RegistryProvider>
            </DataSourceApisProvider>
          </PreviewRuntimeProvider>
        </ConfigProvider>
      );

      // No CodeMirror mounts for the closed compact list.
      expect(codeEditorRender).not.toHaveBeenCalled();

      // Mutating `$vars` does not re-render the closed linkage list at all.
      onEntryRender.mockClear();
      act(() => {
        storeApi!.getState().saveVariable({
          id: "Var_2",
          name: "extra",
          type: "string"
        });
      });
      expect(onEntryRender).not.toHaveBeenCalled();
      expect(codeEditorRender).not.toHaveBeenCalled();

      // Mutating an unrelated field still mounts no CodeMirror.
      act(() => {
        storeApi!.getState().editField({
          fieldId: "Field_phone",
          updater: current => {
            return { ...current, label: "联系电话" };
          }
        });
      });

      expect(codeEditorRender).not.toHaveBeenCalled();

      // Opening rule 1 mounts only rule 1's CodeMirror, never rule 2's.
      const dialog = await openFirstRule(user);
      expect(codeEditorRender).toHaveBeenCalledWith("first");
      expect(codeEditorRender).not.toHaveBeenCalledWith("second");

      codeEditorRender.mockClear();
      await user.type(within(dialog).getByLabelText("mock-code-editor"), "!");
      expect(codeEditorRender).toHaveBeenCalledWith("first!");
      expect(codeEditorRender).not.toHaveBeenCalledWith("second");
    });
  });
});
