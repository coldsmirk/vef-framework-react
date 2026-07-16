import type { TableColumn } from "@vef-framework-react/components";

import type { FlowCategory } from "../../types";

import { Flex, Tag, Text } from "@vef-framework-react/components";

import { formatTimestamp } from "../../components";
import { FlowIcon } from "../../components/icon";

export const categoryColumns: Array<TableColumn<FlowCategory>> = [
  {
    title: "分类名称",
    dataIndex: "name",
    render: (value: string, row) => (
      <Flex align="center" gap="small">
        <FlowIcon name={row.icon} />
        <Text>{value}</Text>
      </Flex>
    )
  },
  {
    title: "分类编码",
    dataIndex: "code",
    width: 180,
    render: (value: string) => <Text code>{value}</Text>
  },
  {
    title: "排序",
    dataIndex: "sortOrder",
    width: 80,
    align: "center"
  },
  {
    title: "状态",
    dataIndex: "isActive",
    width: 90,
    align: "center",
    render: (value: boolean) => <Tag color={value ? "success" : "default"}>{value ? "启用" : "停用"}</Tag>
  },
  {
    title: "备注",
    dataIndex: "remark",
    ellipsis: true,
    render: (value: string | null | undefined) => value ?? "-"
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    width: 160,
    render: (value: string | undefined) => formatTimestamp(value)
  }
];
