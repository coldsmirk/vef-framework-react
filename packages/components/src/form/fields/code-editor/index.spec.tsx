import type { FormApi } from "../../types";
import type { CodeEditorFieldProps } from "./props";

import { EditorView } from "@codemirror/view";

import { render, screen, waitFor } from "../../../../test-utils";
import { useForm } from "../../use-form";

interface TestValues {
  source: string | null;
}

type TestFormApi = FormApi<TestValues>;

interface TestFormProps extends CodeEditorFieldProps {
  defaultValue?: string | null;
  formDisabled?: boolean;
  onForm?: (form: TestFormApi) => void;
}

function findEditorView(): EditorView {
  const root = document.querySelector(".cm-editor");

  if (!(root instanceof HTMLElement)) {
    throw new TypeError("CodeMirror editor root (.cm-editor) was not found in the document.");
  }

  const view = EditorView.findFromDOM(root);

  if (!view) {
    throw new TypeError("CodeMirror EditorView was not found from the editor root.");
  }

  return view;
}

function replaceEditorValue(value: string): void {
  const view = findEditorView();

  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: value
    }
  });
}

function TestForm({
  defaultValue = "initial",
  formDisabled = false,
  onForm,
  ...fieldProps
}: TestFormProps) {
  const form = useForm({
    defaultValues: {
      source: defaultValue
    } as TestValues
  });

  onForm?.(form);

  return (
    <form.AppForm>
      <form.Form
        component="div"
        disabled={formDisabled}
      >
        <form.AppField
          name="source"
          validators={{
            onBlur: ({ value }) => value ? undefined : "请输入代码"
          }}
        >
          {field => (
            <field.CodeEditor
              {...fieldProps}
              label="代码"
            />
          )}
        </form.AppField>
      </form.Form>
    </form.AppForm>
  );
}

describe("form/fields/CodeEditorField", () => {
  describe("value synchronization", () => {
    it("writes editor changes into the form value", async () => {
      let formApi: TestFormApi | undefined;
      render(
        <TestForm
          onForm={form => {
            formApi = form;
          }}
        />
      );

      await waitFor(() => {
        expect(formApi).toBeDefined();
      });

      replaceEditorValue("next");

      await waitFor(() => {
        expect(formApi?.getFieldValue("source")).toBe("next");
      });
    });

    it("converts an empty editor value to null by default", async () => {
      let formApi: TestFormApi | undefined;
      render(
        <TestForm
          onForm={form => {
            formApi = form;
          }}
        />
      );

      await waitFor(() => {
        expect(formApi).toBeDefined();
      });

      replaceEditorValue("");

      await waitFor(() => {
        expect(formApi?.getFieldValue("source")).toBeNull();
      });
    });

    it("preserves an empty string when preserveEmptyString is true", async () => {
      let formApi: TestFormApi | undefined;
      render(
        <TestForm
          preserveEmptyString
          onForm={form => {
            formApi = form;
          }}
        />
      );

      await waitFor(() => {
        expect(formApi).toBeDefined();
      });

      replaceEditorValue("");

      await waitFor(() => {
        expect(formApi?.getFieldValue("source")).toBe("");
      });
    });

    it("syncs external form value updates back into the editor", async () => {
      let formApi: TestFormApi | undefined;
      render(
        <TestForm
          onForm={form => {
            formApi = form;
          }}
        />
      );

      await waitFor(() => {
        expect(formApi).toBeDefined();
      });

      formApi!.setFieldValue("source", "external", {
        dontUpdateMeta: true
      });

      await waitFor(() => {
        expect(findEditorView().state.doc.toString()).toBe("external");
      });
    });
  });

  describe("disabled state", () => {
    it("maps the form disabled context to a read-only editor", async () => {
      render(<TestForm formDisabled />);

      await waitFor(() => {
        expect(findEditorView().state.readOnly).toBe(true);
      });
    });

    it("maps the field disabled prop to a read-only editor", async () => {
      render(<TestForm disabled />);

      await waitFor(() => {
        expect(findEditorView().state.readOnly).toBe(true);
      });
    });
  });

  describe("validation", () => {
    it("shows the blur validation error after the editor loses focus", async () => {
      render(<TestForm defaultValue={null} />);

      await waitFor(() => {
        expect(findEditorView()).toBeDefined();
      });

      findEditorView().focus();
      findEditorView().contentDOM.blur();

      expect(await screen.findByText("请输入代码")).toBeInTheDocument();
    });
  });
});
