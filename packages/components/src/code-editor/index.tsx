import type { Extension } from "@codemirror/state";
import type { BasicSetupOptions, ReactCodeMirrorRef } from "@uiw/react-codemirror";

import type { Length, PropsWithRef, Size } from "../_base";
import type { CompletionEntry } from "./completions";
import type { CodeEditorLanguage, CodeEditorProps, CodeEditorRef, CodeEditorTheme } from "./props";

import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, tooltips } from "@codemirror/view";
import { css } from "@emotion/react";
import CodeMirror from "@uiw/react-codemirror";
import { isArray, isString, isUndefined } from "@vef-framework-react/shared";
import { Button } from "antd";
import { WandSparklesIcon } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { getSpacingValue, globalCssVars, showErrorMessage } from "../_base";
import { useIsDarkMode } from "../config-provider";
import { Icon } from "../icon";
import { Tooltip } from "../tooltip";
import { completeFromEntries, completeJsonKeysFromEntries } from "./completions";
import { getFormatter } from "./format";

const BUILT_IN_LANGUAGES = new Set<CodeEditorLanguage>([
  "json",
  "javascript",
  "typescript",
  "markdown",
  "sql",
  "python",
  "xml"
]);

function isBuiltInLanguage(value: unknown): value is CodeEditorLanguage {
  return isString(value) && BUILT_IN_LANGUAGES.has(value as CodeEditorLanguage);
}

/**
 * Lazily import each built-in language pack so that the editor's initial
 * bundle only carries the languages the host application actually mounts.
 * `vite` / `webpack` emit one chunk per `import()` here, so unused languages
 * never reach the browser.
 */
const BUILT_IN_LANGUAGE_LOADERS: Record<CodeEditorLanguage, () => Promise<Extension>> = {
  json: async () => {
    const mod = await import("@codemirror/lang-json");
    return mod.json();
  },
  javascript: async () => {
    const mod = await import("@codemirror/lang-javascript");
    return mod.javascript();
  },
  typescript: async () => {
    const mod = await import("@codemirror/lang-javascript");
    return mod.javascript({ jsx: true, typescript: true });
  },
  markdown: async () => {
    const mod = await import("@codemirror/lang-markdown");
    return mod.markdown();
  },
  sql: async () => {
    const mod = await import("@codemirror/lang-sql");
    return mod.sql();
  },
  python: async () => {
    const mod = await import("@codemirror/lang-python");
    return mod.python();
  },
  xml: async () => {
    const mod = await import("@codemirror/lang-xml");
    return mod.xml();
  }
};

const builtInLanguageCache = new Map<CodeEditorLanguage, Extension>();

async function loadBuiltInLanguage(id: CodeEditorLanguage): Promise<Extension> {
  const cached = builtInLanguageCache.get(id);

  if (cached !== undefined) {
    return cached;
  }

  const ext = await BUILT_IN_LANGUAGE_LOADERS[id]();
  builtInLanguageCache.set(id, ext);
  return ext;
}

function toExtensionArray(language: Extension | Extension[]): Extension[] {
  return isArray(language) ? [...language] : [language];
}

/**
 * Resolve `language` into a stable `Extension[]`. Built-in ids are loaded
 * asynchronously; passing a CodeMirror extension (or array thereof) stays
 * synchronous. The hook is safe under React 19 strict-mode double mount —
 * a cancellation flag prevents stale `setState` after unmount.
 */
