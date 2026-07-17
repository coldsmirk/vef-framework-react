import type { TableColumn } from "@vef-framework-react/components";

import type { Contract, JsonObject } from "../../types";

import { Flex, globalCssVars, Stack, Tag, Text } from "@vef-framework-react/components";

import { EnabledTag, formatTimestamp } from "../../components";

function renderContract(_value: string, row: Contract) {
  return (
    <Stack gap={0}>
      <Text strong>{row.name}</Text>
      <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">{row.code}</Text>
    </Stack>
  );
}

function renderDescription(value: string | null | undefined) {
  return value ? <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 320 }}>{value}</Text> : <Text type="secondary">-</Text>;
}

function renderSchemaState(value: JsonObject | null | undefined) {
  return value ? <Tag color="blue">已配置</Tag> : <Tag color="default">未配置</Tag>;
}

function renderLabels(value: Record<string, string> | null | undefined) {
  const entries = Object.entries(value ?? {});

  if (entries.length === 0) {
    return <Text type="secondary">-</Text>;
  }

  return (
    <Flex gap={4} wrap="wrap">
      {entries.map(([key, val]) => <Tag key={key} style={{ marginInlineEnd: 0 }}>{val ? `${key}=${val}` : key}</Tag>)}
    </Flex>
  );
}

export const contractColumns: Array<TableColumn<Contract>> = [
  {
    title: "契约",
    dataIndex: "name",
    width: 220,
    render: renderContract
  },
  {
    title: "描述",
    dataIndex: "description",
    render: renderDescription
  },
  {
    title: "标签",
    dataIndex: "labels",
    width: 200,
    render: renderLabels
  },
  {
    title: "输入 Schema",
    dataIndex: "inputSchema",
    width: 130,
    align: "center",
    render: renderSchemaState
  },
  {
    title: "输出 Schema",
    dataIndex: "outputSchema",
    width: 130,
    align: "center",
    render: renderSchemaState
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
