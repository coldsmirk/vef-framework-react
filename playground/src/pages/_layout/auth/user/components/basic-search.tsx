import type { UserSearch } from "~apis";

import { useFormContext } from "@vef-framework-react/components";

export function BasicSearch() {
  const { AppField } = useFormContext<UserSearch>();

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
