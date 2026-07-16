import type { ContractSearch } from "../../types";

import { useFormContext } from "@vef-framework-react/components";

/**
 * The inline search fields for the contract list.
 */
export function ContractSearchFields() {
  const { AppField } = useFormContext<ContractSearch>();

  return (
    <>
      <AppField name="code">{field => <field.Input allowClear noWrapper placeholder="契约编码" />}</AppField>
      <AppField name="name">{field => <field.Input allowClear noWrapper placeholder="契约名称" />}</AppField>
    </>
  );
}
