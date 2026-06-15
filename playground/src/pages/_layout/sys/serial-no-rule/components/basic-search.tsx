import type { ReactNode } from "react";
import type { SerialNoRuleSearch } from "~apis";

import { useFormContext } from "@vef-framework-react/components";

export function BasicSearch(): ReactNode {
  const { AppField } = useFormContext<SerialNoRuleSearch>();

  return (
    <AppField name="keyword">
      {field => (
        <field.Input
          noWrapper
          placeholder="规则标识或名称"
        />
      )}
    </AppField>
  );
}
