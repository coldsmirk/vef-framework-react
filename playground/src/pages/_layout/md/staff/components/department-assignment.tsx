import type { GetProp, TableColumn, TransferProps, TreeProps } from "@vef-framework-react/components";
import type { DataOption, DataOptionWithPinyin } from "@vef-framework-react/core";
import type { ChangeEvent, Key, ReactNode } from "react";
import type { StaffDepartmentItem, StaffDepartmentParams } from "~apis";

import { SearchOutlined } from "@ant-design/icons";
import {
  Input,
  Loader,
  Stack,
  Table,
  Transfer,
  Tree,
  useDataOptionsTree,
  useDataOptionsTreeSelect,
  useFormContext,
  useThemeTokens
} from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { alwaysFalse, flattenTree, mapTree } from "@vef-framework-react/shared";
import { memo, useCallback, useEffect, useEffectEvent, useMemo } from "react";
import { findDepartmentTreeOptions, findOrganizationTreeOptions, findStaffDepartments } from "~apis";

import { useStaffCrudPageStore } from "../helpers";
import classes from "../styles/index.module.scss";

interface DepartmentTreePanelProps {
  treeProps: ReturnType<typeof useDataOptionsTree>["treeProps"];
  treeDataWithDisabled: DataOptionWithPinyin[];
  checkedKeys: Key[];
  height: number;
  onItemSelect: (key: string | number, checked: boolean) => void;
}

const DepartmentTreePanel = memo(({
  treeProps,
  treeDataWithDisabled,
  checkedKeys,
  height,
  onItemSelect
}: DepartmentTreePanelProps): ReactNode => {
  const handleCheck = useCallback<GetProp<TreeProps<DataOptionWithPinyin>, "onCheck">>((_, { node: { value } }) => {
    onItemSelect(value, !checkedKeys.includes(value));
  }, [onItemSelect, checkedKeys]);

  const handleSelect = useCallback<GetProp<TreeProps<DataOptionWithPinyin>, "onSelect">>((_, { node: { value } }) => {
    onItemSelect(value, !checkedKeys.includes(value));
  }, [onItemSelect, checkedKeys]);

  return (
    <Tree
      {...treeProps}
      blockNode
      checkable
      checkStrictly
      defaultExpandAll
      checkedKeys={checkedKeys}
      height={height}
      treeData={treeDataWithDisabled}
      onCheck={handleCheck}
      onSelect={handleSelect}
    />
  );
});
DepartmentTreePanel.displayName = "DepartmentTreePanel";

function getRowKey(option: DataOption): string {
  return option.value;
}

function createDefaultDepartmentItem(deptId: string): StaffDepartmentItem {
  return {
    deptId,
    isDefault: false,
    isMedicalDirector: false,
    isNursingDirector: false
  };
}

function normalizeDepartments(departments: StaffDepartmentItem[]): Record<string, StaffDepartmentItem> {
  const result: Record<string, StaffDepartmentItem> = {};

  for (const dept of departments) {
    result[dept.deptId] = {
      deptId: dept.deptId,
      isDefault: dept.isDefault,
      isMedicalDirector: dept.isMedicalDirector,
      isNursingDirector: dept.isNursingDirector
    };
  }

  return result;
}

function createDeptMap(transferData: DataOption[]): Map<string, DataOption> {
  const map = new Map<string, DataOption>();

  for (const dept of transferData) {
    map.set(dept.value, dept);
  }

  return map;
}

interface DepartmentTransferSelectorProps {
  orgId?: string;
}

