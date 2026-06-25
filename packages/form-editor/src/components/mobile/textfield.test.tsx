import type { TextfieldField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileTextfield } from "./textfield";

const baseField: TextfieldField = {
  id: "Field_t",
  type: "textfield",
  key: "t",
  label: "姓名"
};

describe("MobileTextfield", () => {
  it("renders the label and a text input", () => {
    render(<MobileTextfield domId="field-t" field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "姓名" })).toBeInTheDocument();
  });

  it("seeds the input with the current value", () => {
    render(<MobileTextfield domId="field-t" field={baseField} value="Ada" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Ada");
  });

  it("emits the raw typed string through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileTextfield domId="field-t" field={baseField} value="" onChange={onChange} />);

    await user.type(screen.getByRole("textbox", { name: "姓名" }), "h");

    expect(onChange).toHaveBeenCalledWith("h");
  });

  it("renders the placeholder when no value is set", () => {
    const field: TextfieldField = { ...baseField, placeholder: "请输入姓名" };

    render(<MobileTextfield domId="field-t" field={field} value="" onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText("请输入姓名")).toBeInTheDocument();
  });

  it("renders the helper text", () => {
    const field: TextfieldField = { ...baseField, helperText: "请填写真实姓名" };

    render(<MobileTextfield domId="field-t" field={field} value="" onChange={vi.fn()} />);

    expect(screen.getByText("请填写真实姓名")).toBeInTheDocument();
  });

  it("renders field errors", () => {
    render(<MobileTextfield domId="field-t" errors={["此项必填"]} field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("此项必填");
  });

  it("disables the input when disabled", () => {
    render(<MobileTextfield disabled domId="field-t" field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "姓名" })).toBeDisabled();
  });

  it("renders an empty disabled control without throwing", () => {
    render(<MobileTextfield disabled domId="field-t" field={baseField} value="" onChange={vi.fn()} />);

    const input = screen.getByRole("textbox", { name: "姓名" });

    expect(input).toBeDisabled();
    expect(input).toHaveValue("");
  });
});
