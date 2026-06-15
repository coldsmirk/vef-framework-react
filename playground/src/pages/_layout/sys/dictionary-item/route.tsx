import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { DictionaryItem } from "~apis";

import type { SelectedDict } from "./components/dict-tree";

import { createFileRoute } from "@tanstack/react-router";
import {
  ActionButton,
  CrudPage,
  Icon,
  OperationButton,
  showWarningMessage,
  Tag,
  Text
} from "@vef-framework-react/components";
import { isNullish } from "@vef-framework-react/shared";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { createDictionaryItem, deleteDictionaryItem, findDictionaryItemPage, updateDictionaryItem } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { DictTree } from "./components/dict-tree";
import { Form } from "./components/form";
import { DictionaryItemActionButtonGroup, DictionaryItemOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/sys/dictionary-item")({
  component: RouteComponent
});

function renderBooleanTag(value: boolean, trueLabel: string, falseLabel: string): ReactNode {
  return <Tag color={value ? "success" : "default"}>{value ? trueLabel : falseLabel}</Tag>;
}

const tableColumns: Array<TableColumn<DictionaryItem>> = [
  {
    title: "名称",
    dataIndex: "name",
    width: 200
  },
  {
    title: "编码",
    dataIndex: "code",
    width: 120
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
    render(value: boolean) {
      return renderBooleanTag(value, "启用", "禁用");
    }
  },
  {
    title: "是否显示",
    dataIndex: "isVisible",
    width: 100,
    align: "center",
    render(value: boolean) {
      return renderBooleanTag(value, "显示", "隐藏");
    }
  },
  {
    title: "备注",
    dataIndex: "remark",
    width: 240,
    render(value: string) {
      return (
        <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 240 }}>{value}</Text>
      );
    }
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

const COLUMN_SETTINGS = { storageKey: "page.sys.dictionary_item" } as const;

const SCENE_DEFAULT_FORM_VALUES = {
  create: {
    isActive: true,
    isVisible: true,
    sortOrder: 0
  }
} as const;

const RIGHT_ASIDE_WIDTH = {
  defaultWidth: 400,
  minWidth: 320,
  maxWidth: 600
} as const;

const FORM_MUTATION_FNS = {
  create: createDictionaryItem,
  update: updateDictionaryItem
} as const;

function checkQueryEnabled(params?: { dictionaryId?: string }): boolean {
  return !isNullish(params?.dictionaryId);
}

function renderOperationColumn(row: DictionaryItem): ReactNode {
  return (
    <DictionaryItemOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
      {([openForm, deleteItem, refetchQuery]) => (
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
              await deleteItem(row);
              refetchQuery();
            }}
          >
            删除
          </OperationButton>
        </>
      )}
    </DictionaryItemOperationButtonGroup>
  );
}

function RouteComponent(): ReactNode {
  const [selectedDict, setSelectedDict] = useState<SelectedDict>();

  function renderToolbarActions(): ReactNode {
    return (
      <DictionaryItemActionButtonGroup selector={state => state.openForm}>
        {openForm => (
          <ActionButton
            disabled={!selectedDict}
            icon={<Icon component={PlusIcon} />}
            type="primary"
            onClick={() => {
              if (!selectedDict) {
                showWarningMessage("请先选择一个字典再新增字典项");
                return;
              }

              openForm({ scene: "create", values: { dictionaryId: selectedDict.id } });
            }}
          >
            新增
          </ActionButton>
        )}
      </DictionaryItemActionButtonGroup>
    );
  }

  return (
    <CrudPage
      basicSearch={<BasicSearch />}
      columnSettings={COLUMN_SETTINGS}
      deleteMutationFn={deleteDictionaryItem}
      formMutationFns={FORM_MUTATION_FNS}
      leftAside={<DictTree value={selectedDict} onChange={setSelectedDict} />}
      leftAsideWidth={360}
      operationColumn={{ render: renderOperationColumn }}
      queryEnabled={checkQueryEnabled}
      queryFn={findDictionaryItemPage}
      queryParams={{ dictionaryId: selectedDict?.id }}
      renderForm={() => <Form />}
      rightAsideWidth={RIGHT_ASIDE_WIDTH}
      rowKey="id"
      sceneDefaultFormValues={SCENE_DEFAULT_FORM_VALUES}
      tableColumns={tableColumns}
      toolbarActions={renderToolbarActions()}
    />
  );
}
