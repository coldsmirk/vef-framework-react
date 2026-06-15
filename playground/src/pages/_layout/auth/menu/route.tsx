import type { DynamicIconName, TableColumn } from "@vef-framework-react/components";
import type { Menu } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, DynamicIcon, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { isNullish } from "@vef-framework-react/shared";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createMenu, deleteMenu, findMenuTree, updateMenu } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { MenuActionButtonGroup, MenuOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/auth/menu")({
  component: RouteComponent
});

const PARENT_MENU_TYPES = new Set(["D", "M"]);

function renderIcon(value: DynamicIconName | undefined) {
  if (!value) {
    return null;
  }

  return <DynamicIcon name={value} />;
}

function renderIsActive(value: boolean) {
  if (value) {
    return <Tag color="success">启用</Tag>;
  }

  return <Tag color="default">禁用</Tag>;
}

function renderRemark(value: string) {
  return <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 240 }}>{value}</Text>;
}

const tableColumns: Array<TableColumn<Menu>> = [
  {
    title: "名称",
    dataIndex: "name",
    width: 200
  },
  {
    title: "类型",
    dataIndex: "typeName",
    width: 100,
    align: "center"
  },
  {
    title: "图标",
    dataIndex: "icon",
    width: 80,
    align: "center",
    render: renderIcon
  },
  {
    title: "菜单路径",
    dataIndex: "path",
    width: 200,
    ellipsis: true
  },
  {
    title: "权限编码",
    dataIndex: "permissionCode",
    width: 160
  },
  {
    title: "是否启用",
    dataIndex: "isActive",
    width: 100,
    align: "center",
    render: renderIsActive
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
    render: renderRemark
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

function RouteComponent() {
  return (
    <CrudPage
      virtual
      basicSearch={<BasicSearch />}
      columnSettings={{ storageKey: "page.auth.menu" }}
      deleteMutationFn={deleteMenu}
      isPaginated={false}
      queryEnabled={params => !isNullish(params?.appId)}
      queryFn={findMenuTree}
      renderForm={() => <Form />}
      rowKey="id"
      showSequenceColumn={false}
      tableColumns={tableColumns}
      formMutationFns={{
        create: createMenu,
        update: updateMenu
      }}
      operationColumn={{
        render(row) {
          return (
            <MenuOperationButtonGroup selector={state => [state.openForm, state.searchValues, state.delete, state.refetchQuery] as const}>
              {([openForm, searchValues, deleteMenuItem, refetchQuery]) => (
                <>
                  <OperationButton
                    color="orange"
                    disabled={!PARENT_MENU_TYPES.has(row.type)}
                    icon={<Icon component={PlusIcon} />}
                    onClick={() => {
                      openForm({
                        scene: "create",
                        values: { parentId: row.id, appId: searchValues?.appId }
                      });
                    }}
                  >
                    新增
                  </OperationButton>

                  <OperationButton
                    color="primary"
                    icon={<Icon component={EditIcon} />}
                    onClick={() => {
                      openForm({ scene: "update", values: row });
                    }}
                  >
                    编辑
                  </OperationButton>

                  <OperationButton
                    confirmable
                    color="danger"
                    confirmDescription="确定要删除吗？"
                    icon={<Icon component={TrashIcon} />}
                    onClick={async () => {
                      try {
                        await deleteMenuItem(row);
                        refetchQuery();
                      } catch {}
                    }}
                  >
                    删除
                  </OperationButton>
                </>
              )}
            </MenuOperationButtonGroup>
          );
        }
      }}
      sceneDefaultFormValues={{
        create: { isActive: true, sortOrder: 0 }
      }}
      toolbarActions={(
        <MenuActionButtonGroup selector={state => [state.openForm, state.searchValues] as const}>
          {([openForm, searchValues]) => (
            <ActionButton
              icon={<Icon component={PlusIcon} />}
              type="primary"
              onClick={() => {
                openForm({
                  scene: "create",
                  values: { appId: searchValues?.appId }
                });
              }}
            >
              新增
            </ActionButton>
          )}
        </MenuActionButtonGroup>
      )}
    />
  );
}
