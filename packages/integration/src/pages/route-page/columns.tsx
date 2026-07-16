import type { TableColumn } from "@vef-framework-react/components";

import type { Directory } from "../../components";
import type { Contract, Route, System } from "../../types";

import { Tag, Text } from "@vef-framework-react/components";

import { EnabledTag, formatTimestamp } from "../../components";

// Build the route columns closed over the loaded system/contract directories,
// so foreign-key ids render as names.
export function buildRouteColumns(systemDir: Directory<System>, contractDir: Directory<Contract>): Array<TableColumn<Route>> {
  return [
    {
      title: "路由键",
      dataIndex: "routeKey",
      width: 220,
      render: (value: string) => value ? <Text>{value}</Text> : <Tag color="blue">默认路由</Tag>
    },
    {
      title: "契约范围",
      dataIndex: "contractId",
      render: (value: string) => value ? <Text>{contractDir.byId.get(value)?.name ?? value}</Text> : <Tag color="purple">全部契约</Tag>
    },
    {
      title: "目标系统",
      dataIndex: "systemId",
      render: (value: string) => <Text>{systemDir.byId.get(value)?.name ?? value}</Text>
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
}
