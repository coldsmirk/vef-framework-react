import type { PropsWithRef, ProTableRef, TableColumn } from "@vef-framework-react/components";
import type { RoleUserItem } from "~apis";

import { Button, Group, Icon, ProTable, Tag } from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { CheckIcon } from "lucide-react";
import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { addRoleUsers, findRoleAvailableUsers } from "~apis";

import classes from "../styles/index.module.scss";
import { UserSearch } from "./user-search";

interface UserSelectorProps {
  roleId: string;
  onConfirm?: () => void;
}

interface UserSelectorRef {
  refetch: () => void;
}

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
    width: 140
  },
  {
    title: "账号",
    dataIndex: "username",
    width: 160
  },
  {
    title: "工号",
    dataIndex: "staffNumber",
    width: 160,
    render: renderStaffNumber
  },
  {
    title: "部门",
    dataIndex: "deptName",
    width: 180,
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

export function UserSelector({
  ref,
  roleId,
  onConfirm
}: PropsWithRef<UserSelectorRef, UserSelectorProps>) {
  const [userSearch, setUserSearch] = useState<{ keyword?: string; deptId?: string }>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const tableRef = useRef<ProTableRef>(null);

  useImperativeHandle(ref, () => {
    return {
      refetch: () => tableRef.current?.refetch()
    };
  });

  const { mutateAsync: addUsers, isPending } = useMutation({
    mutationKey: [addRoleUsers.key],
    mutationFn: addRoleUsers,
    onSuccess: () => {
      onConfirm?.();
      setSelectedRowKeys([]);
    }
  });

  const handleConfirm = useCallback(async () => {
    await addUsers({ roleId, userIds: selectedRowKeys });
  }, [addUsers, roleId, selectedRowKeys]);

  return (
    <ProTable
      ref={tableRef}
      isPaginated
      rowSelection
      className={classes.userSelectorTable}
      columns={columns}
      queryFn={findRoleAvailableUsers}
      queryParams={{ ...userSearch, roleId }}
      rowKey="userId"
      selectedRowKeys={selectedRowKeys}
      header={(
        <Group justify="space-between">
          <UserSearch value={userSearch} onChange={setUserSearch} />

          <Button
            disabled={selectedRowKeys.length === 0}
            icon={<Icon component={CheckIcon} />}
            loading={isPending}
            type="primary"
            onClick={handleConfirm}
          >
            确定
          </Button>
        </Group>
      )}
      onSelectedRowKeysChange={setSelectedRowKeys}
    />
  );
}
