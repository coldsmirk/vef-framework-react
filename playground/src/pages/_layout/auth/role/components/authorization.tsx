import type { TableColumn } from "@vef-framework-react/components";
import type { DataOption } from "@vef-framework-react/core";
import type { MaybeUndefined } from "@vef-framework-react/shared";
import type { DataScopeTarget, RolePermission, RolePermissionItem, RolePermissionParams } from "~apis";

import { Badge, Dropdown, Group, Loader, Table, useFormContext } from "@vef-framework-react/components";
import { useQueries } from "@vef-framework-react/core";
import { alwaysFalse, isNullish, traverseTree } from "@vef-framework-react/shared";
import { useEffect, useEffectEvent, useMemo } from "react";
import { findPermissionOptions, findRolePermissions } from "~apis";

import { useRolePageStore } from "../helpers";
import { DataScopeSelector } from "./data-scope-selector";

const DATA_SCOPE_OPTIONS = [
  { label: "全部", value: "A" },
  { label: "仅自己", value: "S" },
  { label: "所属部门", value: "D" },
  { label: "所属部门及以下", value: "DS" },
  { label: "所属机构", value: "O" },
  { label: "所属机构及以下", value: "OS" }
] as const;

function setChildrenFieldValue(
  children: DataOption[],
  granted: boolean,
  setFieldValue: (field: string, value: boolean) => void
): void {
  for (const child of children) {
    setFieldValue(`permissions.${child.value}.granted`, granted);

    if (child.children) {
      setChildrenFieldValue(child.children, granted, setFieldValue);
    }
  }
}

function createContextMenu(
  row: DataOption,
  setFieldValue: (field: string, value: boolean) => void,
  onSelectAll: () => void,
  onClearAll: () => void
) {
  return {
    items: [
      {
        label: "全选",
        key: "selectAll",
        onClick: () => {
          onSelectAll();

          if (row.children) {
            setChildrenFieldValue(row.children, true, setFieldValue);
          }
        }
      },
      {
        label: "取消全选",
        key: "clearAll",
        onClick: () => {
          onClearAll();

          if (row.children) {
            setChildrenFieldValue(row.children, false, setFieldValue);
          }
        }
      }
    ]
  };
}

export function Authorization() {
  const {
    Subscribe,
    AppField,
    setFieldValue,
    reset
  } = useFormContext();
  const defaultFormValues = useRolePageStore(state => state.defaultFormValues) as RolePermissionParams;

  const results = useQueries({
    queries: [
      {
        queryKey: [findRolePermissions.key, defaultFormValues.roleId],
        queryFn: findRolePermissions
      },
      {
        queryKey: [findPermissionOptions.key],
        queryFn: findPermissionOptions
      }
    ],
    combine: ([rolePermissionsResult, permissionOptionsResult]) => {
      return {
        isFetching: rolePermissionsResult.isFetching || permissionOptionsResult.isFetching,
        rolePermissions: rolePermissionsResult.data,
        permissionOptions: permissionOptionsResult.data,
        promise: Promise.all([rolePermissionsResult.promise, permissionOptionsResult.promise])
      };
    }
  });

  const setNormalizedPermissions = useEffectEvent(([permissions, options]: [RolePermission[], DataOption[]]) => {
    const normalizedPermissions: Record<string, RolePermissionItem> = {};

    for (const permission of permissions) {
      normalizedPermissions[permission.permissionId] = {
        granted: true,
        dataScope: permission.dataScope,
        dataScopeTargets: permission.dataScopeTargets,
        customFilter: permission.customFilter
      };
    }

    traverseTree(options, node => {
      if (node.meta?.type === "P") {
        const permission = { ...normalizedPermissions[node.value] } as RolePermissionItem;

        if (isNullish(permission.dataScope)) {
          permission.dataScope = "A";
        }

        if (isNullish(permission.granted)) {
          permission.granted = false;
        }

        normalizedPermissions[node.value] = permission;
      }
    });

    reset({
      roleId: defaultFormValues.roleId,
      permissions: normalizedPermissions
    });
  });

  useEffect(() => {
    results.promise.then(setNormalizedPermissions);
  }, [results.promise]);

  const authorizationColumns = useMemo<Array<TableColumn<DataOption>>>(() => [
    {
      title: "名称",
      dataIndex: "label",
      width: 280,
      shouldCellUpdate: alwaysFalse
    },
    {
      title: "数据范围",
      dataIndex: "__dataScope",
      shouldCellUpdate: alwaysFalse,
      render(_, row) {
        if (row.meta?.type !== "P") {
          return null;
        }

        return (
          <AppField
            name={`permissions.${row.value}.dataScope`}
            listeners={{
              onChange: ({ value, fieldApi }) => {
                if (value !== "C") {
                  fieldApi.form.setFieldValue(`permissions.${row.value}.dataScopeTargets`, []);
                }
              }
            }}
          >
            {field => {
              const isCustom = field.state.value === "C";

              return (
                <Group>
                  <field.Radio
                    noWrapper
                    options={[
                      ...DATA_SCOPE_OPTIONS,
                      {
                        label: (
                          <Subscribe
                            selector={state => {
                              const params = state.values as RolePermissionParams;
                              return params?.permissions?.[row.value]?.dataScopeTargets?.length ?? 0;
                            }}
                          >
                            {count => <Badge count={count}>自定义</Badge>}
                          </Subscribe>
                        ),
                        value: "C"
                      }
                    ]}
                  />

                  <AppField name={`permissions.${row.value}.dataScopeTargets`}>
                    {targetsField => (
                      <DataScopeSelector
                        show={isCustom}
                        value={(targetsField.state.value as MaybeUndefined<DataScopeTarget[]>) ?? []}
                        onChange={targetsField.setValue}
                      />
                    )}
                  </AppField>
                </Group>
              );
            }}
          </AppField>
        );
      }
    }
  ], [AppField, Subscribe]);

  return (
    <div style={{ height: "100%" }}>
      {results.isFetching
        ? <Loader />
        : (
            <Table
              columns={authorizationColumns}
              dataSource={results.permissionOptions}
              expandable={{ defaultExpandAllRows: true }}
              indentSize={32}
              pagination={false}
              rowKey="value"
              rowSelection={{
                align: "center",
                checkStrictly: true,
                columnWidth: 48,
                hideSelectAll: true,
                renderCell(_, row) {
                  return (
                    <AppField name={`permissions.${row.value}.granted`}>
                      {field => (
                        <Dropdown
                          trigger={["contextMenu"]}
                          menu={createContextMenu(
                            row,
                            setFieldValue,
                            () => field.setValue(true),
                            () => field.setValue(false)
                          )}
                        >
                          <span>
                            <field.Bool noWrapper variant="checkbox" />
                          </span>
                        </Dropdown>
                      )}
                    </AppField>
                  );
                }
              }}
            />
          )}
    </div>
  );
}
