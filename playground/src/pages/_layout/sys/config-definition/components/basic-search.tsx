import type { ReactNode } from "react";
import type { ConfigDefinitionSearch } from "~apis";

import { useFormContext } from "@vef-framework-react/components";

export function BasicSearch(): ReactNode {
  const { AppField } = useFormContext<ConfigDefinitionSearch>();

  return (
    <AppField name="keyword">
      {field => (
        <field.Input
          noWrapper
          placeholder="关键词"
        />
      )}
    </AppField>
  );
}
