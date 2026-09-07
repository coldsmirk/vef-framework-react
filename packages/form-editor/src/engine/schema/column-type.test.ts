import type { FormField, FormSchema } from "../../types";

import { describe, expect, it } from "vitest";

import { inferColumnType, toColumnDefinitions } from "./column-type";

describe("inferColumnType", () => {
  it("maps deterministic widgets to their column type", () => {
    expect(inferColumnType({
      id: "1",
      type: "textarea",
      key: "a"
    } as FormField)).toBe("text");
    expect(inferColumnType({
      id: "1",
      type: "code-editor",
      key: "a"
    } as FormField)).toBe("text");
    expect(inferColumnType({
      id: "1",
      type: "switch",
      key: "a"
    } as FormField)).toBe("boolean");
    expect(inferColumnType({
      id: "1",
      type: "date",
      key: "a"
    } as FormField)).toBe("date");
    expect(inferColumnType({
      id: "1",
      type: "datetime",
      key: "a"
    } as FormField)).toBe("datetime");
    expect(inferColumnType({
      id: "1",
      type: "checkbox-group",
      key: "a"
    } as FormField)).toBe("json");
    expect(inferColumnType({
      id: "1",
      type: "daterange",
      key: "a"
    } as FormField)).toBe("json");
  });

  it("infers number as integer or decimal by precision", () => {
    expect(inferColumnType({
      id: "1",
      type: "number",
      key: "a"
    } as FormField)).toBe("integer");
    expect(inferColumnType({
      id: "1",
      type: "number",
      key: "a",
      precision: 0
    } as FormField)).toBe("integer");
    expect(inferColumnType({
      id: "1",
      type: "number",
      key: "a",
      precision: 2
    } as FormField)).toBe("decimal");
  });

  it("infers a string field as sized string with maxLength, else text", () => {
    expect(inferColumnType({
      id: "1",
      type: "textfield",
      key: "a"
    } as FormField)).toBe("text");
    expect(inferColumnType({
      id: "1",
      type: "textfield",
      key: "a",
      validate: { maxLength: 64 }
    } as FormField)).toBe("string");
    // select / radio default to the string family — text without a declared maxLength.
    expect(inferColumnType({
      id: "1",
      type: "select",
      key: "a"
    } as FormField)).toBe("text");
    expect(inferColumnType({
      id: "1",
      type: "radio",
      key: "a"
    } as FormField)).toBe("text");
  });

  it("infers an upload field by its file count, not by maxLength", () => {
    // One file is one storage key — a string. Several is an array of them, the
    // same shape checkbox-group carries, so it needs the same JSON column.
    expect(inferColumnType({
      id: "1",
      type: "upload",
      key: "a"
    } as FormField)).toBe("text");
    expect(inferColumnType({
      id: "1",
      type: "upload",
      key: "a",
      maxCount: 1
    } as FormField)).toBe("text");
    expect(inferColumnType({
      id: "1",
      type: "upload",
      key: "a",
      maxCount: 5
    } as FormField)).toBe("json");
    // maxLength bounds a string's length; an upload's bound is its file count,
    // so the string/text fallback must not claim this widget.
    expect(inferColumnType({
      id: "1",
      type: "upload",
      key: "a",
      maxCount: 5,
      validate: { maxLength: 64 }
    } as FormField)).toBe("json");
  });

  it("honors an explicit columnType override over inference", () => {
    expect(inferColumnType({
      id: "1",
      type: "select",
      key: "a",
      columnType: "integer"
    } as FormField)).toBe("integer");
    expect(inferColumnType({
      id: "1",
      type: "number",
      key: "a",
      precision: 2,
      columnType: "integer"
    } as FormField)).toBe("integer");
  });
});

describe("toColumnDefinitions", () => {
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
            label: "姓名",
            validate: { maxLength: 32 }
          },
          {
            id: "F2",
            type: "number",
            key: "price",
            label: "价格",
            precision: 2
          },
          {
            id: "F3",
            type: "date",
            key: "birthday",
            label: "生日"
          },
          {
            id: "F4",
            type: "checkbox-group",
            key: "tags",
            label: "标签",
            dataSource: { kind: "static", options: [] }
          },
          {
            id: "Btn",
            type: "button",
            label: "提交"
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

  it("projects root keyed leaves with their column type and parameters", () => {
    expect(toColumnDefinitions(schema)).toEqual([
      {
        key: "name",
        columnType: "string",
        maxLength: 32
      },
      {
        key: "price",
        columnType: "decimal",
        precision: 2
      },
      { key: "birthday", columnType: "date" },
      { key: "tags", columnType: "json" }
    ]);
  });

  it("excludes non-keyed presentation and subform-template fields", () => {
    const keys = toColumnDefinitions(schema).map(definition => definition.key);

    expect(keys).toEqual(["name", "price", "birthday", "tags"]);
    expect(keys).not.toContain("amount");
    expect(keys).not.toContain("lines");
  });
});
