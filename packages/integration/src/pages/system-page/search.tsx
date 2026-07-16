import type { SystemSearch } from "../../types";

import { useFormContext } from "@vef-framework-react/components";

/**
 * The inline search fields for the system list.
 */
export function SystemSearchFields() {
  const { AppField } = useFormContext<SystemSearch>();

  return (
    <>
      <AppField name="code">{field => <field.Input allowClear noWrapper placeholder="系统编码" />}</AppField>
      <AppField name="name">{field => <field.Input allowClear noWrapper placeholder="系统名称" />}</AppField>
    </>
  );
}
