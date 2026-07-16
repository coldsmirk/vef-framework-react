import type { TableColumn } from "@vef-framework-react/components";

import type { Directory } from "../../components";
import type { Adapter, Contract, Direction, System } from "../../types";

import { globalCssVars, Text } from "@vef-framework-react/components";

import { DirectionTag, EnabledTag } from "../../components";

function renderScriptPreview(value: string) {
  const firstLine = value.split("\n").find(line => line.trim()) ?? "";

  return (
    <Text code ellipsis={{ tooltip: value }} style={{ maxWidth: 280, fontSize: globalCssVars.fontSizeSm }}>
      {firstLine || "（空）"}
    </Text>
  );
}

/**
 * Build the adapter columns closed over the system/contract directories.
 */
export function buildAdapterColumns(systemDir: Directory<System>, contractDir: Directory<Contract>): Array<TableColumn<Adapter>> {
  return [
    {
      title: "系统",
      dataIndex: "systemId",
      width: 160,
      render: (value: string) => <Text>{systemDir.byId.get(value)?.name ?? value}</Text>
    },
    {
      title: "契约",
      dataIndex: "contractId",
      width: 160,
      render: (value: string) => <Text>{contractDir.byId.get(value)?.name ?? value}</Text>
    },
    {
      title: "方向",
      dataIndex: "direction",
      width: 90,
      align: "center",
      render: (value: Direction) => <DirectionTag direction={value} />
    },
    {
      title: "脚本",
      dataIndex: "script",
      render: renderScriptPreview
    },
    {
      title: "超时",
      dataIndex: "timeoutMs",
      width: 100,
      align: "center",
      render: (value: number) => value ? `${value} ms` : "继承"
    },
    {
      title: "状态",
      dataIndex: "isEnabled",
      width: 90,
      align: "center",
      render: (value: boolean) => <EnabledTag enabled={value} />
    }
  ];
}
