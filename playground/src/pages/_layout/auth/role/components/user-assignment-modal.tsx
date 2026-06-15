import type { TableColumn } from "@vef-framework-react/components";
import type { RoleUserItem } from "~apis";

import { ActionButton, Icon, Modal, OperationButton, OperationButtonGroup, Popover, ProTable, ProTableSubscriber, Tag } from "@vef-framework-react/components";
import { atom, useAtomValue, useMutation, useSetAtom } from "@vef-framework-react/core";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { findRoleUsers, removeRoleUsers } from "~apis";

import classes from "../styles/index.module.scss";
import { UserSearch } from "./user-search";
import { UserSelector } from "./user-selector";

interface ModalState {
  open: boolean;
  roleId?: string;
  roleName?: string;
}

const modalAtom = atom<ModalState>({ open: false });

const closeModalAtom = atom(null, (_, set) => {
  set(modalAtom, { open: false });
});

export const openModalAtom = atom(null, (_, set, data: { roleId: string; roleName: string }) => {
  set(modalAtom, {
    open: true,
    roleId: data.roleId,
    roleName: data.roleName
  });
});

function renderStaffNumber(value: string | undefined) {
  return value || "-";
}

function renderDeptName(value: string | undefined) {
  return value || "-";
}

function renderGender(value: string) {
  if (value === "M") {
    return "男";
  }

  if (value === "F") {
    return "女";
  }

  return "未知";
}

function renderIsActive(value: boolean) {
  return value
    ? <Tag color="success">启用</Tag>
    : <Tag color="error">禁用</Tag>;
}

function renderIsLocked(value: boolean) {
  return value
    ? <Tag color="warning">已锁定</Tag>
    : <Tag color="success">正常</Tag>;
}

const columns: Array<TableColumn<RoleUserItem>> = [
  {
    title: "姓名",
    dataIndex: "name",
    minWidth: 160
  },
  {
    title: "账号",
    dataIndex: "username",
    minWidth: 180
  },
  {
    title: "工号",
    dataIndex: "staffNumber",
    minWidth: 180,
    render: renderStaffNumber
  },
  {
    title: "部门",
    dataIndex: "deptName",
    minWidth: 180,
    render: renderDeptName
  },
  {
    title: "性别",
    dataIndex: "gender",
    width: 80,
    align: "center",
    render: renderGender
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
  }
];

export function UserAssignmentModal() {
  const {
    open,
    roleId,
    roleName
  } = useAtomValue(modalAtom);
  const closeModal = useSetAtom(closeModalAtom);
  const [userSearch, setUserSearch] = useState<{ keyword?: string; deptId?: string }>({});
  const [popoverOpen, setPopoverOpen] = useState(false);
  const userSelectorRef = useRef<{ refetch: () => void }>(null);

  const { mutateAsync: removeUser } = useMutation({
    mutationKey: [removeRoleUsers.key],
    mutationFn: removeRoleUsers,
    onSuccess: () => {
      userSelectorRef.current?.refetch();
    }
  });

  const handleRemoveUser = useCallback(async (userId: string, refetch: () => void) => {
    await removeUser({ roleId: roleId!, userIds: [userId] }, { onSuccess: refetch });
  }, [removeUser, roleId]);

  const renderFooter = useCallback((refetch: () => void) => (
    <Popover
      open={popoverOpen}
      placement="top"
      trigger="click"
      content={(
        <UserSelector
          ref={userSelectorRef}
          roleId={roleId!}
          onConfirm={() => {
            setPopoverOpen(false);
            refetch();
            userSelectorRef.current?.refetch();
          }}
        />
      )}
      onOpenChange={setPopoverOpen}
    >
      <div>
        <ActionButton
          block
          color="default"
          icon={<Icon component={PlusIcon} />}
          size="large"
          variant="dashed"
        >
          添加用户
        </ActionButton>
      </div>
    </Popover>
  ), [popoverOpen, roleId]);

  const renderOperationColumn = useCallback((row: RoleUserItem) => (
    <OperationButtonGroup selector={state => state.refetch}>
      {refetch => (
        <OperationButton
          confirmable
          color="danger"
          confirmDescription="确定要移除该用户吗？"
          icon={<Icon component={TrashIcon} />}
          onClick={() => handleRemoveUser(row.userId, refetch)}
        >
          移除
        </OperationButton>
      )}
    </OperationButtonGroup>
  ), [handleRemoveUser]);

  return (
    <Modal
      footer={null}
      keyboard={false}
      open={open}
      title={`${roleName} - 分配用户`}
      width="70vw"
      onCancel={closeModal}
    >
      <ProTable
        isPaginated
        className={classes.userAssignmentModalBody}
        columns={columns}
        columnSettings={false}
        header={<UserSearch value={userSearch} onChange={setUserSearch} />}
        operationColumn={{ render: renderOperationColumn }}
        queryFn={findRoleUsers}
        queryParams={{ ...userSearch, roleId }}
        rowKey="userId"
        footer={(
          <ProTableSubscriber selector={state => state.refetch}>
            {refetch => renderFooter(refetch)}
          </ProTableSubscriber>
        )}
      />
    </Modal>
  );
}
