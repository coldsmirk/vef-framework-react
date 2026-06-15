import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { SerialNoRule } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createSerialNoRule, deleteSerialNoRule, findSerialNoRulePage, updateSerialNoRule } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { SerialNoRuleActionButtonGroup, SerialNoRuleOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/sys/serial-no-rule")({
  component: RouteComponent
});

const SCENE_DEFAULT_FORM_VALUES = {
  create: {
    isActive: true,
    resetCycle: "N",
    seqLength: 6,
    seqStep: 1
  }
} as const;

const tableColumns: Array<TableColumn<SerialNoRule>> = [
  {
    dataIndex: "key",
    title: "规则标识",
    width: 150
  },
  {
    dataIndex: "name",
    title: "规则名称",
    width: 150
  },
  {
    dataIndex: "prefix",
    title: "前缀",
    width: 100
  },
  {
    dataIndex: "suffix",
    title: "后缀",
    width: 100
  },
  {
    align: "center",
    dataIndex: "dateFormatName",
    title: "日期格式",
    width: 120
  },
  {
    align: "center",
    dataIndex: "seqLength",
    title: "序列长度",
    width: 100
  },
  {
    align: "center",
    dataIndex: "seqStep",
    title: "序列步长",
    width: 100
  },
  {
    align: "center",
    dataIndex: "resetCycleName",
    title: "重置周期",
    width: 100
  },
  {
    align: "center",
    dataIndex: "currentValue",
    title: "当前序列值",
    width: 120
  },
  {
    align: "center",
    dataIndex: "isActive",
    title: "是否启用",
    width: 100,
    render(value: boolean): ReactNode {
      return <Tag color={value ? "success" : "default"}>{value ? "启用" : "禁用"}</Tag>;
    }
  },
  {
    dataIndex: "remark",
    title: "备注",
    width: 200,
    render(value: string | null | undefined): ReactNode {
      return (
        <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 200 }}>{value}</Text>
      );
    }
  },
  {
    dataIndex: "createdByName",
    title: "创建人",
    width: 120
  },
  {
    dataIndex: "createdAt",
    title: "创建时间",
    width: 180
  }
];

function renderOperationColumn(row: SerialNoRule): ReactNode {
  return (
    <SerialNoRuleOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
      {([openForm, deleteRule, refetchQuery]) => (
        <>
          <OperationButton
            color="primary"
            icon={<Icon component={EditIcon} />}
            onClick={() => openForm({ scene: "update", values: row })}
          >
            编辑
          </OperationButton>

          <OperationButton
            confirmable
            color="danger"
            confirmDescription="确定要删除该序列号规则吗？"
            icon={<Icon component={TrashIcon} />}
            onClick={async () => {
              await deleteRule(row);
              refetchQuery();
            }}
          >
            删除
          </OperationButton>
        </>
      )}
    </SerialNoRuleOperationButtonGroup>
  );
}

function ToolbarActions(): ReactNode {
  return (
    <SerialNoRuleActionButtonGroup selector={state => state.openForm}>
      {openForm => (
        <ActionButton
          icon={<Icon component={PlusIcon} />}
          type="primary"
          onClick={() => openForm({ scene: "create" })}
        >
          新增
        </ActionButton>
      )}
    </SerialNoRuleActionButtonGroup>
  );
}

function RouteComponent(): ReactNode {
  return (
    <CrudPage
      basicSearch={<BasicSearch />}
      columnSettings={{ storageKey: "page.sys.serial_no_rule" }}
      deleteMutationFn={deleteSerialNoRule}
      formMutationFns={{ create: createSerialNoRule, update: updateSerialNoRule }}
      operationColumn={{ render: renderOperationColumn }}
      queryFn={findSerialNoRulePage}
      renderForm={() => <Form />}
      rowKey="id"
      sceneDefaultFormValues={SCENE_DEFAULT_FORM_VALUES}
      tableColumns={tableColumns}
      toolbarActions={<ToolbarActions />}
    />
  );
}
