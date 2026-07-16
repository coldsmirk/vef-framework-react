import type { Contract, ContractSearch } from "../../types";
import type { ContractSceneValues } from "./helpers";
import type { IntegrationContractPageProps } from "./props";

import { ActionButton, CrudPage, Icon, OperationButton, PermissionGate } from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";

import { useContractApi } from "../../api";
import { INTEGRATION_PERMISSIONS } from "../../permissions";
import { contractColumns } from "./columns";
import { ContractForm } from "./form";
import { ContractActionButtonGroup, ContractOperationButtonGroup, useContractFormMutations } from "./helpers";
import { CONTRACT_FORM_DEFAULTS, contractToFormValues } from "./model";
import { ContractSearchFields } from "./search";

const FORM_DRAWER_WIDTH = {
  xxs: "100vw",
  md: "90vw",
  xl: 920
};

/**
 * Full-page contract management: list, search, create/update with JSON Schema editors, and delete.
 */
export function IntegrationContractPage({
  permissions,
  columnStorageKey = "integration.contract",
  title
}: IntegrationContractPageProps) {
  const api = useContractApi();
  const formMutations = useContractFormMutations();
  const perms = { ...INTEGRATION_PERMISSIONS.contract, ...permissions };

  return (
    <CrudPage<Contract, ContractSearch, ContractSceneValues>
      rowSelection
      basicSearch={<ContractSearchFields />}
      columnSettings={{ storageKey: columnStorageKey }}
      deleteManyMutationFn={api.removeMany}
      deleteMutationFn={api.remove}
      formLayout={{ layout: "vertical" }}
      formMutationFns={formMutations}
      queryFn={api.findPage}
      renderForm={scene => <ContractForm scene={scene} />}
      rowKey="id"
      sceneDefaultFormValues={{ create: CONTRACT_FORM_DEFAULTS }}
      tableColumns={contractColumns}
      title={title}
      operationColumn={{
        render(row) {
          return (
            <ContractOperationButtonGroup selector={s => [s.openForm, s.delete, s.refetchQuery] as const}>
              {([openForm, deleteRow, refetchQuery]) => (
                <>
                  <OperationButton
                    color="primary"
                    icon={<Icon component={EditIcon} />}
                    requiredPermissions={perms.update}
                    onClick={() => openForm({
                      scene: "update",
                      values: contractToFormValues(row),
                      title: "编辑契约",
                      mode: "drawer",
                      width: FORM_DRAWER_WIDTH
                    })}
                  >
                    编辑
                  </OperationButton>

                  <OperationButton
                    confirmable
                    color="danger"
                    confirmDescription="确定删除该契约？被路由或适配器引用时无法删除。"
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
            </ContractOperationButtonGroup>
          );
        }
      }}
      toolbarActions={(
        <ContractActionButtonGroup selector={s => [s.openForm, s.isQueryFetching, s.selectedRows, s.deleteMany, s.refetchQuery] as const}>
          {([openForm, isFetching, selectedRows, deleteMany, refetchQuery]) => (
            <>
              <PermissionGate requiredPermissions={perms.create}>
                <ActionButton
                  icon={<Icon component={PlusIcon} />}
                  type="primary"
                  onClick={() => openForm({
                    scene: "create",
                    title: "新增契约",
                    mode: "drawer",
                    width: FORM_DRAWER_WIDTH
                  })}
                >
                  新增契约
                </ActionButton>
              </PermissionGate>

              <PermissionGate requiredPermissions={perms.delete}>
                <ActionButton
                  confirmable
                  danger
                  confirmDescription="确定批量删除选中的契约？"
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
        </ContractActionButtonGroup>
      )}
    />
  );
}
