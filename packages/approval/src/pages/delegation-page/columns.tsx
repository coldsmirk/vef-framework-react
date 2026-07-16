import type { TableColumn } from "@vef-framework-react/components";

import type { Delegation } from "../../types";

import { Tag, Text } from "@vef-framework-react/components";

import { formatTimestamp } from "../../components";

export const delegationColumns: Array<TableColumn<Delegation>> = [
  {
    title: "委托人",
    dataIndex: "delegatorId",
    width: 160,
    render: (value: string) => <Text>{value}</Text>
  },
  {
    title: "被委托人",
    dataIndex: "delegateeId",
    width: 160,
    render: (value: string) => <Text>{value}</Text>
  },
  {
    title: "生效时间",
    dataIndex: "startTime",
    width: 160,
    render: (value: string) => formatTimestamp(value)
  },
  {
    title: "失效时间",
    dataIndex: "endTime",
    width: 160,
    render: (value: string) => formatTimestamp(value)
  },
  {
    title: "限定范围",
    dataIndex: "flowId",
    render: (_value, row) => {
      if (!row.flowCategoryId && !row.flowId) {
        return <Tag color="blue">全部流程</Tag>;
      }

      return (
        <Text type="secondary">
          {[row.flowCategoryId ? `分类 ${row.flowCategoryId}` : null, row.flowId ? `流程 ${row.flowId}` : null]
            .filter(part => part !== null)
            .join(" / ")}
        </Text>
      );
    }
  },
  {
    title: "状态",
    dataIndex: "isActive",
    width: 90,
    align: "center",
    render: (value: boolean) => <Tag color={value ? "success" : "default"}>{value ? "启用" : "停用"}</Tag>
  },
  {
    title: "原因",
    dataIndex: "reason",
    ellipsis: true,
    render: (value: string | null | undefined) => value ?? "-"
  }
];
