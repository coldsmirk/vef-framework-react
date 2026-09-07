import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldShell } from "./field-shell";

describe("FieldShell label association", () => {
  it("associates a single control by htmlFor", () => {
    render(
      <FieldShell domId="f1" label="姓名">
        <input id="f1" />
      </FieldShell>
    );

    expect(screen.getByRole("textbox", { name: "姓名" })).toBeInTheDocument();
  });

  it("names a group-shaped field through aria-labelledby", () => {
    // `<label for>` only associates with a labelable element, so a radio /
    // checkbox group, the upload dropzone and the code editor had NO accessible
    // name — a reader announced the first option and nothing about the question.
    render(
      <FieldShell required domId="f2" label="性别" labelledBy="group">
        <input type="radio" />
      </FieldShell>
    );

    const group = screen.getByRole("group", { name: "性别" });

    // Read the attribute node directly. jest-dom's `toBeRequired` only
    // understands form controls and reports a `role="group"` wrapper as not
    // required — and its autofix rewrites both `toHaveAttribute` and
    // `getAttribute` comparisons into it, so this is the form that survives.
    expect(group.attributes.getNamedItem("aria-required")?.value).toBe("true");
    expect(group).toContainElement(screen.getByRole("radio"));
  });

  it("marks a group invalid when it carries errors", () => {
    render(
      <FieldShell domId="f3" errors={["此项为必填"]} label="爱好" labelledBy="group">
        <input type="checkbox" />
      </FieldShell>
    );

    expect(screen.getByRole("group", { name: "爱好" })).toHaveAttribute("aria-invalid", "true");
  });
});
