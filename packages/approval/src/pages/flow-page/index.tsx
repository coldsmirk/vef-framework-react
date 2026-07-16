import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { EmptyObject } from "@vef-framework-react/shared";

import type { Flow, FlowSearch } from "../../types";
import type { ApprovalFlowPageProps } from "./props";

import {
  ActionButton,
  CrudPage,
  Icon,
  OperationButton,
  PermissionGate,
  showSuccessMessage
} from "@vef-framework-react/components";
import { useMutation, useQuery } from "@vef-framework-react/core";
import { HistoryIcon, PenToolIcon, PlusIcon, PowerIcon, PowerOffIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { useCategoryApi, useFlowApi } from "../../api";
import { APPROVAL_PERMISSIONS } from "../../permissions";
import { buildCategoryTreeOptions } from "../category-page/form";
import { buildFlowColumns, flattenCategoryNames } from "./columns";
import { FlowDesignerDrawer } from "./designer";
import { FlowSearchFields } from "./search";
import { FlowVersionsDrawer } from "./versions";

export { FlowDesignerDrawer, type FlowDesignerDrawerProps } from "./designer";
export type { ApprovalFlowPageProps } from "./props";

type FlowSceneValues = CrudBasicSceneFormValues<EmptyObject, EmptyObject>;

/**
 * Full-page flow management: the flow list with label filtering, the
 * full-screen designer (settings → form → graph → review, deployed and
 * optionally published in one chain), version history, and activation.
 * Designer and toggle mutations invalidate the list query, so the table
 * refreshes without wiring callbacks through the drawer.
 */
export function ApprovalFlowPage({
  permissions,
  tenantId = "default",
  columnStorageKey = "approval.flow",
  title
}: ApprovalFlowPageProps) {
  const api = useFlowApi();
  const categoryApi = useCategoryApi();
  const perms = { ...APPROVAL_PERMISSIONS.flow, ...permissions };

  // undefined = closed; null = create; a Flow = redesign that flow.
  const [designerTarget, setDesignerTarget] = useState<Flow | null | undefined>(undefined);
  const [versionsTarget, setVersionsTarget] = useState<Flow | null>(null);

  const { data: categories } = useQuery({ queryFn: categoryApi.findTree, queryKey: [categoryApi.findTree.key, {}] });
  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories ?? []), [categories]);
  const categoryNames = useMemo(() => flattenCategoryNames(categoryOptions), [categoryOptions]);
  const columns = useMemo(() => buildFlowColumns(categoryNames), [categoryNames]);

  const toggleActive = useMutation({
    mutationFn: api.toggleActive,
    meta: { shouldShowSuccessFeedback: false, invalidates: [[api.findFlows.key]] }
  });

  return (
    <>
      <CrudPage<Flow, FlowSearch, FlowSceneValues>
        basicSearch={<FlowSearchFields categoryOptions={categoryOptions} />}
        columnSettings={{ storageKey: columnStorageKey }}
        queryFn={api.findFlows}
        rowKey="id"
        tableColumns={columns}
        title={title}
        operationColumn={{
          width: 240,
          render(row) {
            return (
              <>
                <OperationButton
                  color="primary"
                  icon={<Icon component={PenToolIcon} />}
                  requiredPermissions={perms.update}
                  onClick={() => setDesignerTarget(row)}
                >
                  设计
                </OperationButton>

                <OperationButton
                  icon={<Icon component={HistoryIcon} />}
                  requiredPermissions={perms.query}
                  onClick={() => setVersionsTarget(row)}
                >
                  版本
                </OperationButton>

                <OperationButton
                  confirmable
                  color={row.isActive ? "danger" : "primary"}
                  icon={<Icon component={row.isActive ? PowerOffIcon : PowerIcon} />}
                  requiredPermissions={perms.update}
                  confirmDescription={row.isActive
                    ? "停用后该流程不可再发起，进行中的实例不受影响。"
                    : "确定启用该流程？"}
                  onClick={async () => {
                    try {
                      await toggleActive.mutateAsync({ flowId: row.id, isActive: !row.isActive });
                      showSuccessMessage(row.isActive ? "已停用" : "已启用");
                    } catch {
                      /* surfaced by the http client */
                    }
                  }}
                >
                  {row.isActive ? "停用" : "启用"}
                </OperationButton>
              </>
            );
          }
        }}
        toolbarActions={(
          <PermissionGate requiredPermissions={perms.create}>
            <ActionButton icon={<Icon component={PlusIcon} />} type="primary" onClick={() => setDesignerTarget(null)}>
              新建流程
            </ActionButton>
          </PermissionGate>
        )}
      />

      <FlowDesignerDrawer
        flow={designerTarget ?? undefined}
        open={designerTarget !== undefined}
        tenantId={tenantId}
        onClose={() => setDesignerTarget(undefined)}
      />

      <FlowVersionsDrawer
        flow={versionsTarget}
        open={versionsTarget !== null}
        publishPermission={perms.publish}
        onClose={() => setVersionsTarget(null)}
      />
    </>
  );
}
