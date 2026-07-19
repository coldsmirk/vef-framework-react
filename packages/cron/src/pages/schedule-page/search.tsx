import type { ScheduleSearch } from "../../types";

import { useFormContext } from "@vef-framework-react/components";

import { TRIGGER_KIND_OPTIONS } from "../../components";
import { useJobNames } from "./helpers";

const ENABLED_OPTIONS = [
  { label: "启用", value: "true" },
  { label: "停用", value: "false" }
];

/**
 * The inline search fields for the schedule list.
 */
export function ScheduleSearchFields() {
  const { AppField } = useFormContext<ScheduleSearch>();
  const jobs = useJobNames();

  return (
    <>
      <AppField name="name">{field => <field.Input allowClear noWrapper placeholder="名称" />}</AppField>

      <AppField name="jobName">
        {field => (
          <field.Select
            allowClear
            noWrapper
            showSearch
            loading={jobs.loading}
            options={jobs.options}
            placeholder="任务处理器"
            style={{ minWidth: 160 }}
          />
        )}
      </AppField>

      <AppField name="kind">
        {field => <field.Select allowClear noWrapper options={TRIGGER_KIND_OPTIONS} placeholder="触发方式" style={{ minWidth: 120 }} />}
      </AppField>

      <AppField name="isEnabled">
        {field => <field.Select allowClear noWrapper options={ENABLED_OPTIONS} placeholder="状态" style={{ minWidth: 100 }} />}
      </AppField>
    </>
  );
}
