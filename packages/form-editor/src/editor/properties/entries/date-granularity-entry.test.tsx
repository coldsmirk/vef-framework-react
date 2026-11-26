import type { DateField, FormSchema } from "../../../types";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { dateGranularityEntry } from "../../../components/field-entries";
import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../../store/form-store";
import { DateGranularityEntry } from "./date-granularity-entry";

interface HarnessControls {
  getSchema: () => FormSchema;
  getPastLength: () => number;
  undo: () => void;
}

function TestHarness({
  initialSchema,
  onReady
}: {
  initialSchema: FormSchema;
  onReady?: (controls: HarnessControls) => void;
}) {
  return (
    <FormEditorStoreProvider initialState={{ schema: initialSchema }}>
      <HarnessInner onReady={onReady} />
    </FormEditorStoreProvider>
  );
}

function HarnessInner({ onReady }: { onReady?: (controls: HarnessControls) => void }) {
  const storeApi = useFormEditorStoreApi();
  const schema = useFormEditorStore(state => state.schema);
  const field = schema.presentations.pc.children[0] as DateField | undefined;

  onReady?.({
    getSchema: () => storeApi.getState().schema,
    getPastLength: () => storeApi.getState().past.length,
    undo: () => storeApi.getState().undo()
  });

  if (!field) {
    return null;
  }

  return (
    <DateGranularityEntry
      entry={dateGranularityEntry<DateField>()}
      field={field}
      schema={schema}
      onChange={vi.fn()}
    />
  );
}

describe("DateGranularityEntry", () => {
  it("switches immediately without confirmation when no linkage literals exist", async () => {
    const user = userEvent.setup();
    const schema: FormSchema = {
      id: "Form_1",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "D1",
              type: "date",
              key: "period",
              label: "期间"
            }
          ]
        }
      }
    };

    let controls: HarnessControls | undefined;

    render(
      <TestHarness
        initialSchema={schema}
        onReady={next => {
          controls = next;
        }}
      />
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("季度 (YYYY-Qn)"));

    expect(screen.queryByText("切换精度将清空该字段关联的联动字面量值")).not.toBeInTheDocument();
    expect((controls?.getSchema().presentations.pc.children[0] as DateField).granularity).toBe("quarter");
    expect(controls?.getPastLength()).toBe(1);
  });

  it("asks confirmation before discarding authored linkage literals, respects cancel, and supports one-step undo", async () => {
    const user = userEvent.setup();
    const schema: FormSchema = {
      id: "Form_1",
      version: 2,
      linkage: {
        rules: [
          {
            id: "form-r1",
            trigger: { kind: "load" },
            actions: [
              {
                type: "set_fields",
                assignments: [
                  {
                    targetKey: "period",
                    value: { kind: "literal", value: "2026-04-15" }
                  }
                ]
              }
            ]
          }
        ]
      },
      presentations: {
        pc: {
          children: [
            {
              id: "D1",
              type: "date",
              key: "period",
              label: "期间",
              linkage: {
                rules: [
                  {
                    id: "r1",
                    trigger: { kind: "load" },
                    actions: [
                      {
                        type: "assign",
                        value: { kind: "literal", value: "2026-04-15" }
                      }
                    ]
                  }
                ]
              }
            }
          ]
        },
        mobile: {
          children: [
            {
              id: "MD1",
              type: "date",
              key: "period",
              label: "期间"
            }
          ]
        }
      }
    };

    let controls: HarnessControls | undefined;

    render(
      <TestHarness
        initialSchema={schema}
        onReady={next => {
          controls = next;
        }}
      />
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("月 (YYYY-MM)"));

    expect(await screen.findByText("切换精度将清空该字段关联的联动字面量值")).toBeInTheDocument();

    // Canceling leaves schema and undo stack untouched.
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(controls?.getSchema()).toBe(schema);
    expect(controls?.getPastLength()).toBe(0);

    // Re-request and confirm.
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("月 (YYYY-MM)"));
    await user.click(await screen.findByRole("button", { name: "切换" }));

    const updated = controls?.getSchema();
    const updatedField = updated?.presentations.pc.children[0] as DateField;
    const updatedTwin = updated?.presentations.mobile?.children[0] as DateField;
    expect(updatedField.granularity).toBe("month");
    expect(updatedTwin.granularity).toBe("month");
    expect(updatedField.linkage?.rules?.[0]?.actions[0]).toEqual({
      type: "assign",
      value: { kind: "literal", value: "" }
    });
    expect(updated?.linkage?.rules?.[0]?.actions[0]).toEqual({
      type: "set_fields",
      assignments: [
        {
          targetKey: "period",
          value: { kind: "literal", value: "" }
        }
      ]
    });
    expect(controls?.getPastLength()).toBe(1);

    // Undoing restores field, twin, own literal, and root form linkage in one step.
    act(() => {
      controls?.undo();
    });
    expect(controls?.getSchema()).toBe(schema);
  });
});
