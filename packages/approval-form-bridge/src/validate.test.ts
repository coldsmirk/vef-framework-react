import type { FormSchema } from "@vef-framework-react/form-editor";

import { createDefaultMobileRegistry, createDefaultRegistry } from "@vef-framework-react/form-editor";
import { describe, expect, it } from "vitest";

import { createApprovalRegistries } from "./registry";
import { validateApprovalSchema } from "./validate";

function schemaOf(children: FormSchema["presentations"]["pc"]["children"]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children } }
  };
}

describe("validateApprovalSchema", () => {
  it("short-circuits without projecting when the candidate is not a schema", () => {
    const result = validateApprovalSchema({ bogus: true }, createApprovalRegistries());

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every(issue => issue.severity === "error")).toBe(true);
  });

  it("accepts a projectable schema with no issues", () => {
    const result = validateApprovalSchema(schemaOf([
      {
        id: "F1",
        type: "textfield",
        key: "name",
        label: "姓名"
      }
    ]), createApprovalRegistries());

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("merges structural and projection issues in one pass", () => {
    // switch stays registered in the DEFAULT registries, so the structural
    // pass accepts it — only the projection layer rejects it. This pins the
    // gate's value for hosts that run a custom (non-approval) registry.
    const registries = { pc: createDefaultRegistry(), mobile: createDefaultMobileRegistry() };
    const result = validateApprovalSchema(schemaOf([
      {
        id: "F1",
        type: "switch",
        key: "flag",
        label: "开关"
      }
    ]), registries);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([expect.objectContaining({ code: "unmappable_field_type", severity: "error" })]);
  });

  it("rejects a nested subform that the designer itself accepts", () => {
    const result = validateApprovalSchema(schemaOf([
      {
        id: "Sub",
        type: "subform",
        variant: "stack",
        key: "items",
        label: "明细",
        template: [
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
    ]), createApprovalRegistries());

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "nested_subform_unsupported" })])
    );
  });

  it("stays valid on warning-only projections", () => {
    const result = validateApprovalSchema(schemaOf([
      {
        id: "F1",
        type: "select",
        key: "city",
        label: "城市",
        dataSource: { kind: "remote", request: { resource: "city", action: "list" } }
      }
    ]), createApprovalRegistries());

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([expect.objectContaining({ code: "options_not_static", severity: "warning" })]);
  });
});
