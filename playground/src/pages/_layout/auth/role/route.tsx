import type { TableColumn } from "@vef-framework-react/components";
import type { Role } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { useSetAtom } from "@vef-framework-react/core";
import { EditIcon, KeyIcon, PlusIcon, TrashIcon, UsersIcon } from "lucide-react";
import { createRole, deleteRole, findRolePage, saveRolePermissions, updateRole } from "~apis";

import { Authorization } from "./components/authorization";
import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { openModalAtom, UserAssignmentModal } from "./components/user-assignment-modal";
import { RoleActionButtonGroup, RoleOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/auth/role")({
  component: RouteComponent
});

function renderIsActive(value: boolean) {
  return value
    ? <Tag color="success">启用</Tag>
    : <Tag color="default">禁用</Tag>;
}

function renderRemark(value: string) {
  return <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 240 }}>{value}</Text>;
}

const tableColumns: Array<TableColumn<Role>> = [
  {
    title: "角色名称",
    dataIndex: "name",
    minWidth: 120
  },
  {
    title: "是否启用",
    dataIndex: "isActive",
    width: 100,
    align: "center",
    render: renderIsActive
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

const AUTHORIZE_DRAWER_WIDTH = {
  xxl: "60vw",
  xl: "70vw",
  lg: "80vw",
  md: "90vw",
  sm: "95vw",
  xs: "100vw"
};

function renderForm(scene: string) {
  if (scene === "authorize") {
    return <Authorization />;
  }

  return <Form />;
}

function RouteComponent() {
  const openUserAssignmentModal = useSetAtom(openModalAtom);

  return (
    <>
      <CrudPage
        basicSearch={<BasicSearch />}
        columnSettings={{ storageKey: "page.auth.role" }}
        deleteMutationFn={deleteRole}
        queryFn={findRolePage}
        renderForm={renderForm}
        rowKey="id"
        sceneDefaultFormValues={{ create: { isActive: true } }}
        tableColumns={tableColumns}
        formMutationFns={{
          create: createRole,
          update: updateRole,
          authorize: saveRolePermissions
        }}
        operationColumn={{
          render(row) {
            return (
              <RoleOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
                {([openForm, deleteItem, refetchQuery]) => (
                  <>
                    <OperationButton
                      color="orange"
                      icon={<Icon component={KeyIcon} />}
                      onClick={() => {
                        openForm({
                          scene: "authorize",
                          values: { roleId: row.id, permissions: {} },
                          mode: "drawer",
                          width: AUTHORIZE_DRAWER_WIDTH,
                          title: `${row.name} - 角色授权`
                        });
                      }}
                    >
                      授权
                    </OperationButton>

                    <OperationButton
                      color="cyan"
                      icon={<Icon component={UsersIcon} />}
                      onClick={() => {
                        openUserAssignmentModal({ roleId: row.id, roleName: row.name });
                      }}
                    >
                      分配用户
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
                          await deleteItem(row);
                          refetchQuery();
                        } catch {}
                      }}
                    >
                      删除
                    </OperationButton>
                  </>
                )}
              </RoleOperationButtonGroup>
            );
          }
        }}
        toolbarActions={(
          <RoleActionButtonGroup selector={state => state.openForm}>
            {openForm => (
              <ActionButton
                icon={<Icon component={PlusIcon} />}
                type="primary"
                onClick={() => {
                  openForm({ scene: "create" });
                }}
              >
                新增
              </ActionButton>
            )}
          </RoleActionButtonGroup>
        )}
      />

      <UserAssignmentModal />
    </>
  );
}
