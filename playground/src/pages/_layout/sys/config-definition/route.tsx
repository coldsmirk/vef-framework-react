import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { ConfigDefinition } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createConfigDefinition, deleteConfigDefinition, findConfigDefinitionPage, updateConfigDefinition } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { ConfigDefinitionActionButtonGroup, ConfigDefinitionOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/sys/config-definition")({
  component: RouteComponent
});

const CONFIG_DESC_MAX_WIDTH = 200;

function renderIsRequired(value: boolean): ReactNode {
  return <Tag color={value ? "success" : "default"}>{value ? "是" : "否"}</Tag>;
}

function renderConfigDesc(value: string): ReactNode {
  return (
    <Text ellipsis={{ tooltip: value }} style={{ maxWidth: CONFIG_DESC_MAX_WIDTH }}>
      {value}
    </Text>
  );
}

const tableColumns: Array<TableColumn<ConfigDefinition>> = [
  {
    title: "配置分类",
    dataIndex: "categoryName"
  },
  {
    title: "配置键",
    dataIndex: "key",
    width: 180
  },
  {
    title: "配置名称",
    dataIndex: "name",
    width: 160
  },
  {
    title: "值类型",
    dataIndex: "valueTypeName",
    width: 100
  },
  {
    title: "是否必填",
    dataIndex: "isRequired",
    width: 100,
    align: "center",
    render: renderIsRequired
  },
  {
    title: "排序",
    dataIndex: "sortOrder",
    width: 80,
    align: "center"
  },
  {
    title: "配置描述",
    dataIndex: "description",
    width: CONFIG_DESC_MAX_WIDTH,
    render: renderConfigDesc
  },
  {
    title: "创建人",
    dataIndex: "createdByName",
    width: 120
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    width: 180
  }
];

const sceneDefaultFormValues = {
  create: {
    isRequired: false,
    sortOrder: 0
  }
} as const;

const formMutationFns = {
  create: createConfigDefinition,
  update: updateConfigDefinition
} as const;

const columnSettings = { storageKey: "page.sys.config_definition" } as const;

function renderOperationColumn(row: ConfigDefinition): ReactNode {
  return (
    <ConfigDefinitionOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
      {([openForm, deleteRow, refetchQuery]) => (
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
            confirmDescription="确定要删除吗？"
            icon={<Icon component={TrashIcon} />}
            onClick={async () => {
              await deleteRow(row);
              refetchQuery();
            }}
          >
            删除
          </OperationButton>
        </>
      )}
    </ConfigDefinitionOperationButtonGroup>
  );
}

function renderForm(): ReactNode {
  return <Form />;
}

function ToolbarActions(): ReactNode {
  return (
    <ConfigDefinitionActionButtonGroup selector={state => state.openForm}>
      {openForm => (
        <ActionButton
          icon={<Icon component={PlusIcon} />}
          type="primary"
          onClick={() => openForm({ scene: "create" })}
        >
          新增
        </ActionButton>
      )}
    </ConfigDefinitionActionButtonGroup>
  );
}

function RouteComponent(): ReactNode {
  return (
    <CrudPage
      basicSearch={<BasicSearch />}
      columnSettings={columnSettings}
      deleteMutationFn={deleteConfigDefinition}
      formMutationFns={formMutationFns}
      operationColumn={{ render: renderOperationColumn }}
      queryFn={findConfigDefinitionPage}
      renderForm={renderForm}
      rowKey="id"
      sceneDefaultFormValues={sceneDefaultFormValues}
      tableColumns={tableColumns}
      toolbarActions={<ToolbarActions />}
    />
  );
}
