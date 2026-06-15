import type { CSSProperties } from "react";
import type { SyntaxHighlighterProps } from "react-syntax-highlighter";

/**
 * The props of the CodeHighlighter component.
 */
export interface CodeHighlighterProps {
  /**
   * The code string to highlight.
   */
  children: string;
  /**
   * The programming language for syntax highlighting.
   *
   * @default "typescript"
   */
  language?: string;
  /**
   * Whether to show line numbers.
   *
   * @default false
   */
  showLineNumbers?: boolean;
  /**
   * Starting line number when showLineNumbers is true.
   *
   * @default 1
   */
  startingLineNumber?: number;
  /**
   * Whether to wrap long lines.
   *
   * @default false
   */
  wrapLines?: boolean;
  /**
   * Whether to wrap long lines with a scrollbar instead of breaking them.
   *
   * @default true
   */
  wrapLongLines?: boolean;
  /**
   * Additional CSS class name for the component.
   */
  className?: string;
  /**
   * Custom CSS styles to apply to the component.
   */
  style?: CSSProperties;
  /**
   * Custom style object for the syntax highlighter.
   * You can import styles from 'react-syntax-highlighter/dist/esm/styles/prism'.
   */
  customStyle?: CSSProperties;
  // /**
  //  * The Prism theme to use.
  //  * Import from 'react-syntax-highlighter/dist/esm/styles/prism'.
  //  */
  // theme?: SyntaxHighlighterProps["style"];
  /**
   * Lines to highlight (e.g., [1, 3, 5] or "1,3,5-7").
   */
  lineProps?: SyntaxHighlighterProps["lineProps"];
}
