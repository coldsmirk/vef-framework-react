import type { ScheduleSearch } from "../../types";

import { Col, Row, useFormContext } from "@vef-framework-react/components";

import { TRIGGER_KIND_OPTIONS } from "../../components";
import { useJobNames } from "./helpers";

const ENABLED_OPTIONS = [
  { label: "启用", value: "true" },
  { label: "停用", value: "false" }
];

/**
 * The primary inline search field for the schedule list.
 */
export function ScheduleSearchFields() {
  const { AppField } = useFormContext<ScheduleSearch>();

  return (
    <AppField name="name">
      {field => <field.Input allowClear noWrapper placeholder="名称" style={{ width: 160 }} />}
    </AppField>
  );
}

/**
 * Less frequently used schedule filters shown in the expandable search panel.
 */
export function ScheduleAdvancedSearchFields() {
  const { AppField } = useFormContext<ScheduleSearch>();
  const jobs = useJobNames();

  return (
    <Row gutter={["var(--vef-spacing-md)", "var(--vef-spacing-md)"]}>
      <Col lg={8} md={12} xs={24}>
        <AppField name="jobName">
          {field => (
            <field.Select
              allowClear
              showSearch
              label="任务处理器"
              loading={jobs.loading}
              options={jobs.options}
              placeholder="任务处理器"
            />
          )}
        </AppField>
      </Col>

      <Col lg={8} md={12} xs={24}>
        <AppField name="kind">
          {field => <field.Select allowClear label="触发方式" options={TRIGGER_KIND_OPTIONS} placeholder="触发方式" />}
        </AppField>
      </Col>

      <Col lg={8} md={12} xs={24}>
        <AppField name="isEnabled">
          {field => <field.Select allowClear label="状态" options={ENABLED_OPTIONS} placeholder="状态" />}
        </AppField>
      </Col>
    </Row>
  );
}
