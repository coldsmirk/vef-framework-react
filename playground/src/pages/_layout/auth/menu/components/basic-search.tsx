import type { MenuSearch } from "~apis";

import { useDataOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { isUndefined } from "@vef-framework-react/shared";
import { findAppOptions } from "~apis";

export function BasicSearch() {
  const {
    AppField,
    handleSubmit,
    getFieldValue,
    setFieldValue
  } = useFormContext<MenuSearch>();

  const appSelectProps = useDataOptionsSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findAppOptions.key],
      queryFn: findAppOptions
    },
    onFetch: data => {
      if (isUndefined(getFieldValue("appId"))) {
        setFieldValue("appId", data[0]?.value);
      }
    }
  });

  return (
    <>
      <AppField
        listeners={{ onChange: () => handleSubmit() }}
        name="appId"
      >
        {field => (
          <field.Select
            {...appSelectProps}
            noWrapper
            placeholder="应用"
          />
        )}
      </AppField>

      <AppField name="keyword">
        {field => (
          <field.Input
            noWrapper
            placeholder="关键词"
          />
        )}
      </AppField>
    </>
  );
}
