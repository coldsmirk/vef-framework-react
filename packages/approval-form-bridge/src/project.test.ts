import type { Block, FormDataSource, FormSchema, PresentationLayer } from "@vef-framework-react/form-editor";

import { describe, expect, it } from "vitest";

import { projectFormSchema } from "./project";

function schemaOf(children: Block[], extra?: { dataSources?: FormDataSource[]; mobile?: PresentationLayer }): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    ...extra?.dataSources && { dataSources: extra.dataSources },
    presentations: {
      pc: { children },
      ...extra?.mobile && { mobile: extra.mobile }
    }
  };
}

function deviceSubform(deviceTag: string, columns: Array<{ key: string; type: "textfield" | "number" }>) {
  return {
    id: `Sub-${deviceTag}`,
    type: "subform" as const,
    variant: "stack" as const,
    key: "items",
    label: "明细",
    template: columns.map((column, index) => {
      return {
        id: `${deviceTag}-C${index}`,
        type: column.type,
        key: column.key,
        label: column.key
      };
    })
  };
}

describe("projectFormSchema", () => {
  describe("scalar mapping", () => {
    it("projects a textfield with the full attribute set", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "name",
          label: "姓名",
          placeholder: "请输入姓名",
          validate: {
            required: true,
            minLength: 2,
            maxLength: 50,
            pattern: String.raw`^\S+$`,
            message: "格式不正确"
          }
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.fields).toEqual([
        {
          key: "name",
          kind: "input",
          label: "姓名",
          placeholder: "请输入姓名",
          isRequired: true,
          validation: {
            minLength: 2,
            maxLength: 50,
            pattern: String.raw`^\S+$`,
            message: "格式不正确"
          },
          columnType: "string",
          sortOrder: 0
        }
      ]);
    });

    it("maps each widget to its approval kind and column type", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "plain",
          label: "文本"
        },
        {
          id: "F2",
          type: "code-editor",
          key: "script",
          label: "脚本"
        },
        {
          id: "F3",
          type: "textarea",
          key: "remark",
          label: "备注"
        },
        {
          id: "F7",
          type: "radio",
          key: "grade",
          label: "等级",
          dataSource: { kind: "static", options: [{ label: "甲", value: 1 }] }
        },
        {
          id: "F4",
          type: "date",
          key: "day",
          label: "日期"
        },
        {
          id: "F5",
          type: "datetime",
          key: "moment",
          label: "时刻"
        },
        {
          id: "F6",
          type: "checkbox-group",
          key: "tags",
          label: "标签",
          dataSource: { kind: "static", options: [{ label: "A", value: "a" }] }
        }
      ]));

      expect(result.fields).toMatchObject([
        {
          key: "plain",
          kind: "input",
          columnType: "text"
        },
        {
          key: "script",
          kind: "textarea",
          columnType: "text"
        },
        {
          key: "remark",
          kind: "textarea",
          columnType: "text"
        },
        {
          key: "grade",
          kind: "select",
          columnType: "text",
          options: [{ label: "甲", value: 1 }]
        },
        {
          key: "day",
          kind: "date",
          columnType: "date"
        },
        {
          key: "moment",
          kind: "date",
          columnType: "datetime"
        },
        {
          key: "tags",
          kind: "select",
          columnType: "json",
          options: [{ label: "A", value: "a" }]
        }
      ]);
    });

    it("projects number precision into a decimal column with scale", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "number",
          key: "amount",
          label: "金额",
          precision: 2
        },
        {
          id: "F2",
          type: "number",
          key: "count",
          label: "数量"
        }
      ]));

      expect(result.fields).toMatchObject([
        {
          kind: "number",
          columnType: "decimal",
          scale: 2
        },
        { kind: "number" }
      ]);
      // A precision-less number must stay ungated: emitting the inferred
      // "integer" would make the Go runtime reject every fractional value.
      expect(result.fields[1]).not.toHaveProperty("columnType");
      expect(result.fields[1]).not.toHaveProperty("scale");
      expect(result.issues).toEqual([]);
    });

    it("warns when an explicit decimal column has no precision", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "number",
          key: "amount",
          label: "金额",
          columnType: "decimal"
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.fields).toMatchObject([{ columnType: "decimal" }]);
      expect(result.fields[0]).not.toHaveProperty("scale");
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "decimal_scale_missing",
          severity: "warning",
          path: "amount"
        })
      ]);
    });

    it.each([
      ["a lookahead group", String.raw`(?=.*\d).+`],
      ["a negative lookbehind group", String.raw`(?<!\d)\w+`],
      ["a backreference", String.raw`(\w)\1`]
    ])("rejects a pattern with %s as RE2-unsupported", (_, pattern) => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "code",
          label: "编码",
          validate: { pattern }
        }
      ]));

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "pattern_unsupported",
          severity: "error",
          path: "code"
        })
      ]);
    });

    it.each([
      ["an escaped group prefix", String.raw`\(\?=`],
      ["a character-class literal", "[(?=]+"],
      ["a non-capturing group", "(?:ab)+"]
    ])("accepts a pattern with %s", (_, pattern) => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "code",
          label: "编码",
          validate: { pattern }
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("honors an explicit columnType override over inference", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "number",
          key: "score",
          label: "分值",
          precision: 2,
          columnType: "integer"
        }
      ]));

      expect(result.fields).toMatchObject([{ columnType: "integer" }]);
      expect(result.fields[0]).not.toHaveProperty("scale");
    });

    it("falls back to the key when a field has no label", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "code"
        }
      ]));

      expect(result.fields).toMatchObject([{ label: "code" }]);
    });
  });

  describe("options sources", () => {
    const staticSource: FormDataSource = {
      id: "DS1",
      kind: "static",
      name: "cities",
      options: [{ label: "北京", value: "bj" }]
    };
    const remoteSource: FormDataSource = {
      id: "DS2",
      kind: "remote",
      name: "remote",
      request: { resource: "city", action: "list" }
    };

    it("inlines a static source on both projections", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "select",
          key: "city",
          label: "城市",
          dataSource: { kind: "static", options: [{ label: "北京", value: "bj" }] }
        }
      ]));

      expect(result.fields[0]?.options).toEqual([{ label: "北京", value: "bj" }]);
      expect(result.formFields[0]?.options).toEqual([{ label: "北京", value: "bj" }]);
      expect(result.issues).toEqual([]);
    });

    it("resolves a ref to a form-global static source", () => {
      const result = projectFormSchema(schemaOf(
        [
          {
            id: "F1",
            type: "select",
            key: "city",
            label: "城市",
            dataSource: { kind: "ref", dataSourceId: "DS1" }
          }
        ],
        { dataSources: [staticSource] }
      ));

      expect(result.fields[0]?.options).toEqual([{ label: "北京", value: "bj" }]);
      expect(result.issues).toEqual([]);
    });

    it.each([
      ["inline remote", { kind: "remote", request: { resource: "city", action: "list" } } as const, undefined],
      ["ref to a remote source", { kind: "ref", dataSourceId: "DS2" } as const, [remoteSource]],
      ["dangling ref", { kind: "ref", dataSourceId: "missing" } as const, undefined]
    ])("omits options and warns for a %s", (_, dataSource, dataSources) => {
      const result = projectFormSchema(schemaOf(
        [
          {
            id: "F1",
            type: "select",
            key: "city",
            label: "城市",
            dataSource
          }
        ],
        { dataSources }
      ));

      expect(result.valid).toBe(true);
      expect(result.fields[0]).not.toHaveProperty("options");
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "options_not_static",
          severity: "warning",
          path: "city"
        })
      ]);
    });

    it("emits neither options nor a warning when no source is configured", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "select",
          key: "city",
          label: "城市"
        }
      ]));

      expect(result.fields[0]).not.toHaveProperty("options");
      expect(result.issues).toEqual([]);
    });
  });

  describe("subform projection", () => {
    it("projects a subform into a table field with columns and row bounds", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sub",
          type: "subform",
          variant: "table",
          key: "items",
          label: "明细",
          minRows: 2,
          maxRows: 5,
          template: [
            {
              id: "C1",
              type: "textfield",
              key: "desc",
              label: "说明",
              validate: { maxLength: 100 }
            },
            {
              id: "C2",
              type: "number",
              key: "price",
              label: "单价",
              precision: 2
            },
            {
              id: "C3",
              type: "select",
              key: "unit",
              label: "单位",
              dataSource: { kind: "static", options: [{ label: "个", value: "pcs" }] }
            }
          ]
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.fields).toEqual([
        {
          key: "items",
          kind: "table",
          label: "明细",
          isRequired: true,
          validation: { minLength: 2, maxLength: 5 },
          columns: [
            {
              key: "desc",
              kind: "input",
              label: "说明",
              validation: { maxLength: 100 },
              columnType: "string",
              sortOrder: 0
            },
            {
              key: "price",
              kind: "number",
              label: "单价",
              columnType: "decimal",
              scale: 2,
              sortOrder: 1
            },
            {
              key: "unit",
              kind: "select",
              label: "单位",
              options: [{ label: "个", value: "pcs" }],
              columnType: "text",
              sortOrder: 2
            }
          ],
          sortOrder: 0
        }
      ]);
      expect(result.formFields).toEqual([
        {
          key: "items",
          kind: "table",
          label: "明细",
          columns: [
            {
              key: "desc",
              kind: "input",
              label: "说明"
            },
            {
              key: "price",
              kind: "number",
              label: "单价"
            },
            {
              key: "unit",
              kind: "select",
              label: "单位",
              options: [{ label: "个", value: "pcs" }]
            }
          ]
        }
      ]);
    });

    it("emits neither isRequired nor validation when rows are unbounded", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "items",
          label: "明细",
          template: [
            {
              id: "C1",
              type: "textfield",
              key: "desc",
              label: "说明"
            }
          ]
        }
      ]));

      expect(result.fields[0]).not.toHaveProperty("isRequired");
      expect(result.fields[0]).not.toHaveProperty("validation");
    });

    it("keeps a subform nested in a layout section a top-level table field", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sec",
          type: "section",
          variant: "card",
          title: "分组",
          children: [
            {
              id: "Sub",
              type: "subform",
              variant: "stack",
              key: "items",
              label: "明细",
              template: [
                {
                  id: "C1",
                  type: "textfield",
                  key: "desc",
                  label: "说明"
                }
              ]
            }
          ]
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.fields).toMatchObject([{ key: "items", kind: "table" }]);
    });

    it("flattens layout containers inside the template without an issue", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "items",
          label: "明细",
          template: [
            {
              id: "Sec",
              type: "section",
              variant: "card",
              title: "行内分组",
              children: [
                {
                  id: "C1",
                  type: "textfield",
                  key: "desc",
                  label: "说明"
                },
                {
                  id: "C2",
                  type: "number",
                  key: "qty",
                  label: "数量"
                }
              ]
            }
          ]
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.fields[0]?.columns?.map(column => column.key)).toEqual(["desc", "qty"]);
    });

    it("rejects a nested subform while projecting sibling columns", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "items",
          label: "明细",
          template: [
            {
              id: "C1",
              type: "textfield",
              key: "desc",
              label: "说明"
            },
            {
              id: "Nested",
              type: "subform",
              variant: "stack",
              key: "parts",
              label: "子明细",
              template: [
                {
                  id: "N1",
                  type: "textfield",
                  key: "part",
                  label: "部件"
                }
              ]
            }
          ]
        }
      ]));

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "nested_subform_unsupported",
          severity: "error",
          path: "items.parts"
        })
      ]);
      expect(result.fields[0]?.columns?.map(column => column.key)).toEqual(["desc"]);
    });

    it("rejects a subform whose template yields no columns", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "items",
          label: "明细",
          template: [{ id: "D1", type: "divider" }]
        }
      ]));

      expect(result.valid).toBe(false);
      expect(result.fields).toEqual([]);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "table_columns_empty",
          severity: "error",
          path: "items"
        })
      ]);
    });

    it("reports an unmappable template column under the table path", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "items",
          label: "明细",
          template: [
            {
              id: "C1",
              type: "textfield",
              key: "desc",
              label: "说明"
            },
            {
              id: "C2",
              type: "switch",
              key: "flag",
              label: "开关"
            }
          ]
        }
      ]));

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "unmappable_field_type",
          severity: "error",
          path: "items.flag"
        })
      ]);
      expect(result.fields[0]?.columns?.map(column => column.key)).toEqual(["desc"]);
    });

    it("projects a duplicate column key once, first sighting winning", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "items",
          label: "明细",
          template: [
            {
              id: "C1",
              type: "textfield",
              key: "desc",
              label: "说明"
            },
            {
              id: "C2",
              type: "number",
              key: "desc",
              label: "重复键"
            }
          ]
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.fields[0]?.columns).toMatchObject([{ key: "desc", kind: "input" }]);
    });

    it("resolves a column's ref to a form-global static source", () => {
      const result = projectFormSchema(schemaOf(
        [
          {
            id: "Sub",
            type: "subform",
            variant: "stack",
            key: "items",
            label: "明细",
            template: [
              {
                id: "C1",
                type: "select",
                key: "unit",
                label: "单位",
                dataSource: { kind: "ref", dataSourceId: "DS1" }
              }
            ]
          }
        ],
        {
          dataSources: [
            {
              id: "DS1",
              kind: "static",
              name: "units",
              options: [{ label: "个", value: "pcs" }]
            }
          ]
        }
      ));

      expect(result.issues).toEqual([]);
      expect(result.fields[0]?.columns?.[0]?.options).toEqual([{ label: "个", value: "pcs" }]);
      expect(result.formFields[0]?.columns?.[0]?.options).toEqual([{ label: "个", value: "pcs" }]);
    });
  });

  describe("conservation", () => {
    it.each<[string, Block, string]>([
      [
        "switch",
        {
          id: "F1",
          type: "switch",
          key: "bound",
          label: "开关"
        },
        "unmappable_field_type"
      ],
      [
        "daterange",
        {
          id: "F1",
          type: "daterange",
          key: "bound",
          label: "日期区间"
        },
        "unmappable_field_type"
      ],
      [
        "unknown",
        {
          id: "F1",
          type: "rating",
          key: "bound",
          label: "评分"
        } as unknown as Block,
        "unknown_field_type_unprojectable"
      ]
    ])("raises an error for a keyed %s field instead of dropping it", (_, block, code) => {
      const result = projectFormSchema(schemaOf([block]));

      expect(result.valid).toBe(false);
      expect(result.fields).toEqual([]);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code,
          severity: "error",
          path: "bound"
        })
      ]);
    });

    it("silently skips non-keyed presentation nodes", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "button",
          label: "提交"
        },
        {
          id: "F2",
          type: "divider",
          title: "分组"
        },
        {
          id: "F3",
          type: "alert-block",
          message: "提示"
        },
        {
          id: "F4",
          type: "paragraph",
          text: "说明文本"
        },
        {
          id: "F5",
          type: "textfield",
          key: "name",
          label: "姓名"
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.fields.map(field => field.key)).toEqual(["name"]);
    });
  });

  describe("cross-device union", () => {
    it("dedupes a shared key with pc winning and appends mobile-only fields", () => {
      const result = projectFormSchema(schemaOf(
        [
          {
            id: "P1",
            type: "textfield",
            key: "name",
            label: "PC 姓名"
          }
        ],
        {
          mobile: {
            children: [
              {
                id: "M1",
                type: "textfield",
                key: "name",
                label: "移动端姓名"
              },
              {
                id: "M2",
                type: "textfield",
                key: "mobileOnly",
                label: "仅移动端"
              }
            ]
          }
        }
      ));

      expect(result.valid).toBe(true);
      expect(result.fields.map(field => [field.key, field.label, field.sortOrder])).toEqual([
        ["name", "PC 姓名", 0],
        ["mobileOnly", "仅移动端", 1]
      ]);
    });

    it("raises an error when the same key projects to different kinds across devices", () => {
      // The losing device submits a value shape the deployed definition
      // rejects, so this is contract-breaking, not a preference.
      const result = projectFormSchema(schemaOf(
        [
          {
            id: "P1",
            type: "textfield",
            key: "value",
            label: "文本"
          }
        ],
        {
          mobile: {
            children: [
              {
                id: "M1",
                type: "number",
                key: "value",
                label: "数字"
              }
            ]
          }
        }
      ));

      expect(result.valid).toBe(false);
      expect(result.fields).toMatchObject([{ kind: "input" }]);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "cross_device_kind_mismatch",
          severity: "error",
          path: "value"
        })
      ]);
    });

    it("raises an error when the same detail table has different columns across devices", () => {
      const shared = [
        { key: "a", type: "textfield" as const },
        { key: "b", type: "textfield" as const }
      ];
      const result = projectFormSchema(schemaOf(
        [deviceSubform("pc", shared)],
        { mobile: { children: [deviceSubform("mobile", [...shared, { key: "c", type: "textfield" as const }])] } }
      ));

      expect(result.valid).toBe(false);
      expect(result.fields[0]?.columns).toHaveLength(2);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "cross_device_table_mismatch",
          severity: "error",
          path: "items"
        })
      ]);
    });

    it("accepts an identical detail table on both devices", () => {
      const columns = [{ key: "qty", type: "number" as const }];
      const result = projectFormSchema(schemaOf(
        [deviceSubform("pc", columns)],
        { mobile: { children: [deviceSubform("mobile", columns)] } }
      ));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.fields).toHaveLength(1);
    });

    it("reports an unprojectable key once across devices", () => {
      const result = projectFormSchema(schemaOf(
        [
          {
            id: "P1",
            type: "switch",
            key: "flag",
            label: "开关"
          }
        ],
        {
          mobile: {
            children: [
              {
                id: "M1",
                type: "switch",
                key: "flag",
                label: "开关"
              }
            ]
          }
        }
      ));

      expect(result.issues).toHaveLength(1);
    });

    it("errors on a second-device unmappable sighting of an already-projected key", () => {
      // pc textfield "a" projects; the mobile switch on the SAME key must still
      // error — classification runs before the cross-device dedupe, so the
      // conflicting type is not silently skipped (the losing device would
      // submit a value the deployed definition rejects). Mirrors the Go parser.
      const result = projectFormSchema(schemaOf(
        [
          {
            id: "P1",
            type: "textfield",
            key: "a",
            label: "文本"
          }
        ],
        {
          mobile: {
            children: [
              {
                id: "M1",
                type: "switch",
                key: "a",
                label: "开关"
              }
            ]
          }
        }
      ));

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "unmappable_field_type",
          severity: "error",
          path: "a"
        })
      ]);
    });

    it("errors and projects nothing when the unmappable widget is sighted first", () => {
      // pc switch "a" errors and records the key unprojectable; the mobile
      // textfield on the same key is deduped away — one issue, no field,
      // matching the Go parser's abort-on-first-error.
      const result = projectFormSchema(schemaOf(
        [
          {
            id: "P1",
            type: "switch",
            key: "a",
            label: "开关"
          }
        ],
        {
          mobile: {
            children: [
              {
                id: "M1",
                type: "textfield",
                key: "a",
                label: "文本"
              }
            ]
          }
        }
      ));

      expect(result.valid).toBe(false);
      expect(result.fields).toEqual([]);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "unmappable_field_type",
          severity: "error",
          path: "a"
        })
      ]);
    });
  });

  describe("conditional visibility hint", () => {
    it("flags a field whose own linkage can hide it", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "a",
          label: "甲",
          linkage: {
            rules: [
              {
                id: "L1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "b",
                    operator: "eq",
                    value: "x"
                  }
                },
                actions: [{ type: "hide" }]
              }
            ]
          }
        }
      ]));

      expect(result.formFields[0]?.hasConditionalVisibility).toBe(true);
    });

    it("flags a field with a hidden default", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "a",
          label: "甲",
          linkage: { defaults: { hidden: true } }
        }
      ]));

      expect(result.formFields[0]?.hasConditionalVisibility).toBe(true);
    });

    it("flags a field whose linkage uses a script action", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "a",
          label: "甲",
          linkage: {
            rules: [
              {
                id: "L1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "b",
                    operator: "eq",
                    value: "x"
                  }
                },
                actions: [{ type: "script", source: "return { hidden: true };" }]
              }
            ]
          }
        }
      ]));

      expect(result.formFields[0]?.hasConditionalVisibility).toBe(true);
    });

    it("flags a field nested in a hide-capable ancestor container", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "Sec",
          type: "section",
          variant: "card",
          title: "分组",
          linkage: {
            rules: [
              {
                id: "L1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "b",
                    operator: "eq",
                    value: "x"
                  }
                },
                actions: [{ type: "hide" }]
              }
            ]
          },
          children: [
            {
              id: "F1",
              type: "textfield",
              key: "a",
              label: "甲"
            }
          ]
        }
      ]));

      expect(result.fields.map(field => field.key)).toEqual(["a"]);
      expect(result.formFields[0]?.hasConditionalVisibility).toBe(true);
    });

    it("does not flag a field carrying only value / require / disable linkage", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "a",
          label: "甲",
          linkage: {
            defaults: { required: true, disabled: true },
            rules: [
              {
                id: "L1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "b",
                    operator: "eq",
                    value: "x"
                  }
                },
                actions: [{ type: "require" }, { type: "disable" }]
              }
            ]
          }
        }
      ]));

      // The field still trips the linkage_not_projected warning, but its
      // visibility is not linkage-governed, so the hint stays absent.
      expect(result.formFields[0]?.hasConditionalVisibility).toBeUndefined();
    });

    it("does not flag a plain field", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "a",
          label: "甲"
        }
      ]));

      expect(result.formFields[0]?.hasConditionalVisibility).toBeUndefined();
    });
  });

  describe("linkage", () => {
    it("warns when a projected field carries linkage rules", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "name",
          label: "姓名",
          linkage: {
            rules: [
              {
                id: "L1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "other",
                    operator: "eq",
                    value: "x"
                  }
                },
                actions: [{ type: "hide" }]
              }
            ]
          }
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "linkage_not_projected",
          severity: "warning",
          path: "name"
        })
      ]);
    });

    it("warns on linkage defaults but not on an empty linkage object", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "hidden",
          label: "默认隐藏",
          linkage: { defaults: { hidden: true } }
        },
        {
          id: "F2",
          type: "textfield",
          key: "plain",
          label: "普通",
          linkage: {}
        }
      ]));

      expect(result.issues).toEqual([expect.objectContaining({ code: "linkage_not_projected", path: "hidden" })]);
    });
  });

  describe("result shape", () => {
    it("keeps fields and formFields aligned in keys and order", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "textfield",
          key: "name",
          label: "姓名"
        },
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "items",
          label: "明细",
          template: [
            {
              id: "C1",
              type: "number",
              key: "qty",
              label: "数量"
            }
          ]
        },
        {
          id: "F2",
          type: "date",
          key: "day",
          label: "日期"
        }
      ]));

      expect(result.fields.map(field => field.key)).toEqual(["name", "items", "day"]);
      expect(result.formFields.map(field => field.key)).toEqual(["name", "items", "day"]);
      expect(result.fields.map(field => field.sortOrder)).toEqual([0, 1, 2]);
      expect(result.formFields[1]?.columns).toEqual([
        {
          key: "qty",
          kind: "number",
          label: "数量"
        }
      ]);
    });

    it("stays valid when only warnings were raised", () => {
      const result = projectFormSchema(schemaOf([
        {
          id: "F1",
          type: "select",
          key: "city",
          label: "城市",
          dataSource: { kind: "remote", request: { resource: "city", action: "list" } }
        }
      ]));

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(1);
    });
  });
});
