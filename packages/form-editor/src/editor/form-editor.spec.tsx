import type { FormSchema } from "../types";
import type { FormEditorApi } from "./form-editor";

import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";

import { FormEditor } from "./form-editor";

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

describe("FormEditor", () => {
  it("renders the pre-composed shell", async () => {
    render(<FormEditor initialSchema={makeSchema()} />);

    expect(await screen.findByRole("complementary", { name: "组件库" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "属性" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "撤销" })).toBeInTheDocument();
  });

  it("supports a host-composed shell from the same parts", async () => {
    render(
      <FormEditor.Provider initialSchema={makeSchema()}>
        <FormEditor.Shell>
          <div data-testid="host-toolbar">宿主工具栏</div>

          <FormEditor.Workspace>
            <FormEditor.Stage />
            <FormEditor.Properties />
          </FormEditor.Workspace>
        </FormEditor.Shell>
      </FormEditor.Provider>
    );

    // Host chrome and editor surfaces coexist; the palette was deliberately
    // left out and must not render.
    expect(await screen.findByTestId("host-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "属性" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "组件库" })).not.toBeInTheDocument();
  });

  describe("apiRef", () => {
    it("exposes the curated editor api to the host", async () => {
      const api = createRef<FormEditorApi>();
      const onSchemaChange = vi.fn();

      render(<FormEditor apiRef={api} initialSchema={makeSchema()} onSchemaChange={onSchemaChange} />);
      await screen.findByRole("complementary", { name: "组件库" });

      expect(api.current?.getSchema().id).toBe("Form_1");
      expect(api.current?.canUndo()).toBe(false);

      act(() => {
        api.current?.setSchema({ ...makeSchema(), id: "Form_2" });
      });

      expect(api.current?.getSchema().id).toBe("Form_2");
      expect(onSchemaChange).toHaveBeenCalledWith(expect.objectContaining({ id: "Form_2" }));
      // A wholesale replace carries import semantics: the undo timeline resets
      // rather than offering a step back across two unrelated documents.
      expect(api.current?.canUndo()).toBe(false);
    });
  });
});
