import type { Block } from "../types";

import { buildSubformColumns } from "./subform-columns";

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
});
