import type { CodeMap, CodeMapSearch } from "../../types";
import type { CodeMapSceneValues } from "./helpers";
import type { IntegrationCodeMapPageProps } from "./props";

import { ActionButton, CrudPage, Icon, OperationButton, PermissionGate } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useMemo } from "react";

import { useCodeMapApi } from "../../api";
import { useSystemDirectory } from "../../components";
import { INTEGRATION_PERMISSIONS } from "../../permissions";
import { buildCodeMapColumns } from "./columns";
import { CodeMapForm } from "./form";
import { CodeMapActionButtonGroup, CodeMapOperationButtonGroup, useCodeMapFormMutations } from "./helpers";
import { CODE_MAP_FORM_DEFAULTS, codeMapToFormValues } from "./model";
import { CodeMapSearchFields } from "./search";

const FORM_DRAWER_WIDTH = { xxs: "100vw", md: 760 };

/**
 * Full-page code map management: per-system bidirectional value translation
 * of code sets between the canonical model and the external system's coding.
 */
export function IntegrationCodeMapPage({
  permissions,
  columnStorageKey = "integration.code_map",
  title
}: IntegrationCodeMapPageProps) {
  const api = useCodeMapApi();
  const formMutations = useCodeMapFormMutations();
  const systemDir = useSystemDirectory();
  const perms = { ...INTEGRATION_PERMISSIONS.codeMap, ...permissions };
  const columns = useMemo(() => buildCodeMapColumns(systemDir), [systemDir]);

  return (
    <CrudPage<CodeMap, CodeMapSearch, CodeMapSceneValues>
      rowSelection
      basicSearch={<CodeMapSearchFields />}
      columnSettings={{ storageKey: columnStorageKey }}
      deleteManyMutationFn={api.removeMany}
      deleteMutationFn={api.remove}
      formLayout={{ layout: "vertical" }}
      formMutationFns={formMutations}
      queryFn={api.findPage}
      renderForm={scene => <CodeMapForm scene={scene} />}
      rowKey="id"
      sceneDefaultFormValues={{ create: CODE_MAP_FORM_DEFAULTS }}
      tableColumns={columns}
      title={title}
      operationColumn={{
        width: 160,
        render(row) {
          return (
            <CodeMapOperationButtonGroup selector={s => [s.openForm, s.delete, s.refetchQuery] as const}>
              {([openForm, deleteRow, refetchQuery]) => (
                <>
                  <OperationButton
                    color="primary"
                    icon={<Icon component={EditIcon} />}
                    requiredPermissions={perms.update}
                    onClick={() => openForm({
                      scene: "update",
                      values: codeMapToFormValues(row),
                      title: "编辑码表",
                      mode: "drawer",
                      width: FORM_DRAWER_WIDTH
                    })}
                  >
                    编辑
                  </OperationButton>

                  <OperationButton
                    confirmable
                    color="danger"
                    confirmDescription="确定删除该码表？引用它的适配器脚本将按未配置处理"
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
            </CodeMapOperationButtonGroup>
          );
        }
      }}
      toolbarActions={(
        <CodeMapActionButtonGroup selector={s => [s.openForm, s.isQueryFetching, s.selectedRows, s.deleteMany, s.refetchQuery] as const}>
          {([openForm, isFetching, selectedRows, deleteMany, refetchQuery]) => (
            <>
              <PermissionGate requiredPermissions={perms.create}>
                <ActionButton
                  icon={<Icon component={PlusIcon} />}
                  type="primary"
                  onClick={() => openForm({
                    scene: "create",
                    title: "新增码表",
                    mode: "drawer",
                    width: FORM_DRAWER_WIDTH
                  })}
                >
                  新增码表
                </ActionButton>
              </PermissionGate>

              <PermissionGate requiredPermissions={perms.delete}>
                <ActionButton
                  confirmable
                  danger
                  confirmDescription="确定批量删除选中的码表？"
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
        </CodeMapActionButtonGroup>
      )}
    />
  );
}
