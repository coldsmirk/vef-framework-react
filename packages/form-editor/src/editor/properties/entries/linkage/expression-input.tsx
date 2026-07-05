import type { FC } from "react";

import { CodeEditor } from "@vef-framework-react/components";

/**
 * Completion is off for linkage sources: without the (removed) scope-aware
 * assist, CodeMirror would only offer generic JavaScript keyword noise.
 * Shared with the script editor, which uses CodeEditor directly.
 */
export const NO_COMPLETION_SETUP = { autocompletion: false } as const;

interface ExpressionInputProps {
  minHeight?: number;
  placeholder?: string;
  value: string;
  onChange: (source: string) => void;
}

/**
 * Single-expression editor for linkage conditions and action values: a
 * compact CodeMirror bound to plain JavaScript — syntax highlighting, no
 * completion, no gutters.
 */
export const ExpressionInput: FC<ExpressionInputProps> = ({
  minHeight = 60,
  placeholder,
  value,
  onChange
}) => (
  <CodeEditor
    basicSetupOptions={NO_COMPLETION_SETUP}
    language="javascript"
    minHeight={minHeight}
    placeholder={placeholder}
    showFoldGutter={false}
    showLineNumbers={false}
    size="small"
    value={value}
    onChange={onChange}
  />
);
