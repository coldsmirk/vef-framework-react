import type { ReactNode } from "react";
import type { LoginLogSearch } from "~apis";

import { useFormContext } from "@vef-framework-react/components";

export function BasicSearch(): ReactNode {
  const { AppField } = useFormContext<LoginLogSearch>();

  return (
    <>
      <AppField name="keyword">
        {field => (
          <field.Input
            noWrapper
            placeholder="关键词"
          />
        )}
      </AppField>

      <AppField name="createdAt">
        {field => (
          <field.DateRangePicker
            allowEmpty
            noWrapper
            showTime
            placeholder={["开始登录时间", "结束登录时间"]}
          />
        )}
      </AppField>
    </>
  );
}
