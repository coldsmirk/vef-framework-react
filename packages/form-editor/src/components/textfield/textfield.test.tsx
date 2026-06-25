import type { TextfieldField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Textfield } from ".";

const baseField: TextfieldField = {
  id: "Field_t",
  type: "textfield",
  key: "t",
  label: "姓名"
};

describe("Textfield", () => {
  it("renders the label and a text input", () => {
    render(<Textfield domId="field-t" field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "姓名" })).toBeInTheDocument();
  });

  it("seeds the input with the current value", () => {
    render(<Textfield domId="field-t" field={baseField} value="Ada" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Ada");
  });

  it("emits the raw typed string through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Textfield domId="field-t" field={baseField} value="" onChange={onChange} />);

    await user.type(screen.getByRole("textbox", { name: "姓名" }), "h");

    expect(onChange).toHaveBeenCalledWith("h");
  });

  it("renders the placeholder when no value is set", () => {
    const field: TextfieldField = { ...baseField, placeholder: "请输入姓名" };

    render(<Textfield domId="field-t" field={field} value="" onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText("请输入姓名")).toBeInTheDocument();
  });

  it("renders the helper text", () => {
    const field: TextfieldField = { ...baseField, helperText: "请填写真实姓名" };

    render(<Textfield domId="field-t" field={field} value="" onChange={vi.fn()} />);

    expect(screen.getByText("请填写真实姓名")).toBeInTheDocument();
  });

  it("renders field errors with the error status", () => {
    render(<Textfield domId="field-t" errors={["此项必填"]} field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("此项必填");
  });

  it("marks the label when required", () => {
    render(<Textfield required domId="field-t" field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("disables the input when disabled", () => {
    render(<Textfield disabled domId="field-t" field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "姓名" })).toBeDisabled();
  });

  it("renders the configured prefix icon", () => {
    const field: TextfieldField = { ...baseField, prefixIcon: "house" };

    render(<Textfield domId="field-t" field={field} value="" onChange={vi.fn()} />);

    const prefixIcon = screen.getByRole("textbox", { name: "姓名" }).parentElement?.querySelector("svg");

    expect(prefixIcon).toBeInTheDocument();
  });

  it("masks the value when inputType is password", () => {
    const field: TextfieldField = {
      ...baseField,
      inputType: "password",
      placeholder: "请输入密码"
    };

    render(<Textfield domId="field-t" field={field} value="secret" onChange={vi.fn()} />);

    // A masked input exposes no `textbox` role, so query by its placeholder.
    expect(screen.getByPlaceholderText("请输入密码")).toHaveAttribute("type", "password");
  });

  it("caps the native input with maxLength", () => {
    const field: TextfieldField = { ...baseField, maxLength: 5 };

    render(<Textfield domId="field-t" field={field} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "姓名" })).toHaveAttribute("maxlength", "5");
  });

  it("renders a clear control when allowClear is set and there is text", () => {
    const field: TextfieldField = { ...baseField, allowClear: true };

    render(<Textfield domId="field-t" field={field} value="Ada" onChange={vi.fn()} />);

    // antd's clear affordance is a button carrying a `close-circle` glyph.
    expect(screen.getByRole("button")).toContainElement(screen.getByRole("img", { name: "close-circle" }));
  });

  it("omits the clear control when allowClear is set but there is no text", () => {
    const field: TextfieldField = { ...baseField, allowClear: true };

    render(<Textfield domId="field-t" field={field} value="" onChange={vi.fn()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
