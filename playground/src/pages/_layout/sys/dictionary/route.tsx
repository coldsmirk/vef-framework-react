import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { Dictionary } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, Icon, OperationButton, Tag, Text } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { createDictionary, deleteDictionary, findDictionaryTree, updateDictionary } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { DictionaryActionButtonGroup, DictionaryOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/sys/dictionary")({
  component: RouteComponent
});

function renderTypeColumn(value: string): ReactNode {
  return <Text type={value === "D" ? "warning" : "success"}>{value === "D" ? "目录" : "字典"}</Text>;
}

function renderBooleanTag(value: boolean, trueText: string, falseText: string, trueColor: string): ReactNode {
  return <Tag color={value ? trueColor : "default"}>{value ? trueText : falseText}</Tag>;
}

function renderRemarkColumn(value: string): ReactNode {
  return (
    <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 240 }}>{value}</Text>
  );
}

const tableColumns: Array<TableColumn<Dictionary>> = [
  {
    title: "名称",
    dataIndex: "name",
    width: 200
  },
  {
    title: "类型",
    dataIndex: "type",
    align: "center",
    width: 120,
    render: renderTypeColumn
  },
  {
    title: "字典键",
    dataIndex: "key",
    width: 180
  },
  {
    title: "排序",
    dataIndex: "sortOrder",
    width: 100,
    align: "center"
  },
  {
    title: "是否启用",
    dataIndex: "isActive",
    width: 100,
    align: "center",
    render: (value: boolean) => renderBooleanTag(value, "启用", "禁用", "success")
  },
  {
    title: "系统内置",
    dataIndex: "isSystem",
    width: 100,
    align: "center",
    render: (value: boolean) => renderBooleanTag(value, "是", "否", "primary")
  },
  {
    title: "备注",
    dataIndex: "remark",
    width: 240,
    render: renderRemarkColumn
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

const COLUMN_SETTINGS = { storageKey: "page.sys.dictionary" } as const;

const FORM_MUTATION_FNS = {
  create: createDictionary,
  update: updateDictionary
} as const;

const SCENE_DEFAULT_FORM_VALUES = {
  create: {
    type: "D",
    isActive: true,
    isSystem: false,
    sortOrder: 0
  }
} as const;

function renderForm(): ReactNode {
  return <Form />;
}

function renderOperationColumn(row: Dictionary): ReactNode {
  return (
    <DictionaryOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
      {([openForm, deleteDict, refetchQuery]) => (
        <>
          <OperationButton
            color="orange"
            disabled={row.type !== "D"}
            icon={<Icon component={PlusIcon} />}
            onClick={() => openForm({ scene: "create", values: { parentId: row.id, type: "T" } })}
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
            confirmDescription="确定要删除吗？删除前请确保该数据字典还未被使用。"
            icon={<Icon component={TrashIcon} />}
            onClick={async () => {
              await deleteDict(row);
              refetchQuery();
            }}
          >
            删除
          </OperationButton>
        </>
      )}
    </DictionaryOperationButtonGroup>
  );
}

function renderToolbarActions(): ReactNode {
  return (
    <DictionaryActionButtonGroup selector={state => state.openForm}>
      {openForm => (
        <ActionButton
          icon={<Icon component={PlusIcon} />}
          type="primary"
          onClick={() => openForm({ scene: "create" })}
        >
          新增
        </ActionButton>
      )}
    </DictionaryActionButtonGroup>
  );
}

function RouteComponent(): ReactNode {
  return (
    <CrudPage
      virtual
      basicSearch={<BasicSearch />}
      columnSettings={COLUMN_SETTINGS}
      deleteMutationFn={deleteDictionary}
      formMutationFns={FORM_MUTATION_FNS}
      isPaginated={false}
      operationColumn={{ render: renderOperationColumn }}
      queryFn={findDictionaryTree}
      renderForm={renderForm}
      rowKey="id"
      sceneDefaultFormValues={SCENE_DEFAULT_FORM_VALUES}
      showSequenceColumn={false}
      tableColumns={tableColumns}
      toolbarActions={renderToolbarActions()}
    />
  );
}
