import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { App } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createApp, deleteApp, deleteApps, findAppPage, updateApp } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { AppActionButtonGroup, AppOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/sys/app")({
  component: RouteComponent
});

const TEXT_ELLIPSIS_STYLE = { maxWidth: 240 };

const tableColumns: Array<TableColumn<App>> = [
  {
    title: "ID",
    dataIndex: "id",
    width: 120
  },
  {
    title: "名称",
    dataIndex: "name",
    width: 200
  },
  {
    title: "图标",
    dataIndex: "icon",
    width: 120
  },
  {
    title: "链接地址",
    dataIndex: "url",
    width: 240,
    ellipsis: true
  },
  {
    title: "是否启用",
    dataIndex: "isActive",
    width: 100,
    align: "center",
    render(value: boolean): ReactNode {
      return <Tag color={value ? "success" : "default"}>{value ? "启用" : "禁用"}</Tag>;
    }
  },
  {
    title: "排序",
    dataIndex: "sortOrder",
    width: 100,
    align: "center"
  },
  {
    title: "备注",
    dataIndex: "remark",
    width: 240,
    render(value: string | null | undefined): ReactNode {
      if (!value) {
        return null;
      }

      return (
        <Text ellipsis={{ tooltip: value }} style={TEXT_ELLIPSIS_STYLE}>{value}</Text>
      );
    }
  },
  {
    title: "元信息",
    dataIndex: "meta",
    render(value: Record<string, unknown> | null | undefined): ReactNode {
      if (!value) {
        return null;
      }

      const meta = JSON.stringify(value);
      return (
        <Text ellipsis={{ tooltip: meta }} style={TEXT_ELLIPSIS_STYLE}>{meta}</Text>
      );
    }
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

function ToolbarActions(): ReactNode {
  return (
    <AppActionButtonGroup selector={state => [state.openForm, state.isQueryFetching, state.selectedRows, state.deleteMany, state.refetchQuery] as const}>
      {([openForm, isFetching, selectedRows, deleteMany, refetchQuery]) => (
        <>
          <ActionButton
            icon={<Icon component={PlusIcon} />}
            type="primary"
            onClick={() => openForm({ scene: "create" })}
          >
            新增
          </ActionButton>

          <ActionButton
            confirmable
            danger
            confirmDescription="确定要批量删除吗？"
            confirmMode="dialog"
            disabled={isFetching || selectedRows.length === 0}
            icon={<Icon component={TrashIcon} />}
            onClick={async () => {
              await deleteMany(selectedRows);
              refetchQuery();
            }}
          >
            批量删除
          </ActionButton>
        </>
      )}
    </AppActionButtonGroup>
  );
}

function renderOperationColumn(row: App): ReactNode {
  return (
    <AppOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
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
    </AppOperationButtonGroup>
  );
}

function RouteComponent(): ReactNode {
  return (
    <CrudPage
      rowSelection
      basicSearch={<BasicSearch />}
      columnSettings={{ storageKey: "page.sys.app" }}
      deleteManyMutationFn={deleteApps}
      deleteMutationFn={deleteApp}
      formMutationFns={{ create: createApp, update: updateApp }}
      operationColumn={{ render: renderOperationColumn }}
      queryFn={findAppPage}
      renderForm={() => <Form />}
      rowKey="id"
      sceneDefaultFormValues={{ create: { isActive: true, sortOrder: 0 } }}
      tableColumns={tableColumns}
      toolbarActions={<ToolbarActions />}
    />
  );
}
