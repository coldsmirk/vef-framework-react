import type { AdapterSearch } from "../../types";

import { useFormContext } from "@vef-framework-react/components";

import { DIRECTION_OPTIONS, useContractDirectory, useSystemDirectory } from "../../components";

/**
 * The inline search fields for the adapter list.
 */
export function AdapterSearchFields() {
  const { AppField } = useFormContext<AdapterSearch>();
  const systemDir = useSystemDirectory();
  const contractDir = useContractDirectory();

  return (
    <>
      <AppField name="systemId">
        {field => <field.Select allowClear noWrapper options={systemDir.options} placeholder="系统" style={{ minWidth: 160 }} />}
      </AppField>

      <AppField name="contractId">
        {field => <field.Select allowClear noWrapper options={contractDir.options} placeholder="契约" style={{ minWidth: 160 }} />}
      </AppField>

      <AppField name="direction">
        {field => <field.Select allowClear noWrapper options={DIRECTION_OPTIONS} placeholder="方向" style={{ minWidth: 120 }} />}
      </AppField>
    </>
  );
}
