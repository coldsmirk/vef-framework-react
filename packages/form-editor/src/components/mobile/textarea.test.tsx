import type { TextareaField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MobileTextarea } from "./textarea";

const baseField: TextareaField = {
  id: "Field_a",
  type: "textarea",
  key: "a",
  label: "备注"
};

describe("MobileTextarea", () => {
  it("renders the label and a multi-line input", () => {
    render(<MobileTextarea domId="field-a" field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "备注" })).toBeInTheDocument();
  });

  it("seeds the textarea with the current value", () => {
    render(<MobileTextarea domId="field-a" field={baseField} value="multi line note" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "备注" })).toHaveValue("multi line note");
  });

  it("emits the raw typed string through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MobileTextarea domId="field-a" field={baseField} value="" onChange={onChange} />);

    await user.type(screen.getByRole("textbox", { name: "备注" }), "h");

    expect(onChange).toHaveBeenCalledWith("h");
  });

  it("renders the placeholder when no value is set", () => {
    const field: TextareaField = { ...baseField, placeholder: "请输入备注" };

    render(<MobileTextarea domId="field-a" field={field} value="" onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText("请输入备注")).toBeInTheDocument();
  });

  it("renders the helper text", () => {
    const field: TextareaField = { ...baseField, helperText: "最多 200 字" };

    render(<MobileTextarea domId="field-a" field={field} value="" onChange={vi.fn()} />);

    expect(screen.getByText("最多 200 字")).toBeInTheDocument();
  });

  it("renders field errors", () => {
    render(<MobileTextarea domId="field-a" errors={["此项必填"]} field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("此项必填");
  });

  it("disables the textarea when disabled", () => {
    render(<MobileTextarea disabled domId="field-a" field={baseField} value="" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "备注" })).toBeDisabled();
  });

  it("renders an empty disabled control without throwing", () => {
    render(<MobileTextarea disabled domId="field-a" field={baseField} value="" onChange={vi.fn()} />);

    const input = screen.getByRole("textbox", { name: "备注" });

    expect(input).toBeDisabled();
    expect(input).toHaveValue("");
  });
});
