import type { ReactElement } from "react";

import type { FormSchemaPatch } from "../../store/form-store";
import type { FormSchema, PresentationLayer } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { FormBasicsTab } from "./form-basics-tab";

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "name",
            label: "姓名"
          }
        ]
      }
    }
  };
}

function makeLayer(schema: FormSchema): PresentationLayer {
  return schema.presentations.pc ?? { children: [] };
}

/**
 * Mirrors the drawer's wiring: committed patches flow back into the schema
 * prop, so the tab renders against the post-patch state like in the editor.
 */
function ControlledTab({ onPatch }: { onPatch: (patch: FormSchemaPatch) => void }): ReactElement {
  const [schema, setSchema] = useState(makeSchema);

  const handlePatch = (patch: FormSchemaPatch): void => {
    onPatch(patch);
    setSchema(prev => {
      const { gap, ...shared } = patch;

      void gap;
      return { ...prev, ...shared };
    });
  };

  return <FormBasicsTab fieldCount={1} layer={makeLayer(schema)} schema={schema} onPatch={handlePatch} />;
}

function setupTab(onPatch = vi.fn()): ReturnType<typeof vi.fn> {
  render(<ControlledTab onPatch={onPatch} />);

  return onPatch;
}

describe("FormBasicsTab", () => {
  it("renders the schema id and the layout stats", () => {
    setupTab();

    expect(screen.getByLabelText("表单 ID")).toHaveValue("Form_1");
    expect(screen.getByText("字段数量")).toBeInTheDocument();
  });

  describe("form id", () => {
    it("commits a valid id edit", async () => {
      const user = userEvent.setup();
      const onPatch = setupTab();

      await user.type(screen.getByLabelText("表单 ID"), "x");

      expect(onPatch).toHaveBeenCalledWith({ id: "Form_1x" });
    });

    it("refuses to commit a cleared id and shows inline feedback", async () => {
      const user = userEvent.setup();
      const onPatch = setupTab();

      await user.clear(screen.getByLabelText("表单 ID"));

      expect(onPatch).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("表单 ID 不能为空");
      // The invalid draft stays visible rather than silently reverting.
      expect(screen.getByLabelText("表单 ID")).toHaveValue("");
    });

    it("treats a whitespace-only id as empty", async () => {
      const user = userEvent.setup();
      const onPatch = setupTab();
      const input = screen.getByLabelText("表单 ID");

      await user.clear(input);
      await user.type(input, " ");

      expect(onPatch).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("recovers and commits once the id becomes valid again", async () => {
      const user = userEvent.setup();
      const onPatch = setupTab();
      const input = screen.getByLabelText("表单 ID");

      await user.clear(input);
      await user.type(input, "Form_2");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(onPatch).toHaveBeenLastCalledWith({ id: "Form_2" });
    });
  });

  describe("layout gap", () => {
    it("patches the selected gap preset", async () => {
      const user = userEvent.setup();
      const onPatch = setupTab();

      await user.click(screen.getByLabelText("元素间距"));
      await user.click(await screen.findByText("大"));

      expect(onPatch).toHaveBeenCalledWith({ gap: "large" });
    });
  });
});
