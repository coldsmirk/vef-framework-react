import type { FlowSearch } from "../../types";
import type { CategoryTreeOption } from "../category-page/form";

import { LabelFilterSelect, Select, useFormContext } from "@vef-framework-react/components";

/**
 * The inline search fields for the flow list. Label filters are typed as
 * `key=value` tags and AND-combined by the backend's equality filter.
 */
export function FlowSearchFields({ categoryOptions }: { categoryOptions: CategoryTreeOption[] }) {
  const { AppField } = useFormContext<FlowSearch>();

  return (
    <>
      <AppField name="keyword">
        {field => <field.Input allowClear noWrapper placeholder="流程名称 / 编码" />}
      </AppField>

      <AppField name="categoryId">
        {field => (
          <field.TreeSelect
            allowClear
            noWrapper
            placeholder="所属分类"
            style={{ minWidth: 160 }}
            treeData={categoryOptions}
          />
        )}
      </AppField>

      <AppField name="isActive">
        {field => (
          <Select<string>
            allowClear
            placeholder="状态"
            style={{ minWidth: 110 }}
            value={field.state.value === undefined ? undefined : String(field.state.value)}
            options={[
              { label: "启用", value: "true" },
              { label: "停用", value: "false" }
            ]}
            onChange={value => field.handleChange(value === undefined ? undefined : value === "true")}
          />
        )}
      </AppField>

      <AppField name="labels">
        {field => (
          <LabelFilterSelect
            value={field.state.value}
            onChange={labels => field.handleChange(labels)}
          />
        )}
      </AppField>
    </>
  );
}