function useLanguageExtensions(language: CodeEditorProps["language"]): Extension[] {
  const [extensions, setExtensions] = useState<Extension[]>(() => {
    if (isUndefined(language) || isBuiltInLanguage(language)) {
      return [];
    }

    return toExtensionArray(language);
  });

  useEffect(() => {
    if (isUndefined(language)) {
      setExtensions([]);
      return;
    }

    if (!isBuiltInLanguage(language)) {
      setExtensions(toExtensionArray(language));
      return;
    }

    const cached = builtInLanguageCache.get(language);

    if (cached) {
      setExtensions([cached]);
      return;
    }

    let cancelled = false;
    void loadBuiltInLanguage(language).then(ext => {
      if (!cancelled) {
        setExtensions([ext]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  return extensions;
}

/**
 * Turn a declarative completion catalog into a language-data autocomplete
 * extension. On the JS-family built-ins the source is registered on every JS
 * language object (entries complete as identifiers, members after `label.`);
 * on the "json" built-in it is registered on the JSON language object
 * (entries complete as object keys). Loading rides the same lazy chunk as
 * the language pack, and the source merges with the language's own
 * completions instead of replacing them. Other languages ignore the catalog
 * — for a custom language extension, register a completion source through
 * `extensions` instead.
 */
function useCompletionExtensions(
  completions: CompletionEntry[] | undefined,
  language: CodeEditorProps["language"]
): Extension[] {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const isJsLanguage = language === "javascript" || language === "typescript";
  const isJsonLanguage = language === "json";

  useEffect(() => {
    if (!completions?.length || (!isJsLanguage && !isJsonLanguage)) {
      setExtensions([]);
      return;
    }

    let cancelled = false;

    if (isJsonLanguage) {
      void import("@codemirror/lang-json").then(mod => {
        if (!cancelled) {
          setExtensions([mod.jsonLanguage.data.of({ autocomplete: completeJsonKeysFromEntries(completions) })]);
        }
      });
    } else {
      void import("@codemirror/lang-javascript").then(mod => {
        if (cancelled) {
          return;
        }

        const source = completeFromEntries(completions);
        setExtensions([
          mod.javascriptLanguage,
          mod.jsxLanguage,
          mod.typescriptLanguage,
          mod.tsxLanguage
        ].map(lang => lang.data.of({ autocomplete: source })));
      });
    }

    return () => {
      cancelled = true;
    };
  }, [completions, isJsLanguage, isJsonLanguage]);

  return extensions;
}

function resolveCodeMirrorTheme(
  theme: CodeEditorTheme | undefined,
  isDarkMode: boolean
): "light" | Extension {
  if (isUndefined(theme) || theme === "auto") {
    return isDarkMode ? oneDark : "light";
  }

  if (theme === "dark") {
    return oneDark;
  }

  if (theme === "light") {
    return "light";
  }

  return theme;
}

const FORMAT_ACTION_CLASS = "vef-code-editor-format";

const SIZE_FONT_SIZE: Record<Size, string> = {
  small: globalCssVars.fontSizeSm,
  medium: globalCssVars.fontSize,
  large: globalCssVars.fontSizeLg
};

// CodeMirror's base theme puts tooltips (autocomplete, lint, hover) at
// z-index 500, while antd drawers and modals start at 1000 — an editor
// mounted inside one would open its completion popup invisibly behind the
// overlay. 1200 clears the overlay plus the popups antd nests above it.
const tooltipLayerTheme = EditorView.theme({
  ".cm-tooltip": {
    zIndex: "1200"
  }
});

function createSizeTheme(size: Size): Extension {
  return EditorView.theme({
    "&": {
      fontSize: SIZE_FONT_SIZE[size]
    },
    ".cm-content, .cm-gutters": {
      fontFamily: globalCssVars.fontFamilyCode
    }
  });
}

function toCssLength(value: Length | undefined): string | undefined {
  return isUndefined(value) ? undefined : getSpacingValue(value);
}

function statusBorderColor(status: CodeEditorProps["status"]): string {
  if (status === "error") {
    return globalCssVars.colorErrorBorder;
  }

  if (status === "warning") {
    return globalCssVars.colorWarningBorder;
  }

  return globalCssVars.colorBorder;
}

function statusHoverColor(status: CodeEditorProps["status"]): string {
  if (status === "error") {
    return globalCssVars.colorErrorBorderHover;
  }

  if (status === "warning") {
    return globalCssVars.colorWarningBorderHover;
  }

  return globalCssVars.colorPrimaryHover;
}

function statusFocusOutline(status: CodeEditorProps["status"]): string {
  if (status === "error") {
    return `0 0 0 2px ${globalCssVars.colorErrorOutline}`;
  }

  if (status === "warning") {
    return `0 0 0 2px ${globalCssVars.colorWarningOutline}`;
  }

  return `0 0 0 2px ${globalCssVars.controlOutline}`;
}

function statusFocusColor(status: CodeEditorProps["status"]): string {
  if (status === "error") {
    return globalCssVars.colorError;
  }

  if (status === "warning") {
    return globalCssVars.colorWarning;
  }

  return globalCssVars.colorPrimary;
}

interface ContainerStyleParams {
  bordered: boolean;
  status: CodeEditorProps["status"];
  readOnly: boolean;
  width: Length | undefined;
  height: Length | undefined;
  minHeight: Length | undefined;
  maxHeight: Length | undefined;
}

function createContainerStyle({
  bordered,
  status,
  readOnly,
  width,
  height,
  minHeight,
  maxHeight
}: ContainerStyleParams) {
  const borderColor = statusBorderColor(status);
  const hoverColor = statusHoverColor(status);
  const focusColor = statusFocusColor(status);
  const focusOutline = statusFocusOutline(status);

  return css({
    display: "flex",
    flexDirection: "column",
    position: "relative",
    [`.${FORMAT_ACTION_CLASS}`]: {
      position: "absolute",
      top: 4,
      right: 8,
      zIndex: 2,
      opacity: 0,
      backgroundColor: globalCssVars.colorBgContainer,
      transition: `opacity ${globalCssVars.motionDurationMid}`
    },
    [`&:hover .${FORMAT_ACTION_CLASS}, &:focus-within .${FORMAT_ACTION_CLASS}`]: {
      opacity: 1
    },
    width: toCssLength(width),
    height: toCssLength(height),
    minHeight: toCssLength(minHeight),
    maxHeight: toCssLength(maxHeight),
    border: bordered ? `1px solid ${borderColor}` : "none",
    borderRadius: globalCssVars.borderRadius,
    backgroundColor: readOnly ? globalCssVars.colorBgContainerDisabled : globalCssVars.colorBgContainer,
    overflow: "hidden",
    transition: `border-color ${globalCssVars.motionDurationMid}, box-shadow ${globalCssVars.motionDurationMid}`,
    "&:hover": bordered
      ? {
          borderColor: hoverColor
        }
      : undefined,
    "&:focus-within": bordered
      ? {
          borderColor: focusColor,
          boxShadow: focusOutline
        }
      : undefined,
    // Let `@uiw/react-codemirror`'s theme wrapper become a flex column so the
    // editor inside can fill any height we receive (via prop, style, parent
    // flex, or external CSS). `min-height: 0` is required for the inner
    // `.cm-scroller` to actually scroll under a `maxHeight` constraint.
    ".cm-theme, .cm-theme-light, .cm-theme-dark": {
      display: "flex",
      flexDirection: "column",
      flex: "1 1 auto",
      minHeight: 0
    },
    ".cm-editor": {
      flex: "1 1 auto",
      minHeight: 0,
      backgroundColor: "transparent"
    },
    // CodeMirror's base theme sizes `.cm-scroller` with `height: 100%`, but that
    // percentage cannot resolve here: the editor's height comes from flex-grow up
    // a chain whose top is `min-height` (not an explicit `height`), so every
    // ancestor is indefinite and `100%` collapses to the content height — leaving
    // the scroller short and the container's lower area blank. Drive the fill with
    // flex-grow instead (it works off the flex item's resolved size), and let the
    // scroller shrink and scroll when a `height` / `maxHeight` bounds the container.
    ".cm-scroller": {
      flex: "1 1 auto",
      minHeight: 0,
      overflowY: "auto"
    },
    ".cm-editor.cm-focused": {
      outline: "none"
    }
  });
}

export function CodeEditor({
  ref,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  onCreateEditor,
  language,
  theme = "auto",
  readOnly = false,
  placeholder,
  autoFocus = false,
  showLineNumbers = false,
  showFoldGutter = false,
  showSearch = true,
  showFormat = true,
  showHighlightActiveLine = false,
  tabSize = 2,
  indentWithTab = true,
  height,
  minHeight,
  maxHeight,
  width,
  status,
  size = "medium",
  bordered = true,
  className,
  style,
  completions,
  extensions,
  basicSetupOptions
}: PropsWithRef<CodeEditorRef, CodeEditorProps>) {
  const isDarkMode = useIsDarkMode();
  const codeMirrorRef = useRef<ReactCodeMirrorRef>(null);

  useImperativeHandle(
    ref,
    () => {
      return {
        focus: () => codeMirrorRef.current?.view?.focus(),
        blur: () => codeMirrorRef.current?.view?.contentDOM.blur(),
        getValue: () => codeMirrorRef.current?.view?.state.doc.toString() ?? "",
        setValue: (next: string) => {
          const view = codeMirrorRef.current?.view;

          if (!view) {
            return;
          }

          view.dispatch({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: next
            }
          });
        },
        get view() {
          return codeMirrorRef.current?.view;
        }
      };
    },
    []
  );

  const resolvedTheme = useMemo(
    () => resolveCodeMirrorTheme(theme, isDarkMode),
    [theme, isDarkMode]
  );

  const mergedBasicSetup = useMemo<BasicSetupOptions>(
    () => {
      return {
        lineNumbers: showLineNumbers,
        highlightActiveLineGutter: showHighlightActiveLine,
        foldGutter: showFoldGutter,
        highlightActiveLine: showHighlightActiveLine,
        searchKeymap: showSearch,
        tabSize,
        ...basicSetupOptions
      };
    },
    [
      showLineNumbers,
      showFoldGutter,
      showHighlightActiveLine,
      showSearch,
      tabSize,
      basicSetupOptions
    ]
  );

  const languageExtensions = useLanguageExtensions(language);
  const completionExtensions = useCompletionExtensions(completions, language);

  const mergedExtensions = useMemo<Extension[]>(
    () => [
      createSizeTheme(size),
      tooltipLayerTheme,
      // Render tooltips (autocomplete, hover, lint) under `document.body` so they
      // escape this editor container's `overflow: hidden` rounded-corner clip
      // instead of being cut off at its edge. Skipped when there's no DOM (SSR).
      ...typeof document === "undefined" ? [] : [tooltips({ parent: document.body })],
      ...languageExtensions,
      ...completionExtensions,
      ...extensions ?? []
    ],
    [size, languageExtensions, completionExtensions, extensions]
  );

  const containerStyle = useMemo(
    () => createContainerStyle({
      bordered,
      status,
      readOnly,
      width,
      height,
      minHeight,
      maxHeight
    }),
    [bordered, status, readOnly, width, height, minHeight, maxHeight]
  );

  // Keep the change-handler identity stable across renders. @uiw/react-codemirror
  // lists `onChange` in its reconfigure effect deps (useCodeMirror.js), so a fresh
  // closure each render would `StateEffect.reconfigure` the live editor on every
  // keystroke — rebuilding extension priority and disrupting an open completion
  // popup. The ref always invokes the latest `onChange` without changing identity;
  // `undefined` is preserved when there is no handler so no listener is attached.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const stableChange = useCallback((next: string) => onChangeRef.current?.(next), []);
  const handleChange = onChange ? stableChange : undefined;

  const formatter = showFormat && !readOnly ? getFormatter(language) : undefined;

  const handleFormat = async () => {
    const view = codeMirrorRef.current?.view;

    if (!view || !formatter) {
      return;
    }

    const source = view.state.doc.toString();

    if (!source.trim()) {
      return;
    }

    try {
      const formatted = await formatter(source, tabSize);

      // The formatter is async; abandon the result if keystrokes landed since
      // the snapshot rather than overwrite them.
      if (view.state.doc.toString() !== source) {
        return;
      }

      if (formatted !== source) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: formatted
          }
        });
      }
    } catch {
      showErrorMessage("格式化失败，请先修正语法错误");
    }
  };

  return (
    <div
      className={className}
      css={containerStyle}
      style={style}
    >
      {formatter
        ? (
            <Tooltip title="格式化">
              <Button
                aria-label="格式化"
                className={FORMAT_ACTION_CLASS}
                icon={<Icon component={WandSparklesIcon} />}
                size="small"
                type="text"
                onClick={() => void handleFormat()}
              />
            </Tooltip>
          )
        : null}

      <CodeMirror
        ref={codeMirrorRef}
        autoFocus={autoFocus}
        basicSetup={mergedBasicSetup}
        defaultValue={defaultValue}
        extensions={mergedExtensions}
        indentWithTab={indentWithTab}
        placeholder={placeholder}
        readOnly={readOnly}
        theme={resolvedTheme}
        value={value}
        onBlur={onBlur}
        onChange={handleChange}
        onCreateEditor={onCreateEditor}
        onFocus={onFocus}
      />
    </div>
  );
}

export { completeFromEntries, type CompletionEntry } from "./completions";
export type { CodeEditorLanguage, CodeEditorProps, CodeEditorRef, CodeEditorTheme } from "./props";
