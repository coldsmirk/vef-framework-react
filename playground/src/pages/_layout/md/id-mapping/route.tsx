import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { IdMapping } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createIdMapping, deleteIdMapping, findIdMappingPage, updateIdMapping } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { IdMappingActionButtonGroup, IdMappingOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/md/id-mapping")({
  component: RouteComponent
});

const TABLE_COLUMNS: Array<TableColumn<IdMapping>> = [
  {
    title: "表名",
    dataIndex: "tableName",
    width: 200
  },
  {
    title: "外部应用",
    dataIndex: "externalAppName",
    width: 150
  },
  {
    title: "本地ID",
    dataIndex: "fromId",
    width: 200
  },
  {
    title: "外部ID",
    dataIndex: "toId",
    width: 200
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
  create: createIdMapping,
  update: updateIdMapping
};

const COLUMN_SETTINGS = { storageKey: "page.md.id_mapping" };

function OperationColumn({ row }: { row: IdMapping }): ReactNode {
  return (
    <IdMappingOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
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
    </IdMappingOperationButtonGroup>
  );
}

function renderOperationColumn(row: IdMapping): ReactNode {
  return <OperationColumn row={row} />;
}

function ToolbarActions(): ReactNode {
  return (
    <IdMappingActionButtonGroup selector={state => state.openForm}>
      {openForm => (
        <ActionButton
          icon={<Icon component={PlusIcon} />}
          type="primary"
          onClick={() => openForm({ scene: "create" })}
        >
          新增
        </ActionButton>
      )}
    </IdMappingActionButtonGroup>
  );
}

function renderForm(): ReactNode {
  return <Form />;
}

function RouteComponent(): ReactNode {
  return (
    <CrudPage
      basicSearch={<BasicSearch />}
      columnSettings={COLUMN_SETTINGS}
      deleteMutationFn={deleteIdMapping}
      formMutationFns={FORM_MUTATION_FNS}
      operationColumn={{ render: renderOperationColumn }}
      queryFn={findIdMappingPage}
      renderForm={renderForm}
      rowKey="id"
      tableColumns={TABLE_COLUMNS}
      toolbarActions={<ToolbarActions />}
    />
  );
}
