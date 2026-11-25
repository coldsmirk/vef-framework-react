import type { HeadingField } from "../../types";

import { render, screen } from "@testing-library/react";

import { MobileHeading } from "./heading";

function headingField(overrides: Partial<HeadingField> = {}): HeadingField {
  return {
    id: "H",
    type: "heading",
    text: "输血申请单",
    ...overrides
  };
}

describe("MobileHeading", () => {
  it("renders a third-level heading when no level is set", () => {
    render(<MobileHeading domId="field-h" field={headingField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 3, name: "输血申请单" })).toBeInTheDocument();
  });

  it("renders the configured level and alignment", () => {
    render(
      <MobileHeading
        domId="field-h"
        field={headingField({ level: 1, align: "center" })}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveStyle({ textAlign: "center" });
  });

  it("renders empty without throwing when no text is set", () => {
    expect(() => render(
      <MobileHeading
        domId="field-h"
        field={headingField({ text: undefined })}
        value={undefined}
        onChange={vi.fn()}
      />
    )).not.toThrow();
  });
});
