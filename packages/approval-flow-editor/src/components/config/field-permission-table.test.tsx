import type { EditorPlugins } from "../../plugins";
import type { FormFieldDefinition } from "../../types";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EditorPluginsContext } from "../../plugins";
import { FieldPermissionTable } from "./field-permission-table";

const PERMISSIONS = [
  { label: "可见", value: "visible" },
  { label: "可编辑", value: "editable" },
  { label: "隐藏", value: "hidden" },
  { label: "必填", value: "required" }
] as const;

const WARNING_LABEL = "必填与联动隐藏冲突提示";

function renderTable(input: { formFields: FormFieldDefinition[]; value: Record<string, string> }) {
  const plugins: EditorPlugins = { formFields: input.formFields };

  return render(
    <EditorPluginsContext value={plugins}>
      <FieldPermissionTable permissions={[...PERMISSIONS]} value={input.value} onChange={() => undefined} />
    </EditorPluginsContext>
  );
}

describe("FieldPermissionTable conditional-visibility hint", () => {
  it("warns when required is selected for a conditionally-hidden field", () => {
    renderTable({
      formFields: [
        {
          key: "a",
          kind: "input",
          label: "甲",
          hasConditionalVisibility: true
        }
      ],
      value: { a: "required" }
    });

    expect(screen.getByRole("img", { name: WARNING_LABEL })).toBeInTheDocument();
  });

  it("does not warn when required is selected for a plain field", () => {
    renderTable({
      formFields: [
        {
          key: "a",
          kind: "input",
          label: "甲"
        }
      ],
      value: { a: "required" }
    });

    expect(screen.queryByRole("img", { name: WARNING_LABEL })).not.toBeInTheDocument();
  });

  it("does not warn when a conditionally-hidden field is only visible", () => {
    renderTable({
      formFields: [
        {
          key: "a",
          kind: "input",
          label: "甲",
          hasConditionalVisibility: true
        }
      ],
      value: { a: "visible" }
    });

    expect(screen.queryByRole("img", { name: WARNING_LABEL })).not.toBeInTheDocument();
  });
});
