import type { AlertBlockField } from "../../types";

import { render, screen } from "@testing-library/react";

import { MobileAlertBlock } from "./alert-block";

function alertField(overrides: Partial<AlertBlockField> = {}): AlertBlockField {
  return {
    id: "A",
    type: "alert-block",
    message: "注意",
    alertType: "info",
    ...overrides
  };
}

describe("MobileAlertBlock", () => {
  it("renders the message", () => {
    render(<MobileAlertBlock domId="field-a" field={alertField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("注意")).toBeInTheDocument();
  });

  it("renders the description alongside the message", () => {
    render(
      <MobileAlertBlock
        domId="field-a"
        field={alertField({ description: "请仔细填写" })}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("注意")).toBeInTheDocument();
    expect(screen.getByText("请仔细填写")).toBeInTheDocument();
  });

  it("omits the description when none is set", () => {
    render(<MobileAlertBlock domId="field-a" field={alertField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.queryByText("请仔细填写")).not.toBeInTheDocument();
  });

  it("renders without throwing for the warning tone", () => {
    expect(() => render(
      <MobileAlertBlock
        domId="field-a"
        field={alertField({ alertType: "warning" })}
        value={undefined}
        onChange={vi.fn()}
      />
    )).not.toThrow();
  });

  it("renders without throwing when value is undefined and disabled in edit mode", () => {
    expect(() => render(
      <MobileAlertBlock
        disabled
        domId="field-a"
        field={alertField()}
        value={undefined}
        onChange={vi.fn()}
      />
    )).not.toThrow();
  });
});
