import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { District } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createDistrict, deleteDistrict, findDistrictTree, updateDistrict } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { DistrictActionButtonGroup, DistrictOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/md/district")({
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

const TABLE_COLUMNS: Array<TableColumn<District>> = [
  {
    title: "区划名称",
    dataIndex: "name",
    width: 200
  },
  {
    title: "区划代码",
    dataIndex: "code",
    width: 120
  },
  {
    title: "简称",
    dataIndex: "shortName",
    width: 100
  },
  {
    title: "级别",
    dataIndex: "levelName",
    width: 120,
    align: "center"
  },
  {
    title: "邮政编码",
    dataIndex: "postcode",
    width: 100,
    align: "center"
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
  create: createDistrict,
  update: updateDistrict
};

const SCENE_DEFAULT_FORM_VALUES = {
  create: {
    isActive: true,
    sortOrder: 0,
    level: 1
  }
};

const COLUMN_SETTINGS = { storageKey: "page.md.district" };

function OperationColumn({ row }: { row: District }): ReactNode {
  return (
    <DistrictOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
      {([openForm, deleteRow, refetchQuery]) => (
        <>
          <OperationButton
            color="orange"
            icon={<Icon component={PlusIcon} />}
            onClick={() => openForm({
              scene: "create",
              values: { parentId: row.id, level: Math.min(row.level + 1, 5) }
            })}
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
    </DistrictOperationButtonGroup>
  );
}

function renderOperationColumn(row: District): ReactNode {
  return <OperationColumn row={row} />;
}

function ToolbarActions(): ReactNode {
  return (
    <DistrictActionButtonGroup selector={state => state.openForm}>
      {openForm => (
        <ActionButton
          icon={<Icon component={PlusIcon} />}
          type="primary"
          onClick={() => openForm({ scene: "create" })}
        >
          新增
        </ActionButton>
      )}
    </DistrictActionButtonGroup>
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
      deleteMutationFn={deleteDistrict}
      formMutationFns={FORM_MUTATION_FNS}
      isPaginated={false}
      operationColumn={{ render: renderOperationColumn }}
      queryFn={findDistrictTree}
      renderForm={renderForm}
      rowKey="id"
      sceneDefaultFormValues={SCENE_DEFAULT_FORM_VALUES}
      showSequenceColumn={false}
      tableColumns={TABLE_COLUMNS}
      toolbarActions={<ToolbarActions />}
    />
  );
}
