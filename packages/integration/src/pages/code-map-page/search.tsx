import type { CodeMapSearch } from "../../types";

import { useFormContext } from "@vef-framework-react/components";

import { useSystemDirectory } from "../../components";

/**
 * The inline search fields for the code map list.
 */
export function CodeMapSearchFields() {
  const { AppField } = useFormContext<CodeMapSearch>();
  const systemDir = useSystemDirectory();

  return (
    <>
      <AppField name="systemId">
        {field => <field.Select allowClear noWrapper options={systemDir.options} placeholder="所属系统" style={{ minWidth: 180 }} />}
      </AppField>

      <AppField name="codeSet">{field => <field.Input allowClear noWrapper placeholder="码集" />}</AppField>
      <AppField name="name">{field => <field.Input allowClear noWrapper placeholder="名称" />}</AppField>
    </>
  );
}
