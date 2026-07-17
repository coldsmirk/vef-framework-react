import type { System, SystemSearch } from "../../types";
import type { SystemSceneValues } from "./helpers";
import type { IntegrationSystemPageProps } from "./props";

import { ActionButton, CrudPage, Icon, OperationButton, PermissionGate } from "@vef-framework-react/components";
import { ActivityIcon, EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { useSystemApi } from "../../api";
import { TestConnectionDrawer } from "../../components";
import { INTEGRATION_PERMISSIONS } from "../../permissions";
import { systemColumns } from "./columns";
import { SystemForm } from "./form";
import { SystemActionButtonGroup, SystemOperationButtonGroup, useSystemFormMutations } from "./helpers";
import { SYSTEM_FORM_DEFAULTS, systemToFormValues } from "./model";
import { SystemSearchFields } from "./search";

const FORM_DRAWER_WIDTH = {
  xxs: "100vw",
  md: "85vw",
  lg: 760
};

// Full-page system management: connection settings, outbound/inbound auth,
// optional direct data source, plus a connection probe.
export function IntegrationSystemPage({
  permissions,
  testConnectionPermission = INTEGRATION_PERMISSIONS.ops.testConnection,
  columnStorageKey = "integration.system",
  title
}: IntegrationSystemPageProps) {
  const api = useSystemApi();
  const formMutations = useSystemFormMutations();
  const perms = { ...INTEGRATION_PERMISSIONS.system, ...permissions };
  const [testTarget, setTestTarget] = useState<System | null>(null);

  return (
    <>
      <CrudPage<System, SystemSearch, SystemSceneValues>
        rowSelection
        basicSearch={<SystemSearchFields />}
        columnSettings={{ storageKey: columnStorageKey }}
        deleteManyMutationFn={api.removeMany}
        deleteMutationFn={api.remove}
        formLayout={{ layout: "vertical" }}
        formMutationFns={formMutations}
        queryFn={api.findPage}
        renderForm={scene => <SystemForm scene={scene} />}
        rowKey="id"
        sceneDefaultFormValues={{ create: SYSTEM_FORM_DEFAULTS }}
        tableColumns={systemColumns}
        title={title}
        operationColumn={{
          width: 220,
          render(row) {
            return (
              <SystemOperationButtonGroup selector={s => [s.openForm, s.delete, s.refetchQuery] as const}>
                {([openForm, deleteRow, refetchQuery]) => (
                  <>
                    <OperationButton
                      color="primary"
                      icon={<Icon component={EditIcon} />}
                      requiredPermissions={perms.update}
                      onClick={() => openForm({
                        scene: "update",
                        values: systemToFormValues(row),
                        title: "编辑系统",
                        mode: "drawer",
                        width: FORM_DRAWER_WIDTH
                      })}
                    >
                      编辑
                    </OperationButton>

                    <OperationButton
                      color="orange"
                      icon={<Icon component={ActivityIcon} />}
                      requiredPermissions={testConnectionPermission}
                      onClick={() => setTestTarget(row)}
                    >
                      测试连接
                    </OperationButton>

                    <OperationButton
                      confirmable
                      color="danger"
                      confirmDescription="确定删除该系统？其直连数据源注册将被释放。"
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
              </SystemOperationButtonGroup>
            );
          }
        }}
        toolbarActions={(
          <SystemActionButtonGroup selector={s => [s.openForm, s.isQueryFetching, s.selectedRows, s.deleteMany, s.refetchQuery] as const}>
            {([openForm, isFetching, selectedRows, deleteMany, refetchQuery]) => (
              <>
                <PermissionGate requiredPermissions={perms.create}>
                  <ActionButton
                    icon={<Icon component={PlusIcon} />}
                    type="primary"
                    onClick={() => openForm({
                      scene: "create",
                      title: "新增系统",
                      mode: "drawer",
                      width: FORM_DRAWER_WIDTH
                    })}
                  >
                    新增系统
                  </ActionButton>
                </PermissionGate>

                <PermissionGate requiredPermissions={perms.delete}>
                  <ActionButton
                    confirmable
                    danger
                    confirmDescription="确定批量删除选中的系统？"
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
          </SystemActionButtonGroup>
        )}
      />

      <TestConnectionDrawer open={testTarget !== null} system={testTarget} onClose={() => setTestTarget(null)} />
    </>
  );
}
