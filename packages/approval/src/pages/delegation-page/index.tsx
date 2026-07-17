import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";

import type { Delegation, DelegationParams, DelegationSearch } from "../../types";
import type { ApprovalDelegationPageProps } from "./props";

import {
  ActionButton,
  createCrudKit,
  CrudPage,
  Icon,
  OperationButton,
  PermissionGate,
  useFormContext
} from "@vef-framework-react/components";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";

import { useDelegationApi } from "../../api";
import { APPROVAL_PERMISSIONS } from "../../permissions";
import { delegationColumns } from "./columns";
import { DelegationForm } from "./form";

export type { ApprovalDelegationPageProps } from "./props";

type DelegationSceneValues = CrudBasicSceneFormValues<DelegationParams, DelegationParams>;

const FORM_DRAWER_WIDTH = {
  xxs: "100vw",
  sm: 520
};

const { OperationButtonGroup: DelegationOperationButtonGroup, ActionButtonGroup: DelegationActionButtonGroup }
  = createCrudKit<Delegation, DelegationSearch, DelegationSceneValues>();

function delegationToFormValues(row: Delegation): DelegationParams {
  return {
    id: row.id,
    delegatorId: row.delegatorId,
    delegateeId: row.delegateeId,
    flowCategoryId: row.flowCategoryId ?? undefined,
    flowId: row.flowId ?? undefined,
    startTime: row.startTime,
    endTime: row.endTime,
    isActive: row.isActive,
    reason: row.reason ?? undefined
  };
}

/**
 * The inline search fields for the delegation list.
 */
function DelegationSearchFields() {
  const { AppField } = useFormContext<DelegationSearch>();

  return (
    <>
      <AppField name="delegatorId">{field => <field.Input allowClear noWrapper placeholder="委托人 ID" />}</AppField>
      <AppField name="delegateeId">{field => <field.Input allowClear noWrapper placeholder="被委托人 ID" />}</AppField>
    </>
  );
}

/**
 * Full-page delegation management. Non-super-admin callers only see (and can
 * only create) delegations they own as delegator — enforced server-side.
 */
export function ApprovalDelegationPage({
  permissions,
  columnStorageKey = "approval.delegation",
  title
}: ApprovalDelegationPageProps) {
  const api = useDelegationApi();
  const perms = { ...APPROVAL_PERMISSIONS.delegation, ...permissions };

  return (
    <CrudPage<Delegation, DelegationSearch, DelegationSceneValues>
      basicSearch={<DelegationSearchFields />}
      columnSettings={{ storageKey: columnStorageKey }}
      deleteMutationFn={api.remove}
      formLayout={{ layout: "vertical" }}
      queryFn={api.findPage}
      renderForm={() => <DelegationForm />}
      rowKey="id"
      tableColumns={delegationColumns}
      title={title}
      formMutationFns={{
        create: api.create,
        update: api.update
      }}
      operationColumn={{
        width: 150,
        render(row) {
          return (
            <DelegationOperationButtonGroup selector={s => [s.openForm, s.delete, s.refetchQuery] as const}>
              {([openForm, deleteRow, refetchQuery]) => (
                <>
                  <OperationButton
                    color="primary"
                    icon={<Icon component={EditIcon} />}
                    requiredPermissions={perms.update}
                    onClick={() => openForm({
                      scene: "update",
                      values: delegationToFormValues(row),
                      title: "编辑委托",
                      mode: "drawer",
                      width: FORM_DRAWER_WIDTH
                    })}
                  >
                    编辑
                  </OperationButton>

                  <OperationButton
                    confirmable
                    color="danger"
                    confirmDescription="确定删除该委托？"
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
            </DelegationOperationButtonGroup>
          );
        }
      }}
      sceneDefaultFormValues={{
        create: { isActive: true }
      }}
      toolbarActions={(
        <DelegationActionButtonGroup selector={s => [s.openForm] as const}>
          {([openForm]) => (
            <PermissionGate requiredPermissions={perms.create}>
              <ActionButton
                icon={<Icon component={PlusIcon} />}
                type="primary"
                onClick={() => openForm({
                  scene: "create",
                  title: "新增委托",
                  mode: "drawer",
                  width: FORM_DRAWER_WIDTH
                })}
              >
                新增委托
              </ActionButton>
            </PermissionGate>
          )}
        </DelegationActionButtonGroup>
      )}
    />
  );
}
