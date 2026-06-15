import type { CSSProperties } from "react";

import type { CodeHighlighterProps } from "./props";

import { useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

import { globalCssVars } from "../_base";
import { useIsDarkMode } from "../config-provider";

const lineNumberStyle: CSSProperties = {
  minWidth: "3em",
  paddingRight: "1em",
  textAlign: "right",
  userSelect: "none",
  opacity: 0.5
};

export function CodeHighlighter({
  children,
  language = "typescript",
  showLineNumbers = false,
  startingLineNumber = 1,
  wrapLines = false,
  wrapLongLines = true,
  className,
  style,
  customStyle,
  lineProps
}: CodeHighlighterProps) {
  const isDarkMode = useIsDarkMode();
  const mergedCustomStyle = useMemo(() => {
    return {
      margin: 0,
      borderRadius: globalCssVars.borderRadius,
      ...customStyle
    };
  }, [customStyle]);

  return (
    <div
      className={className}
      style={style}
    >
      <SyntaxHighlighter
        useInlineStyles
        customStyle={mergedCustomStyle}
        language={language}
        lineNumberStyle={lineNumberStyle}
        lineProps={lineProps}
        showLineNumbers={showLineNumbers}
        startingLineNumber={startingLineNumber}
        style={isDarkMode ? oneDark : oneLight}
        wrapLines={wrapLines}
        wrapLongLines={wrapLongLines}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export { type CodeHighlighterProps } from "./props";
