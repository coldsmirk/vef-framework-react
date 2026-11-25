import type * as ComponentsModule from "@vef-framework-react/components";
import type { CodeEditorProps } from "@vef-framework-react/components";
import type { DragEndEvent } from "@vef-framework-react/core";
import type { ChangeEvent, ReactElement } from "react";

import type {
  DataSourceApi,
  FieldLinkage,
  FormField,
  FormSchema,
  LinkageContextSource,
  NumberField,
  SelectField,
  SwitchField,
  TextareaField,
  TextfieldField,
  UploadField
} from "../../../../types";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../../../../engine/registry/defaults";
import { RegistryProvider } from "../../../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../../../store/form-store";
import { definePropertyEntry } from "../../../../types";
import { ContextSourcesProvider } from "../../../context-sources";
import { DataSourceApisProvider } from "../../../data-source-apis";
import { PreviewRuntimeProvider } from "../../../preview-runtime-context";
import { PropertiesPanel } from "../../properties-panel";
import { reorderActions } from "./actions-editor";
import { commitHintForField, LinkageRulesEntry } from "./linkage-rules-entry";
import { createActionFor, switchRuleTrigger } from "./mutators";

function CodeEditor(props: CodeEditorProps): ReactElement {
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

function FocusDispatcher(): ReactElement {
  const api = useFormEditorStoreApi();

  useEffect(() => {
    api.getState().requestLinkageFocus({
      scope: "node",
      nodeId: "Field_code",
      ruleIndex: 0,
      actionIndex: 1
    });
  }, [api]);

  return <PropertiesPanel />;
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
        </ContextSourcesProvider>
      </DataSourceApisProvider>
    </PreviewRuntimeProvider>
  );
}

describe("action sequence designer", () => {
  describe("control-specific commit hints and event guards", () => {
    it("tailors commit trigger hints to each control type", () => {
      const textfield: TextfieldField = {
        id: "F1",
        type: "textfield",
        key: "k1"
      };
      const textarea: TextareaField = {
        id: "F2",
        type: "textarea",
        key: "k2"
      };
      const select: SelectField = {
        id: "F3",
        type: "select",
        key: "k3",
        dataSource: { kind: "static", options: [] }
      };
      const sw: SwitchField = {
        id: "F4",
        type: "switch",
        key: "k4"
      };
      const upload: UploadField = {
        id: "F5",
        type: "upload",
        key: "k5"
      };

      expect(commitHintForField(textfield, undefined)).toBe("按回车或离开输入框且内容变化时触发");
      expect(commitHintForField(textarea, undefined)).toBe("离开输入框且内容变化时触发");
      expect(commitHintForField(select, undefined)).toBe("每次选择后触发");
      expect(commitHintForField(sw, undefined)).toBe("切换开关状态后触发");
      expect(commitHintForField(upload, undefined)).toBe("文件变更后触发");
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

      expect(screen.getByText("按回车或离开输入框且内容变化时触发")).toBeInTheDocument();

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

      expect(within(dialog).getByRole("status")).toHaveTextContent(/已按名称匹配并新增 4 项写入/);
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      const afterMatch = onCommit.mock.calls.at(-1)?.[0] as FieldLinkage;
      const setFieldsAction = afterMatch.rules?.[0]?.actions[2];
      expect(setFieldsAction).toMatchObject({
        type: "set_fields",
        assignments: [
          { targetKey: "number", value: { kind: "reference", path: "$steps.selected.number" } },
          { targetKey: "name", value: { kind: "reference", path: "$steps.selected.name" } },
          { targetKey: "phone", value: { kind: "reference", path: "$steps.selected.phoneNumber" } },
          { targetKey: "gender", value: { kind: "reference", path: "$steps.selected.gender" } }
        ]
      });

      // Expand step 2 (select_record) and check auto-inferred columns preview.
      await user.click(screen.getByRole("button", { name: /选择记录 · result → selected/ }));
      expect(screen.getByText(/当前留空，多条记录时将自动展示后续写入引用的列：工号、姓名、手机号、性别/)).toBeInTheDocument();

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

    it("reorders actions via pure reorderActions helper", () => {
      const actions = [
        { id: "A1", type: "submit" as const },
        { id: "A2", type: "reset" as const }
      ];
      const event = {
        canceled: false,
        operation: {
          source: { id: "A2" },
          target: { id: "A1" }
        }
      } as unknown as DragEndEvent;

      expect(reorderActions(actions, event)?.map(item => item.id)).toEqual(["A2", "A1"]);
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
      expect(screen.getByText(/当前宿主未接入接口调用服务/)).toBeInTheDocument();

      // Still editable: changing onError works and updates the badge.
      const onErrorSelect = screen.getByLabelText("失败处理");
      await user.click(onErrorSelect);
      await user.click(await screen.findByText("忽略错误继续后续动作"));
      expect(screen.getByText("失败继续")).toBeInTheDocument();
    });
  });

  describe("diagnostic jump to exact linkage step", () => {
    it("switches the properties panel to 联动 tab and expands the targeted action step", async () => {
      const schema = makeStaffSchema({
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
          }
        ]
      });

      render(
        <PreviewRuntimeProvider value={{ serviceCapabilities: { hasRequest: true, hasNavigate: true } }}>
          <RegistryProvider registries={{ pc: createDefaultRegistry(), mobile: createDefaultRegistry() }}>
            <FormEditorStoreProvider initialState={{ schema }}>
              <FocusDispatcher />
            </FormEditorStoreProvider>
          </RegistryProvider>
        </PreviewRuntimeProvider>
      );

      // The lazy LinkageRulesEntry mounts, switches to the 联动 tab, and
      // automatically expands step 2 (set_fields), exposing its target picker.
      expect(await screen.findByText("选择目标字段")).toBeInTheDocument();
    });
  });
});
