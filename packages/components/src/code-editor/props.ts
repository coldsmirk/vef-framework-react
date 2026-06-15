import type { EditorState, Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { BasicSetupOptions } from "@uiw/react-codemirror";
import type { CSSProperties } from "react";

import type { Length, Size } from "../_base";

/**
 * Built-in language identifiers shipped with the CodeEditor. To use a
 * language outside of this list, install the corresponding `@codemirror/lang-*`
 * package and pass its extension through `language` (or `extensions`).
 */
export type CodeEditorLanguage
  = | "json"
    | "javascript"
    | "typescript"
    | "markdown"
    | "sql"
    | "python";

/**
 * Color scheme for the editor.
 *
 * - `"auto"` follows the surrounding `<ConfigProvider>` dark-mode state.
 * - `"light"` / `"dark"` forces a fixed scheme.
 * - A CodeMirror `Extension` lets you plug in any third-party theme.
 */
export type CodeEditorTheme = "auto" | "light" | "dark" | Extension;

/**
 * Imperative handle exposed through `ref`. Provides the most common
 * editor operations without forcing callers to dig into the underlying
 * `EditorView`.
 */
export interface CodeEditorRef {
  /**
   * Move focus into the editor. No-op when the editor is not mounted.
   */
  focus: () => void;
  /**
   * Remove focus from the editor.
   */
  blur: () => void;
  /**
   * Read the current document content. Returns `""` when not mounted.
   */
  getValue: () => string;
  /**
   * Replace the entire document content while preserving the cursor when possible.
   */
  setValue: (value: string) => void;
  /**
   * Underlying `EditorView` instance, or `undefined` before mount.
   */
  readonly view: EditorView | undefined;
}

/**
 * Props for the {@link CodeEditor} component. Mirrors common antd input
 * affordances (`size`, `status`, `bordered`) so it composes naturally
 * inside forms alongside other VEF inputs.
 */
export interface CodeEditorProps {
  /**
   * Controlled document value.
   */
  value?: string;
  /**
   * Initial value for the uncontrolled mode. Ignored when `value` is provided.
   */
  defaultValue?: string;
  /**
   * Fired whenever the document content changes.
   */
  onChange?: (value: string) => void;
  /**
   * Fired when the editor loses focus.
   */
  onBlur?: () => void;
  /**
   * Fired when the editor gains focus.
   */
  onFocus?: () => void;
  /**
   * Fired once the underlying `EditorView` has been created. Useful for
   * dispatching initial transactions, since the view is constructed
   * asynchronously and is not available synchronously on mount.
   */
  onCreateEditor?: (view: EditorView, state: EditorState) => void;

  /**
   * Programming language for syntax highlighting. Pass a built-in id, a
   * CodeMirror extension, or an array of extensions.
   */
  language?: CodeEditorLanguage | Extension | Extension[];

  /**
   * Color scheme.
   *
   * @default "auto"
   */
  theme?: CodeEditorTheme;

  /**
   * Disable editing of the editor content.
   *
   * @default false
   */
  readOnly?: boolean;
  /**
   * Placeholder shown while the editor document is empty.
   */
  placeholder?: string;
  /**
   * Move focus into the editor on mount.
   *
   * @default false
   */
  autoFocus?: boolean;

  /**
   * Show the line-number gutter.
   *
   * @default false
   */
  showLineNumbers?: boolean;
  /**
   * Show the code-folding gutter.
   *
   * @default false
   */
  showFoldGutter?: boolean;
  /**
   * Enable the built-in search keymap (`Ctrl+F` / `Cmd+F`).
   *
   * @default true
   */
  showSearch?: boolean;
  /**
   * Highlight the line currently containing the cursor.
   *
   * @default false
   */
  showHighlightActiveLine?: boolean;
  /**
   * Number of spaces per indentation level.
   *
   * @default 2
   */
  tabSize?: number;
  /**
   * Insert a tab character when the user presses Tab, rather than moving
   * focus to the next form control.
   *
   * @default true
   */
  indentWithTab?: boolean;

  /**
   * Fixed height. Numbers are interpreted as pixels.
   */
  height?: Length;
  /**
   * Minimum height. Numbers are interpreted as pixels.
   */
  minHeight?: Length;
  /**
   * Maximum height. Numbers are interpreted as pixels.
   */
  maxHeight?: Length;
  /**
   * Fixed width. Numbers are interpreted as pixels.
   */
  width?: Length;

  /**
   * Validation status. Drives the container border colour, mirroring antd's
   * `<Input status>` API.
   */
  status?: "error" | "warning";
  /**
   * Density preset matching the VEF size token.
   *
   * @default "medium"
   */
  size?: Size;
  /**
   * Render the container border. Disable when embedding inside another
   * bordered surface.
   *
   * @default true
   */
  bordered?: boolean;
  /**
   * Additional CSS class applied to the outer wrapper.
   */
  className?: string;
  /**
   * Inline styles applied to the outer wrapper.
   */
  style?: CSSProperties;

  /**
   * Extra CodeMirror extensions appended after the built-in basic setup
   * and the resolved language. Use this for linters, custom keymaps, or
   * any other CodeMirror extension.
   */
  extensions?: Extension[];
  /**
   * Fine-grained overrides for the `@uiw/codemirror-extensions-basic-setup`
   * configuration. The dedicated boolean props (`showLineNumbers`, etc.)
   * are applied first; values in this object take precedence.
   */
  basicSetupOptions?: BasicSetupOptions;
}
