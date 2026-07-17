import type { Route, RouteSearch } from "../../types";
import type { RouteSceneValues } from "./helpers";
import type { IntegrationRoutePageProps } from "./props";

import { ActionButton, CrudPage, Icon, OperationButton, PermissionGate } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useMemo } from "react";

import { useRouteApi } from "../../api";
import { useContractDirectory, useSystemDirectory } from "../../components";
import { INTEGRATION_PERMISSIONS } from "../../permissions";
import { buildRouteColumns } from "./columns";
import { RouteForm } from "./form";
import { ROUTE_FORM_DEFAULTS, RouteActionButtonGroup, RouteOperationButtonGroup, routeToParams } from "./helpers";
import { RouteSearchFields } from "./search";

const FORM_DRAWER_WIDTH = { xxs: "100vw", sm: 480 };

/**
 * Full-page route management: map route keys to the system serving a contract.
 */
export function IntegrationRoutePage({
  permissions,
  columnStorageKey = "integration.route",
  title
}: IntegrationRoutePageProps) {
  const api = useRouteApi();
  const systemDir = useSystemDirectory();
  const contractDir = useContractDirectory();
  const perms = { ...INTEGRATION_PERMISSIONS.route, ...permissions };
  const columns = useMemo(() => buildRouteColumns(systemDir, contractDir), [systemDir, contractDir]);

  return (
    <CrudPage<Route, RouteSearch, RouteSceneValues>
      rowSelection
      basicSearch={<RouteSearchFields />}
      columnSettings={{ storageKey: columnStorageKey }}
      deleteManyMutationFn={api.removeMany}
      deleteMutationFn={api.remove}
      formLayout={{ layout: "vertical" }}
      formMutationFns={{ create: api.create, update: api.update }}
      queryFn={api.findPage}
      renderForm={() => <RouteForm />}
      rowKey="id"
      sceneDefaultFormValues={{ create: ROUTE_FORM_DEFAULTS }}
      tableColumns={columns}
      title={title}
      operationColumn={{
        width: 160,
        render(row) {
          return (
            <RouteOperationButtonGroup selector={s => [s.openForm, s.delete, s.refetchQuery] as const}>
              {([openForm, deleteRow, refetchQuery]) => (
                <>
                  <OperationButton
                    color="primary"
                    icon={<Icon component={EditIcon} />}
                    requiredPermissions={perms.update}
                    onClick={() => openForm({
                      scene: "update",
                      values: routeToParams(row),
                      title: "编辑路由",
                      mode: "drawer",
                      width: FORM_DRAWER_WIDTH
                    })}
                  >
                    编辑
                  </OperationButton>

                  <OperationButton
                    confirmable
                    color="danger"
                    confirmDescription="确定删除该路由规则？"
                    icon={<Icon component={TrashIcon} />}
                    requiredPermissions={perms.delete}
                    onClick={async () => {
                      try {
                        await deleteRow(row);
                        refetchQuery();
                      } catch {
                        /* surfaced by the mutation */
                      }
                    }}
                  >
                    删除
                  </OperationButton>
                </>
              )}
            </RouteOperationButtonGroup>
          );
        }
      }}
      toolbarActions={(
        <RouteActionButtonGroup selector={s => [s.openForm, s.isQueryFetching, s.selectedRows, s.deleteMany, s.refetchQuery] as const}>
          {([openForm, isFetching, selectedRows, deleteMany, refetchQuery]) => (
            <>
              <PermissionGate requiredPermissions={perms.create}>
                <ActionButton
                  icon={<Icon component={PlusIcon} />}
                  type="primary"
                  onClick={() => openForm({
                    scene: "create",
                    title: "新增路由",
                    mode: "drawer",
                    width: FORM_DRAWER_WIDTH
                  })}
                >
                  新增路由
                </ActionButton>
              </PermissionGate>

              <PermissionGate requiredPermissions={perms.delete}>
                <ActionButton
                  confirmable
                  danger
                  confirmDescription="确定批量删除选中的路由？"
                  confirmMode="dialog"
                  disabled={isFetching || selectedRows.length === 0}
                  icon={<Icon component={TrashIcon} />}
                  onClick={async () => {
                    try {
                      await deleteMany(selectedRows);
                      refetchQuery();
                    } catch {
                      /* surfaced by the mutation */
                    }
                  }}
                >
                  批量删除
                </ActionButton>
              </PermissionGate>
            </>
          )}
        </RouteActionButtonGroup>
      )}
    />
  );
}
