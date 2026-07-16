import type { Adapter, AdapterSearch } from "../../types";
import type { AdapterSceneValues } from "./helpers";
import type { IntegrationAdapterPageProps } from "./props";

import { ActionButton, CrudPage, Icon, OperationButton, PermissionGate } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useMemo } from "react";

import { useAdapterApi } from "../../api";
import { useContractDirectory, useSystemDirectory } from "../../components";
import { INTEGRATION_PERMISSIONS } from "../../permissions";
import { buildAdapterColumns } from "./columns";
import { AdapterForm } from "./form";
import { ADAPTER_FORM_DEFAULTS, AdapterActionButtonGroup, AdapterOperationButtonGroup, adapterToParams } from "./helpers";
import { AdapterSearchFields } from "./search";

const FORM_DRAWER_WIDTH = {
  xxs: "100vw",
  md: "90vw",
  xl: 960
};

/**
 * Full-page adapter management: the per-system-per-contract translation scripts, one per direction.
 */
export function IntegrationAdapterPage({
  permissions,
  columnStorageKey = "integration.adapter",
  title
}: IntegrationAdapterPageProps) {
  const api = useAdapterApi();
  const systemDir = useSystemDirectory();
  const contractDir = useContractDirectory();
  const perms = { ...INTEGRATION_PERMISSIONS.adapter, ...permissions };
  const columns = useMemo(() => buildAdapterColumns(systemDir, contractDir), [systemDir, contractDir]);

  return (
    <CrudPage<Adapter, AdapterSearch, AdapterSceneValues>
      rowSelection
      basicSearch={<AdapterSearchFields />}
      columnSettings={{ storageKey: columnStorageKey }}
      deleteManyMutationFn={api.removeMany}
      deleteMutationFn={api.remove}
      formLayout={{ layout: "vertical" }}
      formMutationFns={{ create: api.create, update: api.update }}
      queryFn={api.findPage}
      renderForm={scene => <AdapterForm scene={scene} />}
      rowKey="id"
      sceneDefaultFormValues={{ create: ADAPTER_FORM_DEFAULTS }}
      tableColumns={columns}
      title={title}
      operationColumn={{
        render(row) {
          return (
            <AdapterOperationButtonGroup selector={s => [s.openForm, s.delete, s.refetchQuery] as const}>
              {([openForm, deleteRow, refetchQuery]) => (
                <>
                  <OperationButton
                    color="primary"
                    icon={<Icon component={EditIcon} />}
                    requiredPermissions={perms.update}
                    onClick={() => openForm({
                      scene: "update",
                      values: adapterToParams(row),
                      title: "编辑适配器",
                      mode: "drawer",
                      width: FORM_DRAWER_WIDTH
                    })}
                  >
                    编辑
                  </OperationButton>

                  <OperationButton
                    confirmable
                    color="danger"
                    confirmDescription="确定删除该适配器？"
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
            </AdapterOperationButtonGroup>
          );
        }
      }}
      toolbarActions={(
        <AdapterActionButtonGroup selector={s => [s.openForm, s.isQueryFetching, s.selectedRows, s.deleteMany, s.refetchQuery] as const}>
          {([openForm, isFetching, selectedRows, deleteMany, refetchQuery]) => (
            <>
              <PermissionGate requiredPermissions={perms.create}>
                <ActionButton
                  icon={<Icon component={PlusIcon} />}
                  type="primary"
                  onClick={() => openForm({
                    scene: "create",
                    title: "新增适配器",
                    mode: "drawer",
                    width: FORM_DRAWER_WIDTH
                  })}
                >
                  新增适配器
                </ActionButton>
              </PermissionGate>

              <PermissionGate requiredPermissions={perms.delete}>
                <ActionButton
                  confirmable
                  danger
                  confirmDescription="确定批量删除选中的适配器？"
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
        </AdapterActionButtonGroup>
      )}
    />
  );
}
