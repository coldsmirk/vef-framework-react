import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { Staff, StaffStatus } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { Building2Icon, EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createStaff, deleteStaff, findStaffPage, saveStaffDepartments, updateStaff } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { DepartmentAssignment } from "./components/department-assignment";
import { Form } from "./components/form";
import { StaffActionButtonGroup, StaffOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/md/staff")({
  component: RouteComponent
});

const STATUS_COLOR_MAP = new Map<StaffStatus, string>([
  ["ON_JOB", "success"],
  ["LEAVE", "default"],
  ["RETIRE", "warning"]
]);

function renderEmail(value: string): ReactNode {
  return <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 200 }}>{value}</Text>;
}

function renderStatus(value: string, row: Staff): ReactNode {
  return <Tag color={STATUS_COLOR_MAP.get(row.status) ?? "default"}>{value}</Tag>;
}

const TABLE_COLUMNS: Array<TableColumn<Staff>> = [
  {
    title: "工号",
    dataIndex: "number",
    width: 120
  },
  {
    title: "姓名",
    dataIndex: "name",
    width: 120
  },
  {
    title: "性别",
    dataIndex: "genderName",
    width: 80,
    align: "center"
  },
  {
    title: "手机号码",
    dataIndex: "phoneNumber",
    width: 140
  },
  {
    title: "邮箱",
    dataIndex: "email",
    width: 200,
    render: renderEmail
  },
  {
    title: "状态",
    dataIndex: "statusName",
    width: 100,
    align: "center",
    render: renderStatus
  },
  {
    title: "分类",
    dataIndex: "categoryName",
    width: 100
  },
  {
    title: "职务",
    dataIndex: "positionName",
    width: 100
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

const FORM_MUTATION_FNS = {
  create: createStaff,
  update: updateStaff,
  assignDepartment: saveStaffDepartments
};

const COLUMN_SETTINGS = { storageKey: "page.md.staff" };

function renderForm(scene: string): ReactNode {
  if (scene === "assignDepartment") {
    return <DepartmentAssignment />;
  }

  return <Form />;
}

function ToolbarActions(): ReactNode {
  return (
    <StaffActionButtonGroup selector={state => state.openForm}>
      {openForm => (
        <ActionButton
          icon={<Icon component={PlusIcon} />}
          type="primary"
          onClick={() => openForm({ scene: "create" })}
        >
          新增
        </ActionButton>
      )}
    </StaffActionButtonGroup>
  );
}

function OperationColumn({ row }: { row: Staff }): ReactNode {
  return (
    <StaffOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
      {([openForm, handleDelete, refetchQuery]) => (
        <>
          <OperationButton
            color="orange"
            icon={<Icon component={Building2Icon} />}
            onClick={() => openForm({
              scene: "assignDepartment",
              values: { staffId: row.id },
              width: "70vw",
              mode: "modal",
              title: `${row.name} - 分配科室`
            })}
          >
            分配科室
          </OperationButton>

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
              await handleDelete(row);
              refetchQuery();
            }}
          >
            删除
          </OperationButton>
        </>
      )}
    </StaffOperationButtonGroup>
  );
}

function renderOperationColumn(row: Staff): ReactNode {
  return <OperationColumn row={row} />;
}

function RouteComponent(): ReactNode {
  return (
    <CrudPage
      basicSearch={<BasicSearch />}
      columnSettings={COLUMN_SETTINGS}
      deleteMutationFn={deleteStaff}
      formMutationFns={FORM_MUTATION_FNS}
      operationColumn={{ render: renderOperationColumn }}
      queryFn={findStaffPage}
      renderForm={renderForm}
      rowKey="id"
      tableColumns={TABLE_COLUMNS}
      toolbarActions={<ToolbarActions />}
    />
  );
}
