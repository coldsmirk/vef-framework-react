import type { FieldOption, FormSchema, FormServices } from "../types";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

function renderForm(
  schema: FormSchema,
  options: {
    defaultValues?: Record<string, unknown>;
    disabled?: boolean;
    evaluationContext?: { applicant?: { departmentId?: string } };
    onSubmit?: (values: Record<string, unknown>) => void;
    renderFieldExtra?: Parameters<typeof FormRenderer>[0]["renderFieldExtra"];
    services?: FormServices;
  } = {}
) {
  const registry = createDefaultRegistry();

  return render(
    <ConfigProvider>
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>
        <FormRenderer
          defaultValues={options.defaultValues}
          disabled={options.disabled}
          evaluationContext={options.evaluationContext}
          renderFieldExtra={options.renderFieldExtra}
          schema={schema}
          services={options.services}
          onSubmit={options.onSubmit}
        />
      </RegistryProvider>
    </ConfigProvider>
  );
}

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
}

describe("subform table runtime behavior", () => {
  it("renders keyed leaf columns in order, skips containers and non-keyed blocks, and applies columnWidth and headerWidth", () => {
    const schema: FormSchema = {
      id: "Form_cols",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_cols",
              type: "subform",
              variant: "table",
              key: "checks",
              label: "自查表",
              rows: {
                mode: "fixed",
                itemKey: "item",
                headerLabel: "自查内容",
                headerWidth: 280,
                source: {
                  kind: "static",
                  options: [{ label: "第一项", value: "a" }]
                }
              },
              template: [
                {
                  id: "F1",
                  type: "textfield",
                  key: "owner",
                  label: "责任人",
                  columnWidth: 200
                },
                {
                  id: "F2",
                  type: "textfield",
                  key: "code"
                },
                {
                  id: "B1",
                  type: "button",
                  label: "按钮",
                  action: "submit"
                },
                {
                  id: "S1",
                  type: "section",
                  variant: "card",
                  title: "嵌套区块",
                  children: []
                }
              ]
            }
          ]
        }
      }
    };

    renderForm(schema);

    const headers = screen.getAllByRole("columnheader");

    expect(headers.map(h => h.textContent)).toEqual(["自查内容", "责任人", "code"]);
    expect(headers[0]).toHaveStyle({ width: "280px", minWidth: "280px" });
    expect(headers[1]).toHaveStyle({ width: "200px", minWidth: "200px" });
    expect(screen.queryByRole("button", { name: /编\s*辑/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();
  });

  it("renders cells directly editable without per-row Edit/Save controls and enforces dynamic min/max bounds", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema: FormSchema = {
      id: "Form_dyn",
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
              rows: {
                mode: "dynamic",
                min: 1,
                max: 2,
                addLabel: "新增问题"
              },
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

    // Row 1 seeded by `min: 1` is immediately editable; no Edit button, no Delete at `min`.
    expect(screen.queryByRole("button", { name: /新增记录/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /编\s*辑/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除此行" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("请选择月份")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "问题" }), "问题一");

    // Add row 2 → reaches `max: 2` (add button hides) and delete buttons appear.
    await user.click(screen.getByRole("button", { name: /新增问题/ }));
    expect(screen.queryByRole("button", { name: /新增问题/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "删除此行" })).toHaveLength(2);

    const titleInputs = screen.getAllByRole("textbox", { name: "问题" });
    await user.type(titleInputs[1] as HTMLElement, "问题二");

    // Delete row 1 → row 2 survives and we are back at `min: 1` (delete hides, add returns).
    await user.click(screen.getAllByRole("button", { name: "删除此行" })[0] as HTMLElement);
    expect(screen.queryByRole("button", { name: "删除此行" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新增问题/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        extra: [{ title: "问题二", foundMonth: "" }]
      });
    });
  });

  it("filters the select cell dropdown by the option label and shows default placeholder", async () => {
    const user = userEvent.setup();
    renderForm(selectColumnSchema());

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    expect(screen.getByText("请选择")).toBeInTheDocument();

    const combobox = screen.getByRole("combobox", { name: "城市" });
    await user.click(combobox);
    await user.type(combobox, "北京");

    expect(await screen.findByRole("option", { name: "北京" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "上海" })).not.toBeInTheDocument();
  });

  it("outlines required select and radio cells and shows inline cell alerts when submitted empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const schema: FormSchema = {
      id: "Form_invalid",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_req",
              type: "subform",
              variant: "table",
              key: "lines",
              label: "明细",
              rows: { mode: "dynamic", min: 1 },
              template: [
                {
                  id: "Field_city",
                  type: "select",
                  key: "city",
                  label: "城市",
                  validate: { required: true },
                  dataSource: {
                    kind: "static",
                    options: [{ label: "北京", value: "bj" }]
                  }
                },
                {
                  id: "Field_flag",
                  type: "radio",
                  key: "flag",
                  label: "存在问题",
                  validate: { required: true },
                  dataSource: {
                    kind: "static",
                    options: [
                      { label: "是", value: "yes" },
                      { label: "否", value: "no" }
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

    const select = screen.getByRole("combobox", { name: "城市" }).closest("[class*='-select ']");
    const radioGroup = screen.getByRole("group", { name: "存在问题" });

    expect(select?.className).not.toMatch(/-select-status-error/);
    expect(radioGroup).toHaveAttribute("aria-invalid", "false");

    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => expect(select?.className).toMatch(/-select-status-error/));
    expect(radioGroup).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("alert").map(el => el.textContent)).toEqual(["此项为必填", "此项为必填"]);
    expect(onSubmit).not.toHaveBeenCalled();

    // Filling both cells clears errors and allows submit.
    await user.click(screen.getByRole("combobox", { name: "城市" }));
    await user.click(await screen.findByText("北京"));
    await user.click(screen.getByRole("radio", { name: "是" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ lines: [{ city: "bj", flag: "yes" }] });
    });
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

  it("resolves ref (static & remote) and inline remote option sources directly in table cells", async () => {
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

    renderForm(schema, { services: { request: resolve }, onSubmit });

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    await user.click(await screen.findByRole("radio", { name: "异常" }));
    await user.click(await screen.findByRole("checkbox", { name: "紧急" }));

    await user.click(screen.getByRole("combobox", { name: "责任角色" }));
    await user.click(await screen.findByText("审计员"));

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
      services: { request: resolve },
      evaluationContext: { applicant: { departmentId: "dept-hq" } }
    });

    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    const deptInput = screen.getByRole("textbox", { name: "科室编码" });
    await user.type(deptInput, "D1");

    await waitFor(() => {
      expect(resolve).toHaveBeenCalledWith(
        {
          resource: "hosp/ward",
          action: "find_options",
          params: { dept: "D1", applicantDept: "dept-hq" }
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    await user.click(screen.getByRole("combobox", { name: "病区" }));
    expect(await screen.findByRole("option", { name: "一病区" })).toBeInTheDocument();

    await user.clear(deptInput);
    await user.type(deptInput, "D2");

    await waitFor(() => {
      expect(resolve).toHaveBeenCalledWith(
        {
          resource: "hosp/ward",
          action: "find_options",
          params: { dept: "D2", applicantDept: "dept-hq" }
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
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

    await user.click(screen.getByRole("combobox", { name: "等级" }));
    await user.click(await screen.findByText("零级"));

    await user.click(screen.getByRole("combobox", { name: "关联项" }));
    await user.click(await screen.findByText("十"));
    await user.click(screen.getByText("二十"));

    await user.click(screen.getByRole("radio", { name: "不通过" }));
    await user.click(screen.getByRole("checkbox", { name: "乙" }));

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

  it("evaluates per-row linkage rules (hide, disable, assign, require) independently per row while keeping columns aligned", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const schema: FormSchema = {
      id: "Form_row_linkage",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_link",
              type: "subform",
              variant: "table",
              key: "checks",
              label: "联动自查",
              rows: { mode: "dynamic", min: 2 },
              template: [
                {
                  id: "C_has",
                  type: "radio",
                  key: "hasProblem",
                  label: "存在问题",
                  dataSource: {
                    kind: "static",
                    options: [
                      { label: "是", value: "yes" },
                      { label: "否", value: "no" }
                    ]
                  }
                },
                {
                  id: "C_detail",
                  type: "textfield",
                  key: "detail",
                  label: "问题描述",
                  linkage: {
                    defaults: { hidden: true },
                    rules: [
                      {
                        id: "Rule_show_require",
                        trigger: {
                          kind: "condition",
                          condition: {
                            kind: "leaf",
                            sourceKey: "hasProblem",
                            operator: "eq",
                            value: "yes"
                          }
                        },
                        actions: [{ type: "show" }, { type: "require" }]
                      }
                    ]
                  }
                },
                {
                  id: "C_note",
                  type: "textfield",
                  key: "note",
                  label: "处理备注",
                  linkage: {
                    rules: [
                      {
                        id: "Rule_assign_disable",
                        trigger: {
                          kind: "condition",
                          condition: {
                            kind: "leaf",
                            sourceKey: "hasProblem",
                            operator: "eq",
                            value: "no"
                          }
                        },
                        actions: [
                          {
                            type: "assign",
                            value: {
                              kind: "literal",
                              value: "无需整改"
                            }
                          },
                          { type: "disable" }
                        ]
                      }
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

    const bodyRows = screen.getAllByRole("row").slice(1);
    const row0 = bodyRows[0] as HTMLElement;
    const row1 = bodyRows[1] as HTMLElement;

    // Hidden cell keeps its `<td>` so row 0 and row 1 always have the same cell count (3 columns; at `min: 2`, no delete column).
    expect(within(row0).getAllByRole("cell")).toHaveLength(3);
    expect(within(row0).queryByRole("textbox", { name: "问题描述" })).not.toBeInTheDocument();

    // Row 0 -> "yes" shows & requires `detail`; Row 1 -> "no" assigns & disables `note`.
    await user.click(within(row0).getByRole("radio", { name: "是" }));
    await user.click(within(row1).getByRole("radio", { name: "否" }));

    const row0Detail = await within(row0).findByRole("textbox", { name: "问题描述" });
    expect(within(row1).queryByRole("textbox", { name: "问题描述" })).not.toBeInTheDocument();

    const row1Note = within(row1).getByRole("textbox", { name: "处理备注" });
    await waitFor(() => expect(row1Note).toHaveValue("无需整改"));
    expect(row1Note).toBeDisabled();
    expect(within(row0).getByRole("textbox", { name: "处理备注" })).toBeEnabled();

    // Submitting with row 0's required `detail` empty blocks and shows error inside row 0 only.
    await user.click(screen.getByRole("button", { name: "提交" }));
    expect(await within(row0).findByRole("alert")).toHaveTextContent("此项为必填");
    expect(within(row1).queryByRole("alert")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(row0Detail, "记录不完整");
    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        checks: [
          {
            hasProblem: "yes",
            detail: "记录不完整",
            note: ""
          },
          { hasProblem: "no", note: "无需整改" }
        ]
      });
    });
  });

  it("renders every cell disabled and hides add/delete buttons when the form is disabled", () => {
    const schema: FormSchema = {
      id: "Form_ro",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_ro",
              type: "subform",
              variant: "table",
              key: "extra",
              label: "明细",
              rows: {
                mode: "dynamic",
                min: 1,
                addLabel: "新增问题"
              },
              template: [
                {
                  id: "C_title",
                  type: "textfield",
                  key: "title",
                  label: "问题"
                }
              ]
            }
          ]
        }
      }
    };

    renderForm(schema, {
      disabled: true,
      defaultValues: { extra: [{ title: "已归档" }, { title: "第二条" }] }
    });

    const inputs = screen.getAllByRole("textbox", { name: "问题" });

    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("已归档");
    expect(inputs[0]).toBeDisabled();
    expect(inputs[1]).toHaveValue("第二条");
    expect(inputs[1]).toBeDisabled();
    expect(screen.queryByRole("button", { name: /新增问题/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除此行" })).not.toBeInTheDocument();
  });

  it("renders tree-select and tree-multi-select cells inside a table subform and submits their values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const regionOptions = [
      {
        label: "华东",
        value: "east",
        description: "片区",
        children: [
          { label: "上海", value: "sh" },
          { label: "杭州", value: "hz" }
        ]
      }
    ];
    const schema: FormSchema = {
      id: "Form_tree_cells",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "Sub_tree",
              type: "subform",
              variant: "table",
              key: "routes",
              label: "路由",
              rows: { mode: "dynamic", min: 1 },
              template: [
                {
                  id: "C_primary",
                  type: "tree-select",
                  key: "primaryRegion",
                  label: "主区域",
                  leafOnly: true,
                  dataSource: { kind: "static", options: regionOptions }
                },
                {
                  id: "C_backup",
                  type: "tree-multi-select",
                  key: "backupRegions",
                  label: "备选区域",
                  dataSource: { kind: "static", options: regionOptions }
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

    renderForm(schema, {
      defaultValues: { routes: [{ primaryRegion: "sh", backupRegions: ["east", "hz"] }] },
      onSubmit
    });

    expect(screen.getByText("上海")).toBeInTheDocument();
    expect(screen.getByText("华东")).toBeInTheDocument();
    expect(screen.getByText("杭州")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        routes: [{ primaryRegion: "sh", backupRegions: ["east", "hz"] }]
      });
    });
  });
});
