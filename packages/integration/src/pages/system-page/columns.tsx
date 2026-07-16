import type { TableColumn } from "@vef-framework-react/components";

import type { DataSourceConfig, InboundAuthConfig, OutboundAuthConfig, System } from "../../types";

import { globalCssVars, Stack, Tag, Text } from "@vef-framework-react/components";

import { EnabledTag, formatTimestamp, INBOUND_AUTH_SCHEME_LABELS, OUTBOUND_AUTH_SCHEME_LABELS } from "../../components";

function renderSystem(_value: string, row: System) {
  return (
    <Stack gap={0}>
      <Text strong>{row.name}</Text>
      <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">{row.code}</Text>
    </Stack>
  );
}

function renderBaseUrl(value: string | null | undefined) {
  return value ? <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 280 }}>{value}</Text> : <Text type="secondary">-</Text>;
}

function renderOutboundAuth(value: OutboundAuthConfig | null | undefined) {
  const scheme = value?.scheme ?? "none";

  return <Tag>{OUTBOUND_AUTH_SCHEME_LABELS[scheme] ?? scheme}</Tag>;
}

function renderInboundAuth(value: InboundAuthConfig | null | undefined) {
  if (!value) {
    return <Tag color="default">未开放</Tag>;
  }

  return <Tag color="purple">{INBOUND_AUTH_SCHEME_LABELS[value.scheme] ?? value.scheme}</Tag>;
}

function renderDataSource(value: DataSourceConfig | null | undefined) {
  return value ? <Tag color="blue">已配置</Tag> : <Text type="secondary">-</Text>;
}

export const systemColumns: Array<TableColumn<System>> = [
  {
    title: "系统",
    dataIndex: "name",
    width: 200,
    render: renderSystem
  },
  {
    title: "Base URL",
    dataIndex: "baseUrl",
    render: renderBaseUrl
  },
  {
    title: "出站认证",
    dataIndex: "outboundAuth",
    width: 120,
    align: "center",
    render: renderOutboundAuth
  },
  {
    title: "入站认证",
    dataIndex: "inboundAuth",
    width: 130,
    align: "center",
    render: renderInboundAuth
  },
  {
    title: "数据源",
    dataIndex: "dataSource",
    width: 90,
    align: "center",
    render: renderDataSource
  },
  {
    title: "状态",
    dataIndex: "isEnabled",
    width: 90,
    align: "center",
    render: (value: boolean) => <EnabledTag enabled={value} />
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    width: 160,
    render: formatTimestamp
  }
];
