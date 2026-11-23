import type { DateField, FormSchema } from "../../../types";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { dateGranularityEntry } from "../../../components/field-entries";
import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../../store/form-store";
import { DateGranularityEntry } from "./date-granularity-entry";

function TestHarness({
  initialSchema,
  onReady
}: {
  initialSchema: FormSchema;
  onReady?: (getSchema: () => FormSchema, undo: () => void) => void;
}) {
  return (
    <FormEditorStoreProvider initialState={{ schema: initialSchema }}>
      <HarnessInner onReady={onReady} />
    </FormEditorStoreProvider>
  );
}

function HarnessInner({ onReady }: { onReady?: (getSchema: () => FormSchema, undo: () => void) => void }) {
  const storeApi = useFormEditorStoreApi();
  const schema = useFormEditorStore(state => state.schema);
  const field = schema.presentations.pc.children[0] as DateField | undefined;

  onReady?.(
    () => storeApi.getState().schema,
    () => storeApi.getState().undo()
  );

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

    let getSchema: (() => FormSchema) | undefined;

    render(
      <TestHarness
        initialSchema={schema}
        onReady={readSchema => {
          getSchema = readSchema;
        }}
      />
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("季度 (YYYY-Qn)"));

    expect(screen.queryByText("切换精度将清空该字段关联的联动字面量值")).not.toBeInTheDocument();
    expect((getSchema?.().presentations.pc.children[0] as DateField).granularity).toBe("quarter");
  });

  it("asks confirmation before discarding authored linkage literals", async () => {
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
        }
      }
    };

    let getSchema: (() => FormSchema) | undefined;
    let undo: (() => void) | undefined;

    render(
      <TestHarness
        initialSchema={schema}
        onReady={(readSchema, triggerUndo) => {
          getSchema = readSchema;
          undo = triggerUndo;
        }}
      />
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("月 (YYYY-MM)"));

    expect(await screen.findByText("切换精度将清空该字段关联的联动字面量值")).toBeInTheDocument();

    // Before confirming, the granularity and linkage literal remain untouched.
    const pendingField = getSchema?.().presentations.pc.children[0] as DateField;
    expect(pendingField.granularity).toBeUndefined();
    expect(pendingField.linkage?.rules?.[0]?.actions[0]).toEqual({
      type: "assign",
      value: { kind: "literal", value: "2026-04-15" }
    });

    await user.click(screen.getByRole("button", { name: "切 换" }));

    const updatedField = getSchema?.().presentations.pc.children[0] as DateField;
    expect(updatedField.granularity).toBe("month");
    expect(updatedField.linkage?.rules?.[0]?.actions[0]).toEqual({
      type: "assign",
      value: { kind: "literal", value: "" }
    });

    // Undoing restores both the previous granularity and the linkage literal in one step.
    act(() => {
      undo?.();
    });
    const restoredField = getSchema?.().presentations.pc.children[0] as DateField;
    expect(restoredField.granularity).toBeUndefined();
    expect(restoredField.linkage?.rules?.[0]?.actions[0]).toEqual({
      type: "assign",
      value: { kind: "literal", value: "2026-04-15" }
    });
  });
});
