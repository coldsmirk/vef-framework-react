import type { ReactNode } from "react";
import type { DictionarySearch } from "~apis";

import { useFormContext } from "@vef-framework-react/components";

export function BasicSearch(): ReactNode {
  const { AppField } = useFormContext<DictionarySearch>();

  return (
    <AppField name="keyword">
      {field => (
        <field.Input
          noWrapper
          placeholder="搜索名称或字典键"
        />
      )}
    </AppField>
  );
}
