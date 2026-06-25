import type { DynamicIconName } from "@vef-framework-react/components";

import type { ButtonField, FormSchema } from "../../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { definePropertyEntry } from "../../../types";
import { IconEntry } from "./icon-entry";

// jsdom reports zero-size boxes, starving the icon grid's virtualizer. Give it a
// real viewport so the cells mount when the popup opens.
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 320 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 264 });
});

afterAll(() => {
  if (originalOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
  }

  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  }
});

const entry = definePropertyEntry<ButtonField, DynamicIconName | undefined>({
  id: "icon",
  label: "图标",
  type: "icon",
  description: "按钮图标",
  placeholder: "选择图标",
  read: field => field.icon,
  write: (field, icon) => { return { ...field, icon }; }
});

function makeField(icon?: DynamicIconName): ButtonField {
  return {
    id: "Field_1",
    type: "button",
    icon
  };
}

const schema: FormSchema = {
  id: "Form_1",
  version: 2,
  presentations: { pc: { children: [] } }
};

describe("IconEntry", () => {
  it("renders the entry label, selected icon, and description", () => {
    render(<IconEntry entry={entry} field={makeField("house")} schema={schema} onChange={vi.fn()} />);

    expect(screen.getByText("图标")).toBeInTheDocument();
    expect(screen.getByText("house")).toBeInTheDocument();
    expect(screen.getByText("按钮图标")).toBeInTheDocument();
  });

  it("renders an unset value with the placeholder", () => {
    render(<IconEntry entry={entry} field={makeField()} schema={schema} onChange={vi.fn()} />);

    expect(screen.getByText("选择图标")).toBeInTheDocument();
  });

  it("forwards the picked icon through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<IconEntry entry={entry} field={makeField()} schema={schema} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "heart");
    await user.click(await screen.findByRole("button", { name: "heart-handshake" }));

    expect(onChange).toHaveBeenCalledWith("heart-handshake");
  });

  it("clears the icon to undefined through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<IconEntry entry={entry} field={makeField("house")} schema={schema} onChange={onChange} />);

    // form-editor specs render without the VEF ConfigProvider, so antd uses its
    // default `ant-` prefix. The clear control is an unlabeled internal element.

    const clear = screen.getByRole("combobox").closest(".ant-select")?.querySelector(".ant-select-clear");

    if (!(clear instanceof HTMLElement)) {
      throw new TypeError("clear control not found");
    }

    await user.click(clear);

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
