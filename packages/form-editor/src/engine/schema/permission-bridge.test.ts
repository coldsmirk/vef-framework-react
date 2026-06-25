import type { FormSchema } from "../../types";

import { describe, expect, it } from "vitest";

import { toFormFieldDefinitions } from "./permission-bridge";

const schema: FormSchema = {
  id: "Form_1",
  version: 2,
  presentations: {
    pc: {
      children: [
        {
          id: "F1",
          type: "textfield",
          key: "name",
          label: "姓名"
        },
        {
          id: "F2",
          type: "number",
          key: "age",
          label: "年龄"
        },
        {
          id: "F3",
          type: "select",
          key: "city",
          label: "城市",
          dataSource: { kind: "static", options: [{ label: "北京", value: "bj" }] }
        },
        {
          id: "F4",
          type: "button",
          label: "提交"
        },
        {
          id: "Div",
          type: "divider",
          title: "分组"
        },
        {
          id: "Sub",
          type: "subform",
          variant: "stack",
          key: "lines",
          label: "明细",
          template: [
            {
              id: "FT",
              type: "textfield",
              key: "amount",
              label: "金额"
            }
          ]
        }
      ]
    }
  }
};

describe("toFormFieldDefinitions", () => {
  it("emits one entry per root keyed leaf field, mapped to its backend kind", () => {
    expect(toFormFieldDefinitions(schema)).toEqual([
      {
        key: "name",
        kind: "input",
        label: "姓名"
      },
      {
        key: "age",
        kind: "number",
        label: "年龄"
      },
      {
        key: "city",
        kind: "select",
        label: "城市",
        options: [{ label: "北京", value: "bj" }]
      }
    ]);
  });

  it("excludes non-keyed presentation fields and subform-template fields", () => {
    const keys = toFormFieldDefinitions(schema).map(definition => definition.key);

    expect(keys).not.toContain("amount");
    expect(keys).not.toContain("lines");
    expect(keys).toEqual(["name", "age", "city"]);
  });

  it("resolves a ref data source to its form-level static options", () => {
    const result = toFormFieldDefinitions({
      id: "F",
      version: 2,
      dataSources: [
        {
          id: "DS1",
          name: "城市",
          kind: "static",
          options: [{ label: "上海", value: "sh" }]
        }
      ],
      presentations: {
        pc: {
          children: [
            {
              id: "X",
              type: "select",
              key: "city",
              label: "城市",
              dataSource: { kind: "ref", dataSourceId: "DS1" }
            }
          ]
        }
      }
    });

    expect(result).toEqual([
      {
        key: "city",
        kind: "select",
        label: "城市",
        options: [{ label: "上海", value: "sh" }]
      }
    ]);
  });

  it("omits options for a ref to a remote data source (host-resolved at runtime)", () => {
    const result = toFormFieldDefinitions({
      id: "F",
      version: 2,
      dataSources: [
        {
          id: "DS2",
          name: "远程",
          kind: "remote",
          request: { resource: "city", action: "list" }
        }
      ],
      presentations: {
        pc: {
          children: [
            {
              id: "X",
              type: "select",
              key: "city",
              label: "城市",
              dataSource: { kind: "ref", dataSourceId: "DS2" }
            }
          ]
        }
      }
    });

    expect(result).toEqual([
      {
        key: "city",
        kind: "select",
        label: "城市"
      }
    ]);
  });

  it("omits options for an inline remote data source (host-resolved at runtime)", () => {
    const result = toFormFieldDefinitions({
      id: "F",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "X",
              type: "select",
              key: "city",
              label: "城市",
              dataSource: { kind: "remote", request: { resource: "city", action: "list" } }
            }
          ]
        }
      }
    });

    expect(result).toEqual([
      {
        key: "city",
        kind: "select",
        label: "城市"
      }
    ]);
  });

  it("falls back to the field key when a label is missing", () => {
    const result = toFormFieldDefinitions({
      id: "F",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "X",
              type: "textfield",
              key: "code"
            }
          ]
        }
      }
    });

    expect(result).toEqual([
      {
        key: "code",
        kind: "input",
        label: "code"
      }
    ]);
  });

  describe("with a mobile presentation", () => {
    const dualDevice: FormSchema = {
      id: "F",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "P1",
              type: "textfield",
              key: "name",
              label: "PC 姓名"
            }
          ]
        },
        mobile: {
          children: [
            {
              id: "M1",
              type: "textfield",
              key: "name",
              label: "移动 姓名"
            },
            {
              id: "M2",
              type: "textfield",
              key: "phone",
              label: "电话"
            }
          ]
        }
      }
    };

    it("unions fields across devices so a mobile-only field contributes a row", () => {
      expect(toFormFieldDefinitions(dualDevice).map(definition => definition.key)).toEqual(["name", "phone"]);
    });

    it("keeps the pc label when both devices define the same key", () => {
      expect(toFormFieldDefinitions(dualDevice)[0]).toEqual({
        key: "name",
        kind: "input",
        label: "PC 姓名"
      });
    });
  });
});
