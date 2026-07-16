import type { RouteSearch } from "../../types";

import { useFormContext } from "@vef-framework-react/components";

import { useSystemDirectory } from "../../components";

/**
 * The inline search fields for the route list.
 */
export function RouteSearchFields() {
  const { AppField } = useFormContext<RouteSearch>();
  const systemDir = useSystemDirectory();

  return (
    <>
      <AppField name="routeKey">{field => <field.Input allowClear noWrapper placeholder="路由键" />}</AppField>

      <AppField name="systemId">
        {field => <field.Select allowClear noWrapper options={systemDir.options} placeholder="目标系统" style={{ minWidth: 180 }} />}
      </AppField>
    </>
  );
}
