import type { TableColumn } from "@vef-framework-react/components";

import type { Directory } from "../../components";
import type { CodeMap, CodeMapEntry, System, UnmappedPolicy } from "../../types";

import { Tag, Text } from "@vef-framework-react/components";

import { EnabledTag, formatTimestamp } from "../../components";
import { UNMAPPED_POLICY_LABELS } from "./model";

const POLICY_COLORS: Record<UnmappedPolicy, string> = {
  reject: "red",
  passthrough: "blue",
  fallback: "orange"
};

// Build the code map columns closed over the loaded system directory, so the
// owning system id renders as its name.
export function buildCodeMapColumns(systemDir: Directory<System>): Array<TableColumn<CodeMap>> {
  return [
    {
      title: "码集",
      dataIndex: "codeSet",
      width: 180,
      render: (value: string) => <Text>{value}</Text>
    },
    {
      title: "名称",
      dataIndex: "name"
    },
    {
      title: "所属系统",
      dataIndex: "systemId",
      render: (value: string) => <Text>{systemDir.byId.get(value)?.name ?? value}</Text>
    },
    {
      title: "条目数",
      dataIndex: "entries",
      width: 90,
      align: "center",
      render: (value?: CodeMapEntry[]) => <Text>{value?.length ?? 0}</Text>
    },
    {
      title: "未收录策略",
      dataIndex: "onUnmapped",
      width: 120,
      align: "center",
      render: (value: UnmappedPolicy) => <Tag color={POLICY_COLORS[value] ?? "red"}>{UNMAPPED_POLICY_LABELS[value] ?? value}</Tag>
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
