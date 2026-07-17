import type { JsonValue } from "../../types";

import { CodeEditor } from "@vef-framework-react/components";

export interface JsonViewProps {
  value: JsonValue;
  height?: number;
}

/**
 * A read-only, pretty-printed JSON view built on the code editor.
 */
export function JsonView({ value, height = 160 }: JsonViewProps) {
  return (
    <CodeEditor
      readOnly
      showLineNumbers
      height={height}
      language="json"
      size="large"
      value={JSON.stringify(value, null, 2)}
    />
  );
}
