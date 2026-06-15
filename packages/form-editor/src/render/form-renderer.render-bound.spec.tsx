import type { FC } from "react";

import type { Block, FieldComponentProps, FieldDefinition, FieldLinkage, FormSchema, SubformNode, TextfieldField } from "../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

/**
 * Render-count fence for the runtime renderer's O(k)-per-keystroke guarantee.
 *
 * Each field is counted by its per-row-unique `domId`, via a test-only keyed
 * field registered through the public registry API. The tests assert the
 * re-render bound (not a wall-clock timer), and each pins a specific mechanism
 * so a regression fails loudly:
 * - a value subscription back in `FormRenderer` → "unrelated field" fails;
 * - a lost `stabilizeStateMap` → "visible linked field whose outcome is
 * unchanged" fails (without it that field gets a fresh state object, hence a
 * new selector slice, every keystroke);
 * - a lost `React.memo(BlockCell)` → "existing rows when a row is added" fails;
 * - a lost `React.memo(SubformRow)` (or unstable row props) → "row controllers"
 * fails (it counts per-row linkage evaluations through the evaluator seam).
 *
 * NB: a field with NO linkage rides the stable `emptyRuntimeState` singleton, so
 * it cannot fence the stabilizer — the stabilizer fence below uses a *linked*
 * field, which always gets a freshly-built state object from `evaluateLinkage`.
 */
const renderCounts = new Map<string, number>();

const ProbeInput: FC<FieldComponentProps<TextfieldField, string>> = ({
  domId,
  value = "",
  onChange
}) => {
  renderCounts.set(domId, (renderCounts.get(domId) ?? 0) + 1);

  return <input aria-label={domId} value={value} onChange={event => onChange(event.target.value)} />;
};

// A synthetic keyed field whose Component just counts its renders. The casts
// bridge the static field-type union to the runtime-dynamic registry (the
// registry dispatches on the `type` string, which is what the renderer reads).
const probeDefinition = {
  config: {
    type: "probe",
    name: "Probe",
    group: "basic-input",
    keyed: true,
    create: () => {
      return { type: "probe" };
    }
  },
  Component: ProbeInput,
  properties: []
} as unknown as FieldDefinition;

function probe(key: string, overrides: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id: `Field_${key}`,
    type: "probe",
    key,
    label: key,
    ...overrides
  } as unknown as TextfieldField;
}

/**
 * Hidden by default, shown when `sourceKey` equals `value`.
 */
function showWhen(sourceKey: string, value: string): FieldLinkage {
  return {
    defaults: { hidden: true },
    rules: [
      {
        id: `Rule_${sourceKey}`,
        trigger: {
          kind: "condition",
          condition: {
            kind: "leaf",
            sourceKey,
            operator: "eq",
            value
          }
        },
        actions: [{ type: "show" }]
      }
    ]
  };
}

/**
 * Visible, but carries a rule (disable when `sourceKey === value`). Used to give
 * a field real linkage whose outcome does NOT flip in a test — so it exercises
 * the reference stabilizer rather than the `emptyRuntimeState` singleton.
 */
function disableWhen(sourceKey: string, value: string): FieldLinkage {
  return {
    rules: [
      {
        id: `Rule_dis_${sourceKey}`,
        trigger: {
          kind: "condition",
          condition: {
            kind: "leaf",
            sourceKey,
            operator: "eq",
            value
          }
        },
        actions: [{ type: "disable" }]
      }
    ]
  };
}

function stack(...blocks: Block[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: blocks } }
  };
}

/**
 * The controller-fence subform: `tag` discriminates rows; `gated` carries an
 * expression-condition rule, so every controller evaluation calls the injected
 * expression evaluator with that row's record.
 */
function probedSubform(): SubformNode {
  return {
    id: "Sub_lines",
    type: "subform",
    variant: "stack",
    key: "lines",
    addLabel: "新增一行",
    template: [
      probe("tag"),
      probe("gated", {
        linkage: {
          rules: [
            {
              id: "Rule_expr",
              trigger: { kind: "condition", condition: { kind: "expression", source: "$form.never" } },
              actions: [{ type: "disable" }]
            }
          ]
        }
      })
    ]
  };
}

function renderRuntime(schema: FormSchema): void {
  const registry = createDefaultRegistry();
  registry.register(probeDefinition);

  render(
    <RegistryProvider registries={{ pc: registry, mobile: registry }}>
      <FormRenderer schema={schema} />
    </RegistryProvider>
  );
}

beforeEach(() => {
  renderCounts.clear();
});

