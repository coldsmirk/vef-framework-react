import type { FC } from "react";

import type { CodeEditorField, FieldComponentProps, FieldDefinition, PropertiesDescriptor } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { lazy, Suspense } from "react";

import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { maxLengthEntry, messageEntry, minLengthEntry, patternEntry, requiredEntry } from "../field-entries";

// CodeMirror (the field's actual editor) is the heaviest dependency in the
// whole form stack; loading it on first render of a code-editor field keeps
// forms without one from ever paying for it. `code-editor-input` is the static
// import boundary an app bundler splits the CodeMirror chunk at.
const CodeEditorInternal = lazy(async () => {
  const module = await import("./code-editor-input");

  return { default: module.CodeEditorInput };
});

const loadingCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 160,
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorder}`,
  color: globalCssVars.colorTextTertiary,
  fontSize: globalCssVars.fontSizeSm
});

export const CodeEditor: FC<FieldComponentProps<CodeEditorField, string>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = "",
  onChange
}) => (
  <FieldShell
    domId={domId}
    errors={errors}
    helperText={field.helperText}
    label={field.label ?? "代码编辑器"}
    labelPosition={field.labelPosition ?? labelPosition}
    required={required ?? field.validate?.required}
  >
    <Suspense fallback={<div css={loadingCss}>正在加载代码编辑器…</div>}>
      <CodeEditorInternal
        indentWithTab={false}
        language={field.language}
        maxHeight={field.maxHeight}
        minHeight={field.minHeight ?? 160}
        placeholder={field.placeholder}
        readOnly={disabled}
        showFoldGutter={field.showFoldGutter}
        showLineNumbers={field.showLineNumbers ?? true}
        status={errors?.length ? "error" : undefined}
        tabSize={field.tabSize}
        value={value}
        onChange={onChange}
      />
    </Suspense>
  </FieldShell>
);

const codeEditorProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<CodeEditorField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<CodeEditorField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        placeholder: "可选 — 编辑器下方提示",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      })
    ]
  },
  {
    id: "appearance",
    label: "编辑器",
    tab: "props",
    entries: [
      definePropertyEntry<CodeEditorField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        placeholder: "请输入代码",
        read: field => field.placeholder,
        write: (field, placeholder) => { return { ...field, placeholder }; }
      }),
      definePropertyEntry<CodeEditorField, CodeEditorField["language"]>({
        id: "language",
        label: "语言",
        type: "select",
        options: [
          { value: "json", label: "JSON" },
          { value: "javascript", label: "JavaScript" },
          { value: "typescript", label: "TypeScript" },
          { value: "markdown", label: "Markdown" },
          { value: "sql", label: "SQL" },
          { value: "python", label: "Python" }
        ],
        read: field => field.language,
        write: (field, language) => { return { ...field, language }; }
      }),
      definePropertyEntry<CodeEditorField, boolean | undefined>({
        id: "showLineNumbers",
        label: "显示行号",
        type: "checkbox",
        read: field => field.showLineNumbers,
        write: (field, showLineNumbers) => { return { ...field, showLineNumbers: showLineNumbers === true }; }
      }),
      definePropertyEntry<CodeEditorField, number | undefined>({
        id: "minHeight",
        label: "最小高度",
        type: "number",
        placeholder: "160",
        description: "单位为 px",
        read: field => field.minHeight,
        write: (field, minHeight) => { return { ...field, minHeight }; }
      }),
      definePropertyEntry<CodeEditorField, number | undefined>({
        id: "maxHeight",
        label: "最大高度",
        type: "number",
        placeholder: "不限",
        description: "单位为 px",
        read: field => field.maxHeight,
        write: (field, maxHeight) => { return { ...field, maxHeight }; }
      }),
      definePropertyEntry<CodeEditorField, number | undefined>({
        id: "tabSize",
        label: "缩进空格数",
        type: "number",
        read: field => field.tabSize,
        write: (field, tabSize) => { return { ...field, tabSize }; }
      }),
      definePropertyEntry<CodeEditorField, boolean | undefined>({
        id: "showFoldGutter",
        label: "显示折叠",
        type: "checkbox",
        read: field => field.showFoldGutter,
        write: (field, showFoldGutter) => { return { ...field, showFoldGutter: showFoldGutter === true }; }
      })
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [
      requiredEntry<CodeEditorField>(),
      minLengthEntry<CodeEditorField>(),
      maxLengthEntry<CodeEditorField>(),
      patternEntry<CodeEditorField>(),
      messageEntry<CodeEditorField>()
    ]
  }
];

export const codeEditorDefinition: FieldDefinition = defineFieldDefinition<CodeEditorField, string>({
  config: {
    type: "code-editor",
    name: "代码编辑器",
    group: "basic-input",
    keyed: true,
    icon: "code-2",
    create: () => {
      return {
        type: "code-editor",
        label: "代码编辑器",
        language: "json",
        minHeight: 160,
        showLineNumbers: true
      };
    }
  },
  Component: CodeEditor,
  properties: codeEditorProperties
});
