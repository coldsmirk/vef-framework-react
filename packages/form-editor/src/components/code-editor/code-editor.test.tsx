import type * as ComponentsModule from "@vef-framework-react/components";
import type { CodeEditorProps } from "@vef-framework-react/components";
import type { ChangeEvent, ReactElement } from "react";

import type { CodeEditorField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { codeEditorDefinition, CodeEditor as CodeEditorRenderer } from ".";

const mockCodeEditorProps = vi.hoisted(() => {
  return {
    latest: null as CodeEditorProps | null
  };
});

function CodeEditor(props: CodeEditorProps): ReactElement {
  useEffect(() => {
    mockCodeEditorProps.latest = props;
  });

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    props.onChange?.(event.target.value);
  };

  return (
    <textarea
      aria-label="mock-code-editor"
      defaultValue={props.value}
      readOnly={props.readOnly}
      onChange={handleChange}
    />
  );
}

vi.mock("@vef-framework-react/components", async importOriginal => {
  const actual = await importOriginal<typeof ComponentsModule>();

  return {
    ...actual,
    CodeEditor
  };
});

function makeField(overrides: Partial<CodeEditorField> = {}): CodeEditorField {
  return {
    id: "Field_code",
    type: "code-editor",
    key: "code",
    label: "代码",
    language: "typescript",
    minHeight: 200,
    showLineNumbers: false,
    ...overrides
  };
}

describe("CodeEditor field", () => {
  it("defines serializable defaults for new fields", () => {
    expect(codeEditorDefinition.config).toMatchObject({
      type: "code-editor",
      name: "代码编辑器",
      group: "basic-input",
      keyed: true
    });
    expect(codeEditorDefinition.config.create()).toEqual({
      type: "code-editor",
      label: "代码编辑器",
      language: "json",
      minHeight: 160,
      showLineNumbers: true
    });
  });

  it("maps schema props to the internal CodeEditor", async () => {
    const handleChange = vi.fn();

    render(
      <CodeEditorRenderer
        disabled
        domId="field-code"
        errors={["请输入代码"]}
        field={makeField()}
        value="const answer = 42;"
        onChange={handleChange}
      />
    );

    // The inner editor is a lazy chunk — wait for it to stream in.
    await screen.findByRole("textbox", { name: "mock-code-editor" });

    expect(mockCodeEditorProps.latest).toMatchObject({
      indentWithTab: false,
      language: "typescript",
      minHeight: 200,
      readOnly: true,
      showLineNumbers: false,
      status: "error",
      value: "const answer = 42;"
    });
    expect(screen.getByRole("alert")).toHaveTextContent("请输入代码");
  });

  it("writes editor changes through the field onChange callback", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CodeEditorRenderer
        domId="field-code"
        field={makeField()}
        value=""
        onChange={handleChange}
      />
    );

    await user.type(await screen.findByRole("textbox", { name: "mock-code-editor" }), "next");

    expect(handleChange).toHaveBeenLastCalledWith("next");
  });

  it("forwards the appearance props to the internal CodeEditor", async () => {
    render(
      <CodeEditorRenderer
        domId="field-code"
        value=""
        field={makeField({
          maxHeight: 480,
          showFoldGutter: true,
          tabSize: 4
        })}
        onChange={vi.fn()}
      />
    );

    await screen.findByRole("textbox", { name: "mock-code-editor" });

    expect(mockCodeEditorProps.latest).toMatchObject({
      maxHeight: 480,
      showFoldGutter: true,
      tabSize: 4
    });
  });

  it("leaves the appearance props undefined when the field omits them", async () => {
    render(
      <CodeEditorRenderer
        domId="field-code"
        field={makeField()}
        value=""
        onChange={vi.fn()}
      />
    );

    await screen.findByRole("textbox", { name: "mock-code-editor" });

    expect(mockCodeEditorProps.latest?.maxHeight).toBeUndefined();
    expect(mockCodeEditorProps.latest?.showFoldGutter).toBeUndefined();
    expect(mockCodeEditorProps.latest?.tabSize).toBeUndefined();
  });
});
