import type { FC } from "react";

import type { PropertyEntry, TextareaField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { textareaFieldDefinition } from "./index";

const baseField: TextareaField = {
  id: "Field_t",
  type: "textarea",
  key: "t",
  label: "备注"
};

function entry(id: string): PropertyEntry | undefined {
  return textareaFieldDefinition.properties?.flatMap(group => group.entries).find(item => item.id === id);
}

/**
 * Drives the textarea as a controlled component so a native `maxLength` cap is
 * observable through the rendered value.
 */
const ControlledTextarea: FC<{ field: TextareaField }> = ({ field }) => {
  const [value, setValue] = useState("");
  const { Component } = textareaFieldDefinition;

  if (!Component) {
    throw new Error("textarea field is missing a Component");
  }

  return <Component domId="field-t" field={field} value={value} onChange={next => setValue(String(next))} />;
};

describe("textarea field", () => {
  it("defines a keyed multi-line field", () => {
    expect(textareaFieldDefinition.config).toMatchObject({
      type: "textarea",
      keyed: true,
      group: "basic-input"
    });
    expect(textareaFieldDefinition.config.create()).toEqual({ type: "textarea", label: "多行文本" });
  });

  it("emits typed text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { Component } = textareaFieldDefinition;

    if (!Component) {
      throw new Error("textarea field is missing a Component");
    }

    render(<Component domId="field-t" field={baseField} value="" onChange={onChange} />);

    await user.type(screen.getByRole("textbox", { name: "备注" }), "h");

    expect(onChange).toHaveBeenCalledWith("h");
  });

  it("renders a character counter when showCount is enabled", async () => {
    const user = userEvent.setup();

    render(<ControlledTextarea field={{ ...baseField, showCount: true }} />);

    await user.type(screen.getByRole("textbox", { name: "备注" }), "abc");

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps input at maxLength", async () => {
    const user = userEvent.setup();

    render(<ControlledTextarea field={{ ...baseField, maxLength: 3 }} />);

    const textbox = screen.getByRole("textbox", { name: "备注" });
    await user.type(textbox, "abcdef");

    expect(textbox).toHaveValue("abc");
  });

  it("exposes the autoSize toggle under the appearance tab", () => {
    const appearance = textareaFieldDefinition.properties?.find(group => group.id === "appearance");

    expect(appearance?.tab).toBe("props");
    expect(appearance?.entries.map(item => item.id)).toContain("autoSize");
  });

  it("writes autoSize through its property entry", () => {
    const autoSize = entry("autoSize");

    expect(autoSize?.read(baseField)).toBeUndefined();
    expect(autoSize?.write(baseField, true)).toMatchObject({ autoSize: true });
    expect(autoSize?.write({ ...baseField, autoSize: true }, false)).toMatchObject({ autoSize: false });
  });
});
