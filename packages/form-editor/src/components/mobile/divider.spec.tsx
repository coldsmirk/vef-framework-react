import type { DividerField } from "../../types";

import { render, screen } from "@testing-library/react";

import { MobileDivider } from "./divider";

function dividerField(overrides: Partial<DividerField> = {}): DividerField {
  return {
    id: "D",
    type: "divider",
    ...overrides
  };
}

describe("MobileDivider", () => {
  it("renders the title as content", () => {
    render(<MobileDivider domId="field-d" field={dividerField({ title: "分组" })} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("分组")).toBeInTheDocument();
  });

  it("renders without a title when none is set", () => {
    render(<MobileDivider domId="field-d" field={dividerField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.queryByText("分组")).not.toBeInTheDocument();
  });

  it("renders without throwing when value is undefined and disabled in edit mode", () => {
    expect(() => render(
      <MobileDivider
        disabled
        domId="field-d"
        field={dividerField()}
        value={undefined}
        onChange={vi.fn()}
      />
    )).not.toThrow();
  });
});