describe("FormRenderer render bound", () => {
  it("does not re-render an unrelated field when typing into a sibling", async () => {
    const user = userEvent.setup();
    renderRuntime(stack(probe("a"), probe("b"), probe("c", { linkage: showWhen("a", "x") })));

    const before = new Map(renderCounts);
    await user.type(screen.getByLabelText("field-Field_b"), "z");

    // `a` neither holds the typed value nor depends on it: it must not re-render.
    expect(renderCounts.get("field-Field_a")).toBe(before.get("field-Field_a"));
    // `b` is the typed field, so it does re-render.
    expect(renderCounts.get("field-Field_b") ?? 0).toBeGreaterThan(before.get("field-Field_b") ?? 0);
  });

  it("re-renders only the field whose linkage outcome flips", async () => {
    const user = userEvent.setup();
    renderRuntime(stack(probe("a"), probe("c", { linkage: showWhen("a", "x") }), probe("d")));

    const before = new Map(renderCounts);
    await user.type(screen.getByLabelText("field-Field_a"), "x");

    // `d` depends on nothing — flipping `c` must leave it untouched.
    expect(renderCounts.get("field-Field_d")).toBe(before.get("field-Field_d"));
    // `c` flipped visible.
    expect(await screen.findByLabelText("field-Field_c")).toBeInTheDocument();
  });

  it("isolates subform rows: typing in one row does not re-render another row's fields", async () => {
    const user = userEvent.setup();
    const subform: SubformNode = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      minRows: 2,
      template: [
        probe("category"),
        probe("note", { linkage: showWhen("category", "other") })
      ]
    };
    renderRuntime({
      id: "Form_1",
      version: 2,
      presentations: { pc: { children: [subform] } }
    });

    const before = new Map(renderCounts);
    await user.type(screen.getByLabelText("field-lines[0].Field_category"), "other");

    // Row 1's always-visible field must not re-render when row 0 changes — each
    // row's own controller subscribes to only its slice, so row 1 never re-evaluates.
    expect(renderCounts.get("field-lines[1].Field_category")).toBe(before.get("field-lines[1].Field_category"));
    // Row 0's note flipped visible; row 1's note stays hidden.
    expect(await screen.findByLabelText("field-lines[0].Field_note")).toBeInTheDocument();
    expect(screen.queryByLabelText("field-lines[1].Field_note")).not.toBeInTheDocument();
  });

  it("does not re-render a visible linked field whose outcome does not change (stabilizer fence)", async () => {
    const user = userEvent.setup();
    // `e` is visible and HAS linkage (so evaluateLinkage rebuilds its state
    // object every keystroke), but its outcome never flips. Only the per-entry
    // reference reuse in stabilizeStateMap keeps it from re-rendering when an
    // unrelated source (`a`, which flips `b`) changes. Revert the stabilizer to
    // `return next` and this fails.
    renderRuntime(stack(
      probe("a"),
      probe("b", { linkage: showWhen("a", "x") }),
      probe("e", { linkage: disableWhen("a", "ZZZ") })
    ));

    const before = new Map(renderCounts);
    await user.type(screen.getByLabelText("field-Field_a"), "x");

    expect(renderCounts.get("field-Field_e")).toBe(before.get("field-Field_e"));
  });

  it("does not re-render existing subform rows when a row is added (memo fence)", async () => {
    const user = userEvent.setup();
    const subform: SubformNode = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      minRows: 2,
      template: [probe("amount")]
    };
    renderRuntime({
      id: "Form_1",
      version: 2,
      presentations: { pc: { children: [subform] } }
    });

    const before = new Map(renderCounts);
    // Adding a row re-runs the array field's render-prop, which re-renders every
    // SubformRow element. React.memo(BlockCell) (with the memoized rowCtx) keeps
    // the EXISTING rows' field cells from re-rendering. Revert the memo and this fails.
    await user.click(screen.getByRole("button", { name: /新增一行/ }));

    expect(renderCounts.get("field-lines[0].Field_amount")).toBe(before.get("field-lines[0].Field_amount"));
    expect(renderCounts.get("field-lines[1].Field_amount")).toBe(before.get("field-lines[1].Field_amount"));
  });

  describe("subform controller fence", () => {
    // Per-row evaluation probe: each row's controller evaluates its template's
    // expression-condition rule against that row's own record, so recording the
    // `tag` value seen by the evaluator counts controller evaluations per row.
    const evaluatedTags: unknown[] = [];

    const evaluateExpression = (_source: string, values: Record<string, unknown>): boolean => {
      evaluatedTags.push(values.tag);

      return false;
    };

    function renderProbedSubform(): void {
      const registry = createDefaultRegistry();
      registry.register(probeDefinition);

      render(
        <RegistryProvider registries={{ pc: registry, mobile: registry }}>
          <FormRenderer
            defaultValues={{ lines: [{ tag: "r0", gated: "" }, { tag: "r1", gated: "" }] }}
            evaluators={{ evaluateExpression }}
            schema={stack(probedSubform())}
          />
        </RegistryProvider>
      );
      evaluatedTags.length = 0;
    }

    it("does not re-run another row's controller when typing in one row", async () => {
      const user = userEvent.setup();
      renderProbedSubform();

      await user.type(screen.getByLabelText("field-lines[0].Field_tag"), "x");

      // The array field subscribes to structural changes only (TanStack's
      // `_arrayVersion`), so a keystroke inside row 0 must re-evaluate row 0's
      // controller and leave row 1's untouched.
      expect(evaluatedTags).toContain("r0x");
      expect(evaluatedTags).not.toContain("r1");
    });

    it("does not re-run existing rows' controllers when a row is added", async () => {
      const user = userEvent.setup();
      renderProbedSubform();

      // Adding a row re-runs the array field's render prop with every row's
      // element; only `memo(SubformRow)` with stable props (notably the stable
      // remove handler) keeps the existing rows' controllers from re-running —
      // without it every structural change re-evaluates O(rows × template).
      await user.click(screen.getByRole("button", { name: /新增一行/ }));

      expect(evaluatedTags).not.toContain("r0");
      expect(evaluatedTags).not.toContain("r1");
      // The new (blank) row evaluates once for itself.
      expect(evaluatedTags).toContain("");
    });
  });
});
