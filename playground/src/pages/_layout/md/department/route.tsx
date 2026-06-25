import type { TableColumn } from "@vef-framework-react/components";
import type { ChangeEvent, ReactNode } from "react";
import type { Department } from "~apis";

import { SearchOutlined } from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { ActionButton, CrudPage, FlexCard, Icon, Input, Loader, OperationButton, showWarningMessage, Stack, Tag, Text, Tree, useDataOptionsTree } from "@vef-framework-react/components";
import { useElementSize } from "@vef-framework-react/hooks";
import { isNullish } from "@vef-framework-react/shared";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { createDepartment, deleteDepartment, findDepartmentTree, findOrganizationTreeOptions, updateDepartment } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { Form } from "./components/form";
import { DepartmentActionButtonGroup, DepartmentOperationButtonGroup } from "./helpers";
import classes from "./styles/index.module.scss";

export const Route = createFileRoute("/_layout/md/department")({
  component: RouteComponent
});

interface SelectedOrg {
  id: string;
  name: string;
}

function renderActiveStatus(value: boolean): ReactNode {
  return value
    ? <Tag color="success">启用</Tag>
    : <Tag color="default">禁用</Tag>;
}

function renderLocation(value: string | null | undefined): ReactNode {
  return <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 150 }}>{value}</Text>;
}

const TABLE_COLUMNS: Array<TableColumn<Department>> = [
  {
    title: "部门名称",
    dataIndex: "name",
    width: 200
  },
  {
    title: "部门简称",
    dataIndex: "shortName",
    width: 150
  },
  {
    title: "部门级别",
    dataIndex: "levelName",
    width: 100
  },
  {
    title: "部门类型",
    dataIndex: "typeName",
    width: 100
  },
  {
    title: "部门位置",
    dataIndex: "location",
    width: 150,
    render: renderLocation
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

const SCENE_DEFAULT_FORM_VALUES = {
  create: {
    isActive: true,
    sortOrder: 0
  }
};

const FORM_MUTATION_FNS = {
  create: createDepartment,
  update: updateDepartment
};

const COLUMN_SETTINGS = { storageKey: "page.md.department" };

interface OrgTreeProps {
  value?: SelectedOrg;
  onChange?: (value: SelectedOrg) => void;
}

const OrgTree = memo(({ value, onChange }: OrgTreeProps): ReactNode => {
  const {
    treeProps,
    isFetching,
    searchValue,
    setSearchValue
  } = useDataOptionsTree({
    queryOptions: {
      queryKey: [findOrganizationTreeOptions.key],
      queryFn: findOrganizationTreeOptions
    }
  });
  const { ref, height } = useElementSize();

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setSearchValue(event.currentTarget.value);
  }, [setSearchValue]);

  const handleTreeSelect = useCallback((_: unknown, { selected, node }: { selected: boolean; node: { value: string; label: string } }): void => {
    if (selected && onChange) {
      onChange({ id: node.value, name: node.label });
    }
  }, [onChange]);

  const cardTitle = `当前机构：${value?.name ?? "无"}`;
  const selectedKeys = value ? [value.id] : undefined;

  return (
    <FlexCard
      className={classes.cardContainer}
      title={<span className={classes.cardTitle}>{cardTitle}</span>}
    >
      <Stack className={classes.cardBody} gap="medium">
        <Input
          placeholder="关键词"
          suffix={<SearchOutlined className="input-suffix-icon" />}
          value={searchValue}
          onChange={handleSearchChange}
        />

        <div ref={ref} className={classes.treeWrapper}>
          {isFetching
            ? <Loader size="large" />
            : (
                <Tree
                  {...treeProps}
                  height={height || innerHeight}
                  selectedKeys={selectedKeys}
                  onSelect={handleTreeSelect}
                />
              )}
        </div>
      </Stack>
    </FlexCard>
  );
});
OrgTree.displayName = "OrgTree";

interface OperationColumnProps {
  row: Department;
}

function OperationColumn({ row }: OperationColumnProps): ReactNode {
  return (
    <DepartmentOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
      {([openForm, deleteDept, refetchQuery]) => (
        <>
          <OperationButton
            color="orange"
            icon={<Icon component={PlusIcon} />}
            onClick={() => openForm({ scene: "create", values: { parentId: row.id, orgId: row.orgId } })}
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
              await deleteDept(row);
              refetchQuery();
            }}
          >
            删除
          </OperationButton>
        </>
      )}
    </DepartmentOperationButtonGroup>
  );
}

interface ToolbarActionsProps {
  selectedOrg?: SelectedOrg;
}

function ToolbarActions({ selectedOrg }: ToolbarActionsProps): ReactNode {
  return (
    <DepartmentActionButtonGroup selector={state => state.openForm}>
      {openForm => (
        <ActionButton
          disabled={!selectedOrg}
          icon={<Icon component={PlusIcon} />}
          type="primary"
          onClick={() => {
            if (!selectedOrg) {
              showWarningMessage("请先选择一个机构再新增部门");
              return;
            }

            openForm({ scene: "create", values: { orgId: selectedOrg.id } });
          }}
        >
          新增
        </ActionButton>
      )}
    </DepartmentActionButtonGroup>
  );
}

function queryEnabled(params?: { orgId?: string }): boolean {
  return !isNullish(params?.orgId);
}

function renderOperationColumn(row: Department): ReactNode {
  return <OperationColumn row={row} />;
}

function RouteComponent(): ReactNode {
  const [selectedOrg, setSelectedOrg] = useState<SelectedOrg>();

  const renderForm = useCallback((): ReactNode => <Form orgId={selectedOrg?.id} />, [selectedOrg?.id]);

  return (
    <CrudPage
      virtual
      basicSearch={<BasicSearch />}
      columnSettings={COLUMN_SETTINGS}
      deleteMutationFn={deleteDepartment}
      formMutationFns={FORM_MUTATION_FNS}
      isPaginated={false}
      leftAside={<OrgTree value={selectedOrg} onChange={setSelectedOrg} />}
      leftAsideWidth={320}
      operationColumn={{ render: renderOperationColumn }}
      queryEnabled={queryEnabled}
      queryFn={findDepartmentTree}
      queryParams={{ orgId: selectedOrg?.id }}
      renderForm={renderForm}
      rowKey="id"
      sceneDefaultFormValues={SCENE_DEFAULT_FORM_VALUES}
      showSequenceColumn={false}
      tableColumns={TABLE_COLUMNS}
      toolbarActions={<ToolbarActions selectedOrg={selectedOrg} />}
    />
  );
}
