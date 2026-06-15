import type { ButtonField } from "../../types";

import { render, screen } from "@testing-library/react";

import { MobileButton } from "./button";

function buttonField(overrides: Partial<ButtonField> = {}): ButtonField {
  return {
    id: "Field_submit",
    type: "button",
    label: "提交",
    action: "submit",
    ...overrides
  };
}

describe("MobileButton", () => {
  it("renders the field label", () => {
    render(<MobileButton domId="submit-button" field={buttonField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "提交" })).toBeInTheDocument();
  });

  it("falls back to a default label when none is set", () => {
    render(
      <MobileButton
        domId="b"
        field={buttonField({ label: undefined })}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "按钮" })).toBeInTheDocument();
  });

  it("maps the submit action to the native submit type", () => {
    render(<MobileButton domId="b" field={buttonField({ action: "submit" })} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("maps the reset action to the native reset type", () => {
    render(<MobileButton domId="b" field={buttonField({ action: "reset" })} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveAttribute("type", "reset");
  });

  it("defaults the native type to submit when no action is set", () => {
    render(
      <MobileButton
        domId="b"
        field={buttonField({ action: undefined })}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("disables the control when disabled", () => {
    render(<MobileButton disabled domId="b" field={buttonField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders without throwing when value is undefined and disabled in edit mode", () => {
    expect(() => render(
      <MobileButton
        disabled
        domId="b"
        field={buttonField({ label: undefined })}
        value={undefined}
        onChange={vi.fn()}
      />
    )).not.toThrow();
  });
});
