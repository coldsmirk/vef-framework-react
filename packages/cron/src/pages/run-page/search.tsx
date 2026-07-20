import type { RunSearch } from "../../types";

import { Col, Row, useFormContext } from "@vef-framework-react/components";

import { RUN_STATUS_OPTIONS } from "../../components";

const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

/**
 * The primary inline search field for the run journal.
 */
export function RunSearchFields() {
  const { AppField } = useFormContext<RunSearch>();

  return (
    <AppField name="scheduleName">
      {field => <field.Input allowClear noWrapper placeholder="调度名称" style={{ width: 180 }} />}
    </AppField>
  );
}

/**
 * Detailed run filters. The scheduled-time range maps to the
 * `scheduledAtFrom` / `scheduledAtTo` gte/lte bounds.
 */
export function RunAdvancedSearchFields() {
  const { AppField } = useFormContext<RunSearch>();

  return (
    <Row gutter={["var(--vef-spacing-md)", "var(--vef-spacing-md)"]}>
      <Col lg={8} md={12} xs={24}>
        <AppField name="jobName">
          {field => <field.Input allowClear label="任务处理器" placeholder="任务处理器" />}
        </AppField>
      </Col>

      <Col lg={8} md={12} xs={24}>
        <AppField name="status">
          {field => <field.Select allowClear label="状态" options={RUN_STATUS_OPTIONS} placeholder="状态" />}
        </AppField>
      </Col>

      <Col lg={8} md={12} xs={24}>
        <AppField name="nodeId">
          {field => <field.Input allowClear label="节点" placeholder="节点" />}
        </AppField>
      </Col>

      <Col lg={8} md={12} xs={24}>
        <AppField name="scheduledAtFrom">
          {field => <field.DatePicker showTime format={DATE_TIME_FORMAT} label="计划时间起" placeholder="计划时间起" />}
        </AppField>
      </Col>

      <Col lg={8} md={12} xs={24}>
        <AppField name="scheduledAtTo">
          {field => <field.DatePicker showTime format={DATE_TIME_FORMAT} label="计划时间止" placeholder="计划时间止" />}
        </AppField>
      </Col>
    </Row>
  );
}
