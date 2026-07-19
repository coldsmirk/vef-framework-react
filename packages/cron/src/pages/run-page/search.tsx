import type { RunSearch } from "../../types";

import { useFormContext } from "@vef-framework-react/components";

import { RUN_STATUS_OPTIONS } from "../../components";

const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

/**
 * The inline search fields for the run journal. The scheduled-time range maps
 * to the `scheduledAtFrom` / `scheduledAtTo` gte/lte bounds.
 */
export function RunSearchFields() {
  const { AppField } = useFormContext<RunSearch>();

  return (
    <>
      <AppField name="scheduleName">{field => <field.Input allowClear noWrapper placeholder="调度名称" />}</AppField>
      <AppField name="jobName">{field => <field.Input allowClear noWrapper placeholder="任务处理器" />}</AppField>

      <AppField name="status">
        {field => <field.Select allowClear noWrapper options={RUN_STATUS_OPTIONS} placeholder="状态" style={{ minWidth: 120 }} />}
      </AppField>

      <AppField name="nodeId">{field => <field.Input allowClear noWrapper placeholder="节点" />}</AppField>

      <AppField name="scheduledAtFrom">
        {field => <field.DatePicker noWrapper showTime format={DATE_TIME_FORMAT} placeholder="计划时间起" style={{ minWidth: 180 }} />}
      </AppField>

      <AppField name="scheduledAtTo">
        {field => <field.DatePicker noWrapper showTime format={DATE_TIME_FORMAT} placeholder="计划时间止" style={{ minWidth: 180 }} />}
      </AppField>
    </>
  );
}
