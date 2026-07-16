import type { TableColumn } from "@vef-framework-react/components";

import type { Flow } from "../../types";
import type { CategoryTreeOption } from "../category-page/form";

import { Flex, Tag, Text } from "@vef-framework-react/components";

import { formatTimestamp, LabelsDisplay } from "../../components";
import { FlowIcon } from "../../components/icon";

/**
 * Flatten the category tree into an id → name lookup.
 */
export function flattenCategoryNames(options: CategoryTreeOption[], into = new Map<string, string>()): Map<string, string> {
  for (const option of options) {
    into.set(option.value, option.label);
    flattenCategoryNames(option.children ?? [], into);
  }

  return into;
}

/**
 * Build the flow columns closed over the category lookup, so category ids
 * render as names.
 */
export function buildFlowColumns(categoryNames: Map<string, string>): Array<TableColumn<Flow>> {
  return [
    {
      title: "流程名称",
      dataIndex: "name",
      render: (value: string, row) => (
        <Flex align="center" gap="small">
          <FlowIcon name={row.icon} />
          <Text>{value}</Text>
        </Flex>
      )
    },
    {
      title: "流程编码",
      dataIndex: "code",
      width: 180,
      render: (value: string) => <Text code>{value}</Text>
    },
    {
      title: "所属分类",
      dataIndex: "categoryId",
      width: 140,
      render: (value: string) => <Text>{categoryNames.get(value) ?? value}</Text>
    },
    {
      title: "标签",
      dataIndex: "labels",
      render: (value: Flow["labels"]) => <LabelsDisplay labels={value} />
    },
    {
      title: "业务绑定",
      dataIndex: "bindingMode",
      width: 110,
      align: "center",
      render: (value: Flow["bindingMode"]) => value === "business"
        ? <Tag color="blue">业务绑定</Tag>
        : <Tag>独立存储</Tag>
    },
    {
      title: "版本",
      dataIndex: "currentVersion",
      width: 80,
      align: "center",
      render: (value: number) => value > 0 ? <Tag color="success">{`v${value}`}</Tag> : <Tag>未发布</Tag>
    },
    {
      title: "状态",
      dataIndex: "isActive",
      width: 90,
      align: "center",
      render: (value: boolean) => <Tag color={value ? "success" : "default"}>{value ? "启用" : "停用"}</Tag>
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 160,
      render: (value: string | undefined) => formatTimestamp(value)
    }
  ];
}
