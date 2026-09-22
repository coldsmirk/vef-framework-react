import type { Dayjs } from "@vef-framework-react/shared";

import type { CompletedTaskSearch, PendingTaskSearch, TaskStatus } from "../../types";

import { Col, DatePicker, Labeled, Row, Select, useFormContext } from "@vef-framework-react/components";
import dayjs from "dayjs";

import { INSTANCE_STATUS_OPTIONS, TASK_STATUS_LABELS } from "../../components/status/labels";

const TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss";

/**
 * The statuses a completed task can hold — the backend's completed set — so
 * the result filter never offers a status that matches nothing.
 */
const COMPLETED_TASK_STATUSES: readonly TaskStatus[] = ["approved", "rejected", "handled", "transferred", "rolled_back"];

const COMPLETED_STATUS_OPTIONS = COMPLETED_TASK_STATUSES.map(value => {
  return { label: TASK_STATUS_LABELS[value], value };
});

const TIMEOUT_OPTIONS = [
  { label: "已超时", value: "true" },
  { label: "未超时", value: "false" }
];

/**
 * Maps a picked day range to the inclusive timestamp bounds the task lists
 * take: the first day from midnight, the last day through its final second.
 */
export function toDayRangeBounds(range: [Dayjs | null, Dayjs | null] | null): [string | undefined, string | undefined] {
  return [
    range?.[0]?.startOf("day").format(TIMESTAMP_FORMAT),
    range?.[1]?.endOf("day").format(TIMESTAMP_FORMAT)
  ];
}

interface DayRangeFilterProps {
  from?: string;
  to?: string;
  onChange: (from: string | undefined, to: string | undefined) => void;
}

/**
 * A day-granular range picker over a pair of timestamp bounds.
 */
function DayRangeFilter({
  from,
  to,
  onChange
}: DayRangeFilterProps) {
  return (
    <DatePicker.RangePicker
      style={{ width: "100%" }}
      value={[from ? dayjs(from) : null, to ? dayjs(to) : null]}
      onChange={range => {
        const [start, end] = toDayRangeBounds(range);

        onChange(start, end);
      }}
    />
  );
}

const ADVANCED_GUTTER: [string, string] = ["var(--vef-spacing-md)", "var(--vef-spacing-md)"];

/**
 * The inline search fields for the pending list.
 */
export function PendingTaskSearchFields() {
  const { AppField } = useFormContext<PendingTaskSearch>();

  return (
    <>
      <AppField name="keyword">
        {field => <field.Input allowClear noWrapper placeholder="标题" />}
      </AppField>

      <AppField name="applicantName">
        {field => <field.Input allowClear noWrapper placeholder="申请人" />}
      </AppField>

      <AppField name="isTimeout">
        {field => (
          <Select<string>
            allowClear
            options={TIMEOUT_OPTIONS}
            placeholder="是否超时"
            style={{ minWidth: 110 }}
            value={field.state.value === undefined ? undefined : String(field.state.value)}
            onChange={value => field.handleChange(value === undefined ? undefined : value === "true")}
          />
        )}
      </AppField>
    </>
  );
}

/**
 * The expandable search panel for the pending list.
 */
export function PendingTaskAdvancedSearchFields() {
  const { AppField } = useFormContext<PendingTaskSearch>();

  return (
    <Row gutter={ADVANCED_GUTTER}>
      <Col md={12} xs={24}>
        <Labeled label="到达时间">
          <AppField name="createdAtFrom">
            {fromField => (
              <AppField name="createdAtTo">
                {toField => (
                  <DayRangeFilter
                    from={fromField.state.value}
                    to={toField.state.value}
                    onChange={(from, to) => {
                      fromField.handleChange(from);
                      toField.handleChange(to);
                    }}
                  />
                )}
              </AppField>
            )}
          </AppField>
        </Labeled>
      </Col>
    </Row>
  );
}

/**
 * The inline search fields for the completed list.
 */
export function CompletedTaskSearchFields() {
  const { AppField } = useFormContext<CompletedTaskSearch>();

  return (
    <>
      <AppField name="keyword">
        {field => <field.Input allowClear noWrapper placeholder="标题" />}
      </AppField>

      <AppField name="applicantName">
        {field => <field.Input allowClear noWrapper placeholder="申请人" />}
      </AppField>

      <AppField name="status">
        {field => (
          <field.Select
            allowClear
            noWrapper
            options={COMPLETED_STATUS_OPTIONS}
            placeholder="处理结果"
            style={{ minWidth: 110 }}
          />
        )}
      </AppField>
    </>
  );
}

/**
 * The expandable search panel for the completed list.
 */
export function CompletedTaskAdvancedSearchFields() {
  const { AppField } = useFormContext<CompletedTaskSearch>();

  return (
    <Row gutter={ADVANCED_GUTTER}>
      <Col md={12} xs={24}>
        <Labeled label="处理时间">
          <AppField name="finishedAtFrom">
            {fromField => (
              <AppField name="finishedAtTo">
                {toField => (
                  <DayRangeFilter
                    from={fromField.state.value}
                    to={toField.state.value}
                    onChange={(from, to) => {
                      fromField.handleChange(from);
                      toField.handleChange(to);
                    }}
                  />
                )}
              </AppField>
            )}
          </AppField>
        </Labeled>
      </Col>

      <Col md={12} xs={24}>
        <Labeled label="流程状态">
          <AppField name="instanceStatus">
            {field => (
              <field.Select
                allowClear
                noWrapper
                options={INSTANCE_STATUS_OPTIONS}
                placeholder="全部"
              />
            )}
          </AppField>
        </Labeled>
      </Col>
    </Row>
  );
}
