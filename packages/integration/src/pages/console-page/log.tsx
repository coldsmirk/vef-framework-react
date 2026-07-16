import type { CrudBasicSceneFormValues, DescriptionsItem, TableColumn } from "@vef-framework-react/components";

import type { Direction, FailureKind, InvocationLog, LogSearch } from "../../types";

import { Alert, Button, CrudPage, Descriptions, Drawer, globalCssVars, Stack, Text, useFormContext } from "@vef-framework-react/components";
import { useState } from "react";

import { useLogApi } from "../../api";
import {
  DIRECTION_OPTIONS,
  DirectionTag,
  FAILURE_KIND_LABELS,
  FailureKindTag,
  formatTimestamp,
  JsonView,
  useContractDirectory,
  useSystemDirectory,
  WireTraceTimeline
} from "../../components";
import { FAILURE_KINDS } from "../../types";

type LogSceneValues = CrudBasicSceneFormValues<Record<string, never>, Record<string, never>>;

const FAILURE_KIND_OPTIONS = FAILURE_KINDS.map(kind => {
  return { label: FAILURE_KIND_LABELS[kind], value: kind };
});

function LogSearchFields() {
  const { AppField } = useFormContext<LogSearch>();
  const systemDir = useSystemDirectory();
  const contractDir = useContractDirectory();
  const systemOptions = systemDir.items.map(item => {
    return { label: item.code, value: item.code };
  });
  const contractOptions = contractDir.items.map(item => {
    return { label: item.code, value: item.code };
  });

  return (
    <>
      <AppField name="systemCode">
        {field => (
          <field.Select
            allowClear
            noWrapper
            showSearch
            options={systemOptions}
            placeholder="系统"
            style={{ minWidth: 140 }}
          />
        )}
      </AppField>

      <AppField name="contractCode">
        {field => (
          <field.Select
            allowClear
            noWrapper
            showSearch
            options={contractOptions}
            placeholder="契约"
            style={{ minWidth: 140 }}
          />
        )}
      </AppField>

      <AppField name="direction">
        {field => <field.Select allowClear noWrapper options={DIRECTION_OPTIONS} placeholder="方向" style={{ minWidth: 100 }} />}
      </AppField>

      <AppField name="failureKind">
        {field => <field.Select allowClear noWrapper options={FAILURE_KIND_OPTIONS} placeholder="失败类型" style={{ minWidth: 140 }} />}
      </AppField>
    </>
  );
}

const logColumns: Array<TableColumn<InvocationLog>> = [
  {
    title: "时间",
    dataIndex: "createdAt",
    width: 160,
    render: formatTimestamp
  },
  {
    title: "系统",
    dataIndex: "systemCode",
    width: 140
  },
  {
    title: "契约",
    dataIndex: "contractCode",
    width: 140
  },
  {
    title: "方向",
    dataIndex: "direction",
    width: 80,
    align: "center",
    render: (value: Direction) => <DirectionTag direction={value} />
  },
  {
    title: "结果",
    dataIndex: "failureKind",
    width: 120,
    align: "center",
    render: (value: FailureKind | "" | undefined) => <FailureKindTag failureKind={value} />
  },
  {
    title: "耗时(ms)",
    dataIndex: "durationMs",
    width: 90,
    align: "right"
  },
  {
    title: "Request ID",
    dataIndex: "requestId",
    width: 170,
    render: (value: string) => <Text code style={{ fontSize: globalCssVars.fontSizeSm }}>{value}</Text>
  }
];

function detailItems(log: InvocationLog): DescriptionsItem[] {
  return [
    {
      key: "system",
      label: "系统",
      children: log.systemCode
    },
    {
      key: "contract",
      label: "契约",
      children: log.contractCode
    },
    {
      key: "direction",
      label: "方向",
      children: <DirectionTag direction={log.direction} />
    },
    {
      key: "result",
      label: "结果",
      children: <FailureKindTag failureKind={log.failureKind} />
    },
    {
      key: "duration",
      label: "耗时",
      children: `${log.durationMs} ms`
    },
    {
      key: "requestId",
      label: "Request ID",
      children: log.requestId
    },
    {
      key: "time",
      label: "时间",
      children: formatTimestamp(log.createdAt)
    }
  ];
}

function LogDetail({ log }: { log: InvocationLog }) {
  return (
    <Stack gap="middle">
      <Descriptions bordered column={2} items={detailItems(log)} size="small" />
      {log.error ? <Alert showIcon message={log.error} type="error" /> : null}
      <Text type="secondary">输入</Text>
      <JsonView value={log.input ?? null} />
      <Text type="secondary">输出</Text>
      <JsonView value={log.output ?? null} />

      {log.httpTrace && log.httpTrace.length > 0
        ? (
            <>
              <Text type="secondary">Wire Trace</Text>
              <WireTraceTimeline trace={log.httpTrace} />
            </>
          )
        : null}
    </Stack>
  );
}

/**
 * The invocation-log browser: a filtered list with a full-capture detail drawer.
 */
export function LogPanel() {
  const api = useLogApi();
  const [detail, setDetail] = useState<InvocationLog | null>(null);

  return (
    <>
      <CrudPage<InvocationLog, LogSearch, LogSceneValues>
        basicSearch={<LogSearchFields />}
        operationColumn={{ render: row => <Button size="small" type="link" onClick={() => setDetail(row)}>详情</Button> }}
        queryFn={api.findPage}
        rowKey="id"
        tableColumns={logColumns}
      />

      <Drawer open={detail !== null} title="调用详情" width={680} onClose={() => setDetail(null)}>
        {detail ? <LogDetail log={detail} /> : null}
      </Drawer>
    </>
  );
}
