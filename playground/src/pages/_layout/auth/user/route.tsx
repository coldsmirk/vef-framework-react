import type { TableColumn } from "@vef-framework-react/components";
import type { User } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createUser, deleteUser, deleteUsers, findUserPage, updateUser } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { UserActionButtonGroup, UserOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/auth/user")({
  component: RouteComponent
});

function renderIsActive(value: boolean) {
  return value
    ? <Tag color="success">启用</Tag>
    : <Tag color="default">禁用</Tag>;
}

function renderIsLocked(value: boolean) {
  return value
    ? <Tag color="error">已锁定</Tag>
    : <Tag color="success">正常</Tag>;
}

function renderRemark(value: string) {
  return <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 240 }}>{value}</Text>;
}

const tableColumns: Array<TableColumn<User>> = [
  {
    title: "姓名",
    dataIndex: "name",
    width: 120
  },
  {
    title: "账号",
    dataIndex: "username",
    width: 140
  },
  {
    title: "手机号码",
    dataIndex: "phoneNumber",
    width: 140
  },
  {
    title: "邮箱",
    dataIndex: "email",
    width: 200
  },
  {
    title: "是否启用",
    dataIndex: "isActive",
    width: 100,
    align: "center",
    render: renderIsActive
  },
  {
    title: "是否锁定",
    dataIndex: "isLocked",
    width: 100,
    align: "center",
    render: renderIsLocked
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
      rowSelection
      basicSearch={<BasicSearch />}
      columnSettings={{ storageKey: "page.auth.user" }}
      deleteManyMutationFn={deleteUsers}
      deleteMutationFn={deleteUser}
      queryFn={findUserPage}
      renderForm={scene => <Form scene={scene} />}
      rowKey="id"
      tableColumns={tableColumns}
      formMutationFns={{
        create: createUser,
        update: updateUser
      }}
      operationColumn={{
        render(row) {
          return (
            <UserOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
              {([openForm, deleteUser, refetchQuery]) => (
                <>
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
                        await deleteUser(row);
                        refetchQuery();
                      } catch {}
                    }}
                  >
                    删除
                  </OperationButton>
                </>
              )}
            </UserOperationButtonGroup>
          );
        }
      }}
      sceneDefaultFormValues={{
        create: { isActive: true, isLocked: false }
      }}
      toolbarActions={(
        <UserActionButtonGroup selector={state => [state.openForm, state.isQueryFetching, state.selectedRows, state.deleteMany, state.refetchQuery] as const}>
          {([openForm, isFetching, selectedRows, deleteMany, refetchQuery]) => (
            <>
              <ActionButton
                icon={<Icon component={PlusIcon} />}
                type="primary"
                onClick={() => {
                  openForm({ scene: "create" });
                }}
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
                  try {
                    await deleteMany(selectedRows);
                    refetchQuery();
                  } catch {}
                }}
              >
                批量删除
              </ActionButton>
            </>
          )}
        </UserActionButtonGroup>
      )}
    />
  );
}
