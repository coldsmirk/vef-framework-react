import type { Block, SubformNode } from "../../types";

import { deriveDefaultValues } from "./evaluator";

/**
 * Focused coverage for `deriveDefaultValues`' subform-row seeding. The broader
 * linkage-engine behavior lives in `index.spec.ts`; this file owns the
 * default-value derivation contract (typed blank seeds, host-row merging).
 */

function textfield(key: string): Block {
  return {
    id: `Field_${key}`,
    type: "textfield",
    key,
    label: key
  };
}

function subform(template: Block[], overrides: Partial<SubformNode> = {}): SubformNode {
  return {
    id: "Sub_lines",
    type: "subform",
    variant: "stack",
    key: "lines",
    template,
    ...overrides
  };
}

describe("deriveDefaultValues", () => {
  describe("typed blank seeds", () => {
    it("seeds minRows rows with type-appropriate defaults per field type", () => {
      const node = subform(
        [
          textfield("name"),
          {
            id: "Field_qty",
            type: "number",
            key: "qty",
            label: "qty"
          },
          {
            id: "Field_active",
            type: "switch",
            key: "active",
            label: "active"
          },
          {
            id: "Field_tags",
            type: "checkbox-group",
            key: "tags",
            label: "tags"
          },
          {
            id: "Field_period",
            type: "daterange",
            key: "period",
            label: "period"
          }
        ],
        { minRows: 1 }
      );

      const values = deriveDefaultValues({ id: "F", children: [node] });

      expect(values.lines).toEqual([
        {
          name: "",
          qty: undefined,
          active: false,
          tags: [],
          period: []
        }
      ]);
    });
  });

  describe("host-supplied initial rows", () => {
    it("fills a row record missing a template key with the field's default", () => {
      const node = subform([textfield("name"), textfield("note")]);

      const values = deriveDefaultValues(
        { id: "F", children: [node] },
        { lines: [{ name: "alpha" }] }
      );

      // `note` was absent from the supplied row; the blank-row seed provides
      // its defined slot so TanStack Form never sees an uncontrolled field.
      expect(values.lines).toEqual([{ name: "alpha", note: "" }]);
    });

    it("keeps supplied row values over the blank seed", () => {
      const node = subform([
        textfield("name"),
        {
          id: "Field_active",
          type: "switch",
          key: "active",
          label: "active"
        }
      ]);

      const values = deriveDefaultValues(
        { id: "F", children: [node] },
        { lines: [{ name: "alpha", active: true }] }
      );

      expect(values.lines).toEqual([{ name: "alpha", active: true }]);
    });

    it("seeds each supplied row independently", () => {
      const node = subform([textfield("name")]);

      const values = deriveDefaultValues(
        { id: "F", children: [node] },
        { lines: [{}, { name: "beta" }] }
      );

      const rows = values.lines as Array<Record<string, unknown>>;
      expect(rows).toEqual([{ name: "" }, { name: "beta" }]);
      // Distinct row objects — a shared seed reference would alias edits.
      expect(rows[0]).not.toBe(rows[1]);
    });
  });
});
