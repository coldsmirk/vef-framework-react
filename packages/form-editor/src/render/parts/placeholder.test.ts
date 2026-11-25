import type {
  DateField,
  DateRangeField,
  DatetimeField,
  MultiSelectField,
  SelectField,
  TextfieldField,
  TreeMultiSelectField,
  TreeSelectField
} from "../../types";

import { describe, expect, it } from "vitest";

import {
  defaultFieldPlaceholder,
  resolveDateRangePlaceholderPair,
  resolveFieldPlaceholder
} from "./placeholder";

describe("field placeholder helpers", () => {
  it("returns granularity-aware defaults for date fields", () => {
    const base: DateField = {
      id: "D",
      type: "date",
      key: "d"
    };

    expect(defaultFieldPlaceholder(base)).toBe("请选择日期");
    expect(defaultFieldPlaceholder({ ...base, granularity: "day" })).toBe("请选择日期");
    expect(defaultFieldPlaceholder({ ...base, granularity: "month" })).toBe("请选择月份");
    expect(defaultFieldPlaceholder({ ...base, granularity: "quarter" })).toBe("请选择季度");
    expect(defaultFieldPlaceholder({ ...base, granularity: "year" })).toBe("请选择年份");
  });

  it("returns the datetime default placeholder", () => {
    const field: DatetimeField = {
      id: "DT",
      type: "datetime",
      key: "dt"
    };

    expect(defaultFieldPlaceholder(field)).toBe("请选择日期时间");
  });

  it("returns granularity-aware defaults for daterange fields and dual-input pairs", () => {
    const base: DateRangeField = {
      id: "R",
      type: "daterange",
      key: "r"
    };

    expect(defaultFieldPlaceholder(base)).toBe("请选择日期区间");
    expect(defaultFieldPlaceholder({ ...base, granularity: "day" })).toBe("请选择日期区间");
    expect(defaultFieldPlaceholder({ ...base, granularity: "month" })).toBe("请选择月份区间");
    expect(defaultFieldPlaceholder({ ...base, granularity: "quarter" })).toBe("请选择季度区间");
    expect(defaultFieldPlaceholder({ ...base, granularity: "year" })).toBe("请选择年份区间");

    expect(resolveDateRangePlaceholderPair(undefined)).toEqual(["开始日期", "结束日期"]);
    expect(resolveDateRangePlaceholderPair("day")).toEqual(["开始日期", "结束日期"]);
    expect(resolveDateRangePlaceholderPair("month")).toEqual(["开始月份", "结束月份"]);
    expect(resolveDateRangePlaceholderPair("quarter")).toEqual(["开始季度", "结束季度"]);
    expect(resolveDateRangePlaceholderPair("year")).toEqual(["开始年份", "结束年份"]);
  });

  it("returns 请选择 for select, multi-select, tree-select, and tree-multi-select fields", () => {
    const select: SelectField = {
      id: "S",
      type: "select",
      key: "s"
    };
    const multi: MultiSelectField = {
      id: "M",
      type: "multi-select",
      key: "m"
    };
    const tree: TreeSelectField = {
      id: "T",
      type: "tree-select",
      key: "t"
    };
    const treeMulti: TreeMultiSelectField = {
      id: "TM",
      type: "tree-multi-select",
      key: "tm"
    };

    expect(defaultFieldPlaceholder(select)).toBe("请选择");
    expect(defaultFieldPlaceholder(multi)).toBe("请选择");
    expect(defaultFieldPlaceholder(tree)).toBe("请选择");
    expect(defaultFieldPlaceholder(treeMulti)).toBe("请选择");
  });

  it("prefers an explicit non-empty placeholder and falls back on empty or absent values", () => {
    const dateField: DateField = {
      id: "D",
      type: "date",
      key: "d",
      granularity: "month"
    };
    const textField: TextfieldField = {
      id: "T",
      type: "textfield",
      key: "t"
    };

    expect(resolveFieldPlaceholder({ ...dateField, placeholder: "选个自查年月" })).toBe("选个自查年月");
    expect(resolveFieldPlaceholder({ ...dateField, placeholder: "" })).toBe("请选择月份");
    expect(resolveFieldPlaceholder(dateField)).toBe("请选择月份");

    expect(resolveFieldPlaceholder(textField)).toBeUndefined();
    expect(resolveFieldPlaceholder({ ...textField, placeholder: "" })).toBeUndefined();
    expect(resolveFieldPlaceholder({ ...textField, placeholder: "请输入姓名" })).toBe("请输入姓名");
  });
});
