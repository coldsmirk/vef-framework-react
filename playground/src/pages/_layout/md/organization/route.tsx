import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { Organization } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createOrganization, deleteOrganization, findOrganizationTree, updateOrganization } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { OrganizationActionButtonGroup, OrganizationOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/md/organization")({
  component: RouteComponent
});

function renderActiveStatus(value: boolean): ReactNode {
  return value
    ? <Tag color="success">启用</Tag>
    : <Tag color="default">禁用</Tag>;
}

function renderRemark(value: string): ReactNode {
  return <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 200 }}>{value}</Text>;
}

const TABLE_COLUMNS: Array<TableColumn<Organization>> = [
  {
    title: "机构名称",
    dataIndex: "name",
    width: 240
  },
  {
    title: "机构编码",
    dataIndex: "code",
    width: 160
  },
  {
    title: "机构简称",
    dataIndex: "shortName",
    width: 120
  },
  {
    title: "机构类型",
    dataIndex: "typeName",
    width: 100
  },
  {
    title: "医院级别",
    dataIndex: "hospitalLevel",
    width: 100
  },
  {
    title: "是否启用",
    dataIndex: "isActive",
    width: 100,
    align: "center",
    render: renderActiveStatus
  },
  {
    title: "排序",
    dataIndex: "sortOrder",
    width: 80,
    align: "center"
  },
  {
    title: "备注",
    dataIndex: "remark",
    width: 200,
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

const FORM_MUTATION_FNS = {
  create: createOrganization,
  update: updateOrganization
};

const SCENE_DEFAULT_FORM_VALUES = {
  create: {
    isActive: true,
    sortOrder: 0
  }
};

const COLUMN_SETTINGS = { storageKey: "page.md.organization" };

function OperationColumn({ row }: { row: Organization }): ReactNode {
  return (
    <OrganizationOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
      {([openForm, deleteRow, refetchQuery]) => (
        <>
          <OperationButton
            color="orange"
            icon={<Icon component={PlusIcon} />}
            onClick={() => openForm({ scene: "create", values: { parentId: row.id } })}
          >
            新增
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
              await deleteRow(row);
              refetchQuery();
            }}
          >
            删除
          </OperationButton>
        </>
      )}
    </OrganizationOperationButtonGroup>
  );
}

function renderOperationColumn(row: Organization): ReactNode {
  return <OperationColumn row={row} />;
}

function ToolbarActions(): ReactNode {
  return (
    <OrganizationActionButtonGroup selector={state => state.openForm}>
      {openForm => (
        <ActionButton
          icon={<Icon component={PlusIcon} />}
          type="primary"
          onClick={() => openForm({ scene: "create" })}
        >
          新增
        </ActionButton>
      )}
    </OrganizationActionButtonGroup>
  );
}

function renderForm(): ReactNode {
  return <Form />;
}

function RouteComponent(): ReactNode {
  return (
    <CrudPage
      virtual
      basicSearch={<BasicSearch />}
      columnSettings={COLUMN_SETTINGS}
      deleteMutationFn={deleteOrganization}
      formMutationFns={FORM_MUTATION_FNS}
      isPaginated={false}
      operationColumn={{ render: renderOperationColumn }}
      queryFn={findOrganizationTree}
      renderForm={renderForm}
      rowKey="id"
      sceneDefaultFormValues={SCENE_DEFAULT_FORM_VALUES}
      showSequenceColumn={false}
      tableColumns={TABLE_COLUMNS}
      toolbarActions={<ToolbarActions />}
    />
  );
}
