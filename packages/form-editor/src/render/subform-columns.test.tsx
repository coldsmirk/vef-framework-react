import type { Block, DataSourceResolver, FieldOption, FormSchema } from "../types";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";
import { buildSubformColumns } from "./subform-columns";

function renderForm(
  schema: FormSchema,
  options: {
    dataSourceResolver?: DataSourceResolver;
    defaultValues?: Record<string, unknown>;
    evaluationContext?: { applicant?: { departmentId?: string } };
    onSubmit?: (values: Record<string, unknown>) => void;
    renderFieldExtra?: Parameters<typeof FormRenderer>[0]["renderFieldExtra"];
  } = {}
) {
  const registry = createDefaultRegistry();

  return render(
    <RegistryProvider registries={{ pc: registry, mobile: registry }}>
      <FormRenderer
        dataSourceResolver={options.dataSourceResolver}
        defaultValues={options.defaultValues}
        evaluationContext={options.evaluationContext}
        renderFieldExtra={options.renderFieldExtra}
        schema={schema}
        onSubmit={options.onSubmit}
      />
    </RegistryProvider>
  );
}

/**
 * A table subform whose single column is a searchable select — the runtime
 * surface behind the `select` case of {@link buildSubformColumns}.
 */
function selectColumnSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Subform_lines",
            type: "subform",
            variant: "table",
            key: "lines",
            label: "明细",
            template: [
              {
                id: "Field_city",
                type: "select",
                key: "city",
                label: "城市",
                showSearch: true,
                dataSource: {
                  kind: "static",
                  options: [
                    { label: "北京", value: "bj" },
                    { label: "上海", value: "sh" }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  };
}

describe("buildSubformColumns", () => {
  it("maps keyed leaf fields to columns in document order", () => {
    const template: Block[] = [
      {
        id: "F1",
        type: "textfield",
        key: "name",
        label: "姓名"
      },
      {
        id: "F2",
        type: "number",
        key: "qty",
        label: "数量"
      }
    ];

    const columns = buildSubformColumns(template);

    expect(columns).toHaveLength(2);
    expect(columns[0]).toMatchObject({ dataIndex: "name", title: "姓名" });
    expect(columns[1]).toMatchObject({ dataIndex: "qty", title: "数量" });
  });

  it("falls back to the field key for a column title when the label is unset", () => {
    const columns = buildSubformColumns([
      {
        id: "F1",
        type: "textfield",
        key: "code"
      }
    ]);

    expect(columns[0]).toMatchObject({ dataIndex: "code", title: "code" });
  });

  it("drops a non-keyed presentation / action block", () => {
    const template: Block[] = [
      {
        id: "F1",
        type: "textfield",
        key: "name",
        label: "姓名"
      },
      {
        id: "B1",
        type: "button",
        label: "提交",
        action: "submit"
      }
    ];

    const columns = buildSubformColumns(template);

    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({ dataIndex: "name" });
  });

  it("drops a nested container block", () => {
    const template: Block[] = [
      {
        id: "F1",
        type: "textfield",
        key: "name",
        label: "姓名"
      },
      {
        id: "S1",
        type: "section",
        variant: "card",
        title: "区块",
        children: []
      }
    ];

    expect(buildSubformColumns(template)).toHaveLength(1);
  });

  it("renders a column for every supported keyed leaf type", () => {
    const template: Block[] = [
      {
        id: "F1",
        type: "textfield",
        key: "a"
      },
      {
        id: "F2",
        type: "textarea",
        key: "b"
      },
      {
        id: "F3",
        type: "number",
        key: "c"
      },
      {
        id: "F4",
        type: "select",
        key: "d",
        dataSource: { kind: "static", options: [] }
      },
      {
        id: "F5",
        type: "switch",
        key: "e"
      },
      {
        id: "F6",
        type: "date",
        key: "f"
      }
    ];

    expect(buildSubformColumns(template)).toHaveLength(6);
  });

  it("forwards a field's fixed columnWidth to the table column", () => {
    const columns = buildSubformColumns([
      {
        id: "F1",
        type: "textfield",
        key: "name",
        label: "姓名",
        columnWidth: 200
      }
    ]);

    expect(columns[0]).toMatchObject({ dataIndex: "name", width: 200 });
  });

  it("leaves the column width unset when the field has no columnWidth", () => {
    const columns = buildSubformColumns([
      {
        id: "F1",
        type: "textfield",
        key: "name",
        label: "姓名"
      }
    ]);

    expect(columns[0]?.width).toBeUndefined();
  });

  it("prepends a read-only row-header column for fixedRows with default title fallback", () => {
    const columns = buildSubformColumns(
      [
        {
          id: "F1",
          type: "textfield",
          key: "note",
          label: "说明"
        }
      ],
      {
        fixedRows: {
          mode: "fixed",
          itemKey: "item",
          headerWidth: 240,
          source: { kind: "static", options: [{ label: "第一项", value: "a" }] }
        }
      }
    );

    expect(columns).toHaveLength(2);
    expect(columns[0]).toMatchObject({
      dataIndex: "item",
      title: "检查项",
      width: 240,
      editable: false
    });
    expect(columns[1]).toMatchObject({ dataIndex: "note", title: "说明" });
  });
});

describe("subform table runtime behavior", () => {
  it("filters the select cell dropdown by the option label and shows default placeholder", async () => {
    const user = userEvent.setup();
    renderForm(selectColumnSchema());

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    expect(screen.getByText("请选择")).toBeInTheDocument();

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.type(combobox, "北京");

    expect(await screen.findByRole("option", { name: "北京" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "上海" })).not.toBeInTheDocument();
  });

  it("outlines a required select cell in error when the row is saved empty", async () => {
    const user = userEvent.setup();
    const schema = selectColumnSchema();
    const subform = schema.presentations.pc.children[0] as Extract<Block, { type: "subform" }>;
    subform.template = [{ ...subform.template[0], validate: { required: true } } as Block];
    const registry = createDefaultRegistry();
    // The failed save reports through the imperative message helper, which
    // the components ConfigProvider initializes.
    render(
      <ConfigProvider>
        <RegistryProvider registries={{ pc: registry, mobile: registry }}>
          <FormRenderer schema={schema} />
        </RegistryProvider>
      </ConfigProvider>
    );

    await user.click(screen.getByRole("button", { name: /新增一行/ }));
    // antd exposes `status` only as a class on the select root; its prefix
    // depends on the ConfigProvider, so match the documented suffix.
    const select = screen.getByRole("combobox").closest("[class*='-select ']");

    expect(select?.className).not.toMatch(/-select-status-error/);

    await user.click(screen.getByRole("button", { name: /保\s*存/ }));

    await waitFor(() => expect(select?.className).toMatch(/-select-status-error/));
  });

  it("honors dynamic rows.addLabel on the runtime table add button", async () => {
    const user = userEvent.setup();
    const schema: FormSchema = {
      id: "Form_add_label",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_dyn",
              type: "subform",
              variant: "table",
              key: "extra",
              label: "其他问题",
              rows: { mode: "dynamic", addLabel: "新增问题" },
              template: [
                {
                  id: "C_title",
                  type: "textfield",
                  key: "title",
                  label: "问题"
                },
                {
                  id: "C_month",
                  type: "date",
                  key: "foundMonth",
                  label: "发现月份",
                  granularity: "month"
                }
              ]
            }
          ]
        }
      }
    };

    renderForm(schema);

    expect(screen.queryByRole("button", { name: /新增记录/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /新增问题/ }));

    expect(screen.getByPlaceholderText("请选择月份")).toBeInTheDocument();
  });

  it("displays required markers on required column headers, including alongside renderFieldExtra", () => {
    const schema: FormSchema = {
      id: "Form_req",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_req",
              type: "subform",
              variant: "table",
              key: "checks",
              label: "自查",
              template: [
                {
                  id: "C_req",
                  type: "textfield",
                  key: "problem",
                  label: "存在问题",
                  validate: { required: true }
                },
                {
                  id: "C_opt",
                  type: "textfield",
                  key: "note",
                  label: "备注"
                }
              ]
            }
          ]
        }
      }
    };

    const { unmount } = renderForm(schema);

    const reqHeader = screen.getByRole("columnheader", { name: "存在问题" });
    const optHeader = screen.getByRole("columnheader", { name: "备注" });

    expect(within(reqHeader).getByText("*")).toHaveAttribute("aria-hidden", "true");
    expect(within(optHeader).queryByText("*")).not.toBeInTheDocument();

    unmount();

    renderForm(schema, {
      renderFieldExtra: ({ column, row }) => column === "problem" && row === undefined ? <span>批注(1)</span> : null
    });

    const withExtraHeader = screen.getByRole("columnheader", { name: /存在问题/ });

    expect(within(withExtraHeader).getByText("*")).toBeInTheDocument();
    expect(within(withExtraHeader).getByText("批注(1)")).toBeInTheDocument();
  });

  it("resolves ref (static & remote) and inline remote option sources in table columns and displays labels after save", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const resolve = vi.fn((req: { resource: string }): Promise<FieldOption[]> => {
      if (req.resource === "sys/role") {
        return Promise.resolve([
          { label: "管理员", value: "admin" },
          { label: "审计员", value: "auditor" }
        ]);
      }

      if (req.resource === "sys/tag") {
        return Promise.resolve([
          { label: "紧急", value: "urgent" },
          { label: "常规", value: "normal" }
        ]);
      }

      return Promise.resolve([]);
    });

    const schema: FormSchema = {
      id: "Form_sources",
      version: 2,
      dataSources: [
        {
          id: "DS_status",
          name: "状态",
          kind: "static",
          options: [
            { label: "正常", value: "ok" },
            { label: "异常", value: "err" }
          ]
        },
        {
          id: "DS_roles",
          name: "角色",
          kind: "remote",
          request: { resource: "sys/role", action: "find_options" }
        }
      ],
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_tbl",
              type: "subform",
              variant: "table",
              key: "items",
              label: "核查明细",
              template: [
                {
                  id: "C_status",
                  type: "radio",
                  key: "status",
                  label: "状态",
                  dataSource: { kind: "ref", dataSourceId: "DS_status" }
                },
                {
                  id: "C_role",
                  type: "select",
                  key: "role",
                  label: "责任角色",
                  dataSource: { kind: "ref", dataSourceId: "DS_roles" }
                },
                {
                  id: "C_tags",
                  type: "checkbox-group",
                  key: "tags",
                  label: "标签",
                  dataSource: {
                    kind: "remote",
                    request: { resource: "sys/tag", action: "find_options" }
                  }
                }
              ]
            },
            {
              id: "Btn_submit",
              type: "button",
              label: "提交",
              action: "submit"
            }
          ]
        }
      }
    };

    renderForm(schema, { dataSourceResolver: { resolve }, onSubmit });

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    // Static ref radio, remote ref select, and inline remote checkbox-group all populate.
    await user.click(await screen.findByRole("radio", { name: "异常" }));
    await user.click(await screen.findByRole("checkbox", { name: "紧急" }));

    const roleCombobox = screen.getByRole("combobox");
    await user.click(roleCombobox);
    await user.click(await screen.findByText("审计员"));

    await user.click(screen.getByRole("button", { name: /保\s*存/ }));

    // Saved read mode shows resolved labels instead of raw values.
    expect(await screen.findByText("异常")).toBeInTheDocument();
    expect(screen.getByText("审计员")).toBeInTheDocument();
    expect(screen.getByText("紧急")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        items: [
          {
            status: "err",
            role: "auditor",
            tags: ["urgent"]
          }
        ]
      });
    });
  });

  it("evaluates bound remote params against live in-row fields and host context", async () => {
    const user = userEvent.setup();
    const resolve = vi.fn((req: { params?: Record<string, unknown> }): Promise<FieldOption[]> => {
      if (req.params?.dept === "D1") {
        return Promise.resolve([{ label: "一病区", value: "W1" }]);
      }

      if (req.params?.dept === "D2") {
        return Promise.resolve([{ label: "二病区", value: "W2" }]);
      }

      return Promise.resolve([]);
    });

    const schema: FormSchema = {
      id: "Form_cascade",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_tbl",
              type: "subform",
              variant: "table",
              key: "lines",
              label: "科室病区",
              template: [
                {
                  id: "C_dept",
                  type: "textfield",
                  key: "dept",
                  label: "科室编码"
                },
                {
                  id: "C_ward",
                  type: "select",
                  key: "ward",
                  label: "病区",
                  dataSource: {
                    kind: "remote",
                    request: {
                      resource: "hosp/ward",
                      action: "find_options",
                      params: {
                        dept: { kind: "expression", source: "$form.dept" },
                        applicantDept: { kind: "expression", source: "$applicant.departmentId" }
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    };

    renderForm(schema, {
      dataSourceResolver: { resolve },
      evaluationContext: { applicant: { departmentId: "dept-hq" } }
    });

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    const deptInput = screen.getByRole("textbox");
    await user.type(deptInput, "D1");

    await waitFor(() => {
      expect(resolve).toHaveBeenCalledWith(
        {
          resource: "hosp/ward",
          action: "find_options",
          params: { dept: "D1", applicantDept: "dept-hq" }
        },
        undefined
      );
    });

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "一病区" })).toBeInTheDocument();

    // Editing the sibling in-row field live-cascades before clicking Save.
    await user.clear(deptInput);
    await user.type(deptInput, "D2");

    await waitFor(() => {
      expect(resolve).toHaveBeenCalledWith(
        {
          resource: "hosp/ward",
          action: "find_options",
          params: { dept: "D2", applicantDept: "dept-hq" }
        },
        undefined
      );
    });

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("二病区"));
    await user.click(screen.getByRole("button", { name: /保\s*存/ }));

    expect(await screen.findByText("二病区")).toBeInTheDocument();
  });

  it("preserves numeric option values without string coercion across select, multi-select, radio, and checkbox-group", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema: FormSchema = {
      id: "Form_numeric_opts",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_num",
              type: "subform",
              variant: "table",
              key: "scores",
              label: "评分表",
              template: [
                {
                  id: "C_level",
                  type: "select",
                  key: "level",
                  label: "等级",
                  dataSource: {
                    kind: "static",
                    options: [
                      { label: "零级", value: 0 },
                      { label: "一级", value: 1 }
                    ]
                  }
                },
                {
                  id: "C_levels",
                  type: "multi-select",
                  key: "levels",
                  label: "关联项",
                  dataSource: {
                    kind: "static",
                    options: [
                      { label: "十", value: 10 },
                      { label: "二十", value: 20 }
                    ]
                  }
                },
                {
                  id: "C_pass",
                  type: "radio",
                  key: "pass",
                  label: "结论",
                  dataSource: {
                    kind: "static",
                    options: [
                      { label: "通过", value: 1 },
                      { label: "不通过", value: 2 }
                    ]
                  }
                },
                {
                  id: "C_flags",
                  type: "checkbox-group",
                  key: "flags",
                  label: "标记",
                  dataSource: {
                    kind: "static",
                    options: [
                      { label: "甲", value: 100 },
                      { label: "乙", value: 200 }
                    ]
                  }
                }
              ]
            },
            {
              id: "Btn_submit",
              type: "button",
              label: "提交",
              action: "submit"
            }
          ]
        }
      }
    };

    renderForm(schema, { onSubmit });

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    const comboboxes = screen.getAllByRole("combobox");
    await user.click(comboboxes[0] as HTMLElement);
    await user.click(await screen.findByText("零级"));

    await user.click(comboboxes[1] as HTMLElement);
    await user.click(await screen.findByText("十"));
    await user.click(screen.getByText("二十"));

    await user.click(screen.getByRole("radio", { name: "不通过" }));
    await user.click(screen.getByRole("checkbox", { name: "乙" }));

    await user.click(screen.getByRole("button", { name: /保\s*存/ }));

    // Read mode displays labels for numeric values too.
    expect(await screen.findByText("零级")).toBeInTheDocument();
    expect(screen.getByText("十、二十")).toBeInTheDocument();
    expect(screen.getByText("不通过")).toBeInTheDocument();
    expect(screen.getByText("乙")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        scores: [
          {
            level: 0,
            levels: [10, 20],
            pass: 2,
            flags: [200]
          }
        ]
      });
    });
  });
});