function DepartmentTransferSelector({ orgId }: DepartmentTransferSelectorProps): ReactNode {
  const { AppField, setFieldValue } = useFormContext<StaffDepartmentParams>();
  const staffId = useStaffCrudPageStore(state => (state.defaultFormValues as StaffDepartmentParams).staffId);

  const departmentsResult = useQuery({
    queryKey: [findStaffDepartments.key, { orgId, staffId }],
    queryFn: findStaffDepartments,
    enabled: Boolean(orgId)
  });

  const setInitialDepartments = useEffectEvent((departments: StaffDepartmentItem[]) => {
    setFieldValue("departments", normalizeDepartments(departments));
  });

  useEffect(() => {
    departmentsResult.promise.then(setInitialDepartments);
  }, [departmentsResult.promise]);

  const {
    treeProps,
    isFetching,
    searchValue,
    setSearchValue
  } = useDataOptionsTree({
    queryOptions: {
      queryKey: [findDepartmentTreeOptions.key, { orgId }],
      queryFn: findDepartmentTreeOptions,
      enabled: Boolean(orgId)
    }
  });

  const transferData = useMemo(() => flattenTree(treeProps.treeData ?? []), [treeProps.treeData]);
  const deptMap = useMemo(() => createDeptMap(transferData), [transferData]);

  const handleTransferChange = useCallback<GetProp<TransferProps, "onChange">>(targetKeys => {
    setFieldValue("departments", (prevDepartments: Record<string, StaffDepartmentItem>) => {
      const newDepartments: Record<string, StaffDepartmentItem> = {};

      for (const deptId of targetKeys) {
        const key = deptId as string;
        newDepartments[key] = prevDepartments[key] ?? createDefaultDepartmentItem(key);
      }

      return newDepartments;
    });
  }, [setFieldValue]);

  const tableColumns = useMemo<Array<TableColumn<StaffDepartmentItem>>>(() => [
    {
      title: "科室名称",
      dataIndex: "deptId",
      width: 200,
      render(value: string) {
        return deptMap.get(value)?.label ?? value;
      }
    },
    {
      title: "默认科室",
      dataIndex: "isDefault",
      width: 100,
      align: "center",
      shouldCellUpdate: alwaysFalse,
      render(_, item) {
        return (
          <AppField
            name={`departments.${item.deptId}.isDefault`}
            listeners={{
              onChange: ({ value, fieldApi }) => {
                if (!value) {
                  return;
                }

                fieldApi.form.setFieldValue("departments", (prevDepartments: Record<string, StaffDepartmentItem>) => {
                  const newDepartments: Record<string, StaffDepartmentItem> = {};

                  for (const [deptId, dept] of Object.entries(prevDepartments)) {
                    newDepartments[deptId] = { ...dept, isDefault: deptId === item.deptId };
                  }

                  return newDepartments;
                });
              }
            }}
          >
            {field => <field.Bool noWrapper variant="checkbox" />}
          </AppField>
        );
      }
    },
    {
      title: "医务主任",
      dataIndex: "isMedicalDirector",
      width: 100,
      align: "center",
      shouldCellUpdate: alwaysFalse,
      render(_, item) {
        return (
          <AppField name={`departments.${item.deptId}.isMedicalDirector`}>
            {field => <field.Bool noWrapper variant="checkbox" />}
          </AppField>
        );
      }
    },
    {
      title: "护理主任",
      dataIndex: "isNursingDirector",
      width: 100,
      align: "center",
      shouldCellUpdate: alwaysFalse,
      render(_, item) {
        return (
          <AppField name={`departments.${item.deptId}.isNursingDirector`}>
            {field => <field.Bool noWrapper variant="checkbox" />}
          </AppField>
        );
      }
    }
  ], [deptMap, AppField]);

  const { sizeSM, controlHeight } = useThemeTokens();

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.currentTarget.value);
  }, [setSearchValue]);

  return (
    <AppField name="departments">
      {field => {
        const departmentsRecord = (field.state.value as Record<string, StaffDepartmentItem>) ?? {};
        const departmentsArray = Object.values(departmentsRecord);
        const targetKeys = Object.keys(departmentsRecord);
        const treeDataWithDisabled = mapTree(
          treeProps.treeData ?? [],
          node => { return { ...node, disabled: targetKeys.includes(node.value) }; }
        );

        return (
          <Transfer
            classNames={{ section: classes.transferSection }}
            dataSource={transferData}
            rowKey={getRowKey}
            showSelectAll={false}
            targetKeys={targetKeys}
            titles={["所有部门", "已选部门"]}
            onChange={handleTransferChange}
          >
            {({
              direction,
              onItemSelect,
              onItemSelectAll,
              selectedKeys,
              disabled
            }) => {
              if (direction === "left") {
                const checkedKeys = [...selectedKeys, ...targetKeys];
                return (
                  <div className={classes.deptTreeWrapper}>
                    {isFetching
                      ? <Loader />
                      : (
                          <Stack gap="var(--vef-spacing-sm)">
                            <Input
                              placeholder="搜索科室"
                              suffix={<SearchOutlined className="input-suffix-icon" />}
                              value={searchValue}
                              onChange={handleSearchChange}
                            />

                            <DepartmentTreePanel
                              checkedKeys={checkedKeys}
                              height={480 - sizeSM * 3 - controlHeight}
                              treeDataWithDisabled={treeDataWithDisabled}
                              treeProps={treeProps}
                              onItemSelect={onItemSelect}
                            />
                          </Stack>
                        )}
                  </div>
                );
              }

              return (
                <Table
                  columns={tableColumns}
                  dataSource={departmentsArray}
                  pagination={false}
                  rowKey="deptId"
                  size="small"
                  rowSelection={{
                    getCheckboxProps: () => { return { disabled }; },
                    selectedRowKeys: selectedKeys,
                    onChange: selectedRowKeys => onItemSelectAll(selectedRowKeys, "replace")
                  }}
                />
              );
            }}
          </Transfer>
        );
      }}
    </AppField>
  );
}

function OrganizationSelector(): ReactNode {
  const { AppField } = useFormContext<StaffDepartmentParams>();

  const treeSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findOrganizationTreeOptions.key],
      queryFn: findOrganizationTreeOptions
    }
  });

  return (
    <AppField
      listeners={{ onChange: ({ fieldApi: { form } }) => form.setFieldValue("departments", {}) }}
      name="orgId"
    >
      {field => (
        <field.TreeSelect
          {...treeSelectProps}
          noWrapper
          className={classes.orgTreeSelect}
          placeholder="请选择机构"
        />
      )}
    </AppField>
  );
}

export function DepartmentAssignment(): ReactNode {
  const { Subscribe } = useFormContext<StaffDepartmentParams>();

  return (
    <Stack gap="var(--vef-spacing-sm)">
      <OrganizationSelector />

      <Subscribe selector={state => state.values.orgId}>
        {orgId => <DepartmentTransferSelector orgId={orgId} />}
      </Subscribe>
    </Stack>
  );
}
