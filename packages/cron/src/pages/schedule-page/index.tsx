import type { SchedulePermissionCodes } from "../../permissions";
import type { Schedule, ScheduleSearch } from "../../types";
import type { ScheduleSceneValues } from "./helpers";
import type { CronSchedulePageProps } from "./props";

import { ActionButton, CrudPage, Icon, OperationButton, PermissionGate, showSuccessMessage } from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { EditIcon, PauseIcon, PlayIcon, PlusIcon, TrashIcon, ZapIcon } from "lucide-react";

import { useScheduleApi } from "../../api";
import { CRON_PERMISSIONS } from "../../permissions";
import { scheduleColumns } from "./columns";
import { ScheduleForm } from "./form";
import { ScheduleActionButtonGroup, ScheduleOperationButtonGroup, useScheduleFormMutations } from "./helpers";
import { SCHEDULE_FORM_DEFAULTS, scheduleToFormValues } from "./model";
import { ScheduleSearchFields } from "./search";

const FORM_DRAWER_WIDTH = {
  xxs: "100vw",
  md: "80vw",
  lg: 680
};

// The per-row actions. Pause / resume / trigger_now are not built into
// CrudPage, so they run through their own mutations and refetch on success;
// edit and delete reuse the CrudPage store actions from the group.
function ScheduleRowActions({ row, perms }: { row: Schedule; perms: SchedulePermissionCodes }) {
  const api = useScheduleApi();
  const pauseMutation = useMutation({ mutationFn: api.pause });
  const resumeMutation = useMutation({ mutationFn: api.resume });
  const triggerMutation = useMutation({ mutationFn: api.triggerNow });

  return (
    <ScheduleOperationButtonGroup selector={s => [s.openForm, s.delete, s.refetchQuery] as const}>
      {([openForm, deleteRow, refetchQuery]) => (
        <>
          <OperationButton
            color="primary"
            icon={<Icon component={EditIcon} />}
            requiredPermissions={perms.manage}
            onClick={() => openForm({
              scene: "update",
              values: scheduleToFormValues(row),
              title: "编辑调度",
              mode: "drawer",
              width: FORM_DRAWER_WIDTH
            })}
          >
            编辑
          </OperationButton>

          {row.isEnabled
            ? (
                <OperationButton
                  color="orange"
                  icon={<Icon component={PauseIcon} />}
                  requiredPermissions={perms.manage}
                  onClick={async () => {
                    try {
                      await pauseMutation.mutateAsync({ name: row.name });
                      showSuccessMessage("已暂停");
                      refetchQuery();
                    } catch {
                      /* surfaced by the mutation */
                    }
                  }}
                >
                  暂停
                </OperationButton>
              )
            : (
                <OperationButton
                  color="primary"
                  icon={<Icon component={PlayIcon} />}
                  requiredPermissions={perms.manage}
                  onClick={async () => {
                    try {
                      await resumeMutation.mutateAsync({ name: row.name });
                      showSuccessMessage("已恢复");
                      refetchQuery();
                    } catch {
                      /* surfaced by the mutation */
                    }
                  }}
                >
                  恢复
                </OperationButton>
              )}

          <OperationButton
            confirmable
            color="purple"
            confirmDescription="将通过正常的领取流程立即触发一次执行。"
            icon={<Icon component={ZapIcon} />}
            requiredPermissions={perms.manage}
            onClick={async () => {
              try {
                await triggerMutation.mutateAsync({ name: row.name });
                showSuccessMessage("已触发一次执行");
                refetchQuery();
              } catch {
                /* surfaced by the mutation */
              }
            }}
          >
            立即执行
          </OperationButton>

          <OperationButton
            confirmable
            color="danger"
            confirmDescription="删除后该调度不再触发；历史运行记录仍会保留。"
            icon={<Icon component={TrashIcon} />}
            requiredPermissions={perms.manage}
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
    </ScheduleOperationButtonGroup>
  );
}

/**
 * Full-page management of the durable cron schedule store. Schedules are
 * addressed by name (no batch delete, no row selection); every mutation is
 * gated on the single `manage` permission.
 */
export function CronSchedulePage({
  permissions,
  columnStorageKey = "cron.schedule",
  title
}: CronSchedulePageProps) {
  const api = useScheduleApi();
  const formMutations = useScheduleFormMutations();
  const perms = { ...CRON_PERMISSIONS.schedule, ...permissions };

  return (
    <CrudPage<Schedule, ScheduleSearch, ScheduleSceneValues>
      basicSearch={<ScheduleSearchFields />}
      columnSettings={{ storageKey: columnStorageKey }}
      deleteMutationFn={api.remove}
      formLayout={{ layout: "vertical" }}
      formMutationFns={formMutations}
      operationColumn={{ width: 280, render: row => <ScheduleRowActions perms={perms} row={row} /> }}
      queryFn={api.findPage}
      renderForm={() => <ScheduleForm />}
      rowKey="id"
      sceneDefaultFormValues={{ create: SCHEDULE_FORM_DEFAULTS }}
      tableColumns={scheduleColumns}
      title={title}
      toolbarActions={(
        <ScheduleActionButtonGroup selector={s => [s.openForm] as const}>
          {([openForm]) => (
            <PermissionGate requiredPermissions={perms.manage}>
              <ActionButton
                icon={<Icon component={PlusIcon} />}
                type="primary"
                onClick={() => openForm({
                  scene: "create",
                  title: "新增调度",
                  mode: "drawer",
                  width: FORM_DRAWER_WIDTH
                })}
              >
                新增调度
              </ActionButton>
            </PermissionGate>
          )}
        </ScheduleActionButtonGroup>
      )}
    />
  );
}
