import type { Block, FormSchema } from "../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";
import { buildSubformColumns } from "./subform-columns";

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
});

describe("subform table select column", () => {
  it("filters the cell dropdown by the option label", async () => {
    const user = userEvent.setup();
    const registry = createDefaultRegistry();

    render(
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>
        <FormRenderer schema={selectColumnSchema()} />
      </RegistryProvider>
    );

    await user.click(screen.getByRole("button", { name: /新增记录/ }));

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.type(combobox, "北京");

    expect(await screen.findByRole("option", { name: "北京" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "上海" })).not.toBeInTheDocument();
  });
});
