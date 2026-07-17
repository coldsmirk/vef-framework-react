import type { RefObject } from "react";

import type { CodeEditorRef } from ".";

import { language as languageFacet } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";

import { CodeEditor } from ".";
import { render, screen, waitFor } from "../../test-utils";

function findEditorRoot(): HTMLElement {
  const node = document.querySelector(".cm-editor");

  if (!(node instanceof HTMLElement)) {
    throw new TypeError("CodeMirror editor root (.cm-editor) was not found in the document.");
  }

  return node;
}

async function waitForView(ref: RefObject<CodeEditorRef | null>): Promise<NonNullable<CodeEditorRef["view"]>> {
  await waitFor(() => {
    expect(ref.current?.view).toBeDefined();
  });

  return ref.current!.view!;
}

describe("CodeEditor", () => {
  describe("rendering", () => {
    it("renders the editor with the controlled value", async () => {
      render(<CodeEditor value="hello" />);

      const root = findEditorRoot();

      await waitFor(() => {
        expect(root.querySelector(".cm-content")?.textContent).toBe("hello");
      });
    });

    it("renders an empty editor when no value is provided", () => {
      render(<CodeEditor />);

      const root = findEditorRoot();
      expect(root.querySelector(".cm-content")).toBeInTheDocument();
    });
  });

  describe("ref handle", () => {
    it("exposes the EditorView after mount", async () => {
      const ref = createRef<CodeEditorRef>();
      render(
        <CodeEditor
          ref={ref}
          value="abc"
        />
      );

      const view = await waitForView(ref);
      expect(view.state.doc.toString()).toBe("abc");
    });

    it("returns the current document via getValue", async () => {
      const ref = createRef<CodeEditorRef>();
      render(
        <CodeEditor
          ref={ref}
          value="initial"
        />
      );

      await waitForView(ref);
      expect(ref.current?.getValue()).toBe("initial");
    });

    it("replaces the document via setValue and notifies onChange", async () => {
      const handleChange = vi.fn();
      const ref = createRef<CodeEditorRef>();
      render(
        <CodeEditor
          ref={ref}
          value="old"
          onChange={handleChange}
        />
      );

      await waitForView(ref);
      ref.current!.setValue("new value");

      expect(ref.current?.getValue()).toBe("new value");
      await waitFor(() => {
        expect(handleChange).toHaveBeenLastCalledWith("new value");
      });
    });
  });

  describe("controlled updates", () => {
    it("syncs the document when the value prop changes externally", async () => {
      const handleChange = vi.fn();
      const ref = createRef<CodeEditorRef>();
      const { rerender } = render(
        <CodeEditor
          ref={ref}
          value="first"
          onChange={handleChange}
        />
      );

      await waitForView(ref);
      handleChange.mockClear();

      rerender(
        <CodeEditor
          ref={ref}
          value="second"
          onChange={handleChange}
        />
      );

      await waitFor(() => {
        expect(ref.current?.getValue()).toBe("second");
      });
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("read only", () => {
    it("marks the editor state as read-only", async () => {
      const ref = createRef<CodeEditorRef>();
      render(
        <CodeEditor
          ref={ref}
          readOnly
          value="locked"
        />
      );

      const view = await waitForView(ref);
      expect(view.state.readOnly).toBe(true);
    });
  });

  describe("theming", () => {
    it("activates the dark theme facet when ConfigProvider is in dark mode", async () => {
      const ref = createRef<CodeEditorRef>();
      render(
        <CodeEditor
          ref={ref}
          value="dark"
        />,
        {
          configProviderProps: {
            theme: {
              isDarkMode: true
            }
          }
        }
      );

      const view = await waitForView(ref);
      await waitFor(() => {
        expect(view.state.facet(EditorView.darkTheme)).toBe(true);
      });
    });

    it("leaves the dark theme facet off by default", async () => {
      const ref = createRef<CodeEditorRef>();
      render(
        <CodeEditor
          ref={ref}
          value="light"
        />
      );

      const view = await waitForView(ref);
      expect(view.state.facet(EditorView.darkTheme)).toBe(false);
    });
  });

  describe("built-in language loading", () => {
    it("attaches a built-in language extension after the asynchronous import resolves", async () => {
      const ref = createRef<CodeEditorRef>();
      render(
        <CodeEditor
          ref={ref}
          language="json"
          value={"{\"a\":1}"}
        />
      );

      const view = await waitForView(ref);
      await waitFor(() => {
        expect(view.state.facet(languageFacet)).not.toBeNull();
      });
      expect(view.state.doc.toString()).toBe("{\"a\":1}");
    });

    it("preserves the document when switching between built-in languages", async () => {
      const ref = createRef<CodeEditorRef>();
      const { rerender } = render(
        <CodeEditor
          ref={ref}
          language="json"
          value="shared"
        />
      );

      const view = await waitForView(ref);
      await waitFor(() => {
        expect(view.state.facet(languageFacet)).not.toBeNull();
      });
      const initialLanguage = view.state.facet(languageFacet);

      rerender(
        <CodeEditor
          ref={ref}
          language="javascript"
          value="shared"
        />
      );

      await waitFor(() => {
        expect(view.state.facet(languageFacet)).not.toBe(initialLanguage);
      });
      expect(view.state.doc.toString()).toBe("shared");
    });
  });
});

describe("CodeEditor format action", () => {
  it("shows the format button for a formattable language", async () => {
    render(<CodeEditor language="json" value="{}" />);

    expect(await screen.findByRole("button", { name: "格式化" }), "json editors should offer the format action").toBeInTheDocument();
  });

  it("hides the format button when showFormat is off", () => {
    render(<CodeEditor language="json" showFormat={false} value="{}" />);

    expect(screen.queryByRole("button", { name: "格式化" })).not.toBeInTheDocument();
  });

  it("hides the format button for read-only editors", () => {
    render(<CodeEditor readOnly language="json" value="{}" />);

    expect(screen.queryByRole("button", { name: "格式化" })).not.toBeInTheDocument();
  });

  it("hides the format button for languages without a formatter", () => {
    render(<CodeEditor language="markdown" value="# hi" />);

    expect(screen.queryByRole("button", { name: "格式化" })).not.toBeInTheDocument();
  });

  it("re-indents a JSON document and notifies onChange", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const ref = createRef<CodeEditorRef>();

    render(<CodeEditor ref={ref} language="json" onChange={handleChange} />);
    await waitForView(ref);
    ref.current!.setValue("{\"a\":1,\"b\":[2,3]}");

    await user.click(await screen.findByRole("button", { name: "格式化" }));

    const pretty = JSON.stringify({ a: 1, b: [2, 3] }, null, 2);
    await waitFor(() => {
      expect(ref.current?.getValue(), "the document should be re-indented").toBe(pretty);
    });
    expect(handleChange, "the change should flow through onChange").toHaveBeenCalledWith(pretty);
  });

  it("leaves the document intact when the source cannot be parsed", async () => {
    const user = userEvent.setup();
    const ref = createRef<CodeEditorRef>();

    render(<CodeEditor ref={ref} language="json" />);
    await waitForView(ref);
    ref.current!.setValue("{oops");

    await user.click(await screen.findByRole("button", { name: "格式化" }));

    expect(ref.current?.getValue(), "an unparsable document must stay untouched").toBe("{oops");
  });
});
