import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";

import type { CategoryParams, CategorySearch, FlowCategory } from "../../types";
import type { ApprovalCategoryPageProps } from "./props";

import {
  ActionButton,
  createCrudKit,
  CrudPage,
  Icon,
  OperationButton,
  PermissionGate,
  useFormContext
} from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useMemo } from "react";

import { useCategoryApi } from "../../api";
import { APPROVAL_PERMISSIONS } from "../../permissions";
import { categoryColumns } from "./columns";
import { buildCategoryTreeOptions, CategoryForm } from "./form";

export type { ApprovalCategoryPageProps } from "./props";

type CategorySceneValues = CrudBasicSceneFormValues<CategoryParams, CategoryParams>;

const { OperationButtonGroup: CategoryOperationButtonGroup, ActionButtonGroup: CategoryActionButtonGroup }
  = createCrudKit<FlowCategory, CategorySearch, CategorySceneValues>();

function categoryToFormValues(row: FlowCategory): CategoryParams {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    icon: row.icon ?? undefined,
    parentId: row.parentId ?? undefined,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    remark: row.remark ?? undefined
  };
}

/**
 * The inline search fields for the category tree.
 */
function CategorySearchFields() {
  const { AppField } = useFormContext<CategorySearch>();

  return (
    <AppField name="name">{field => <field.Input allowClear noWrapper placeholder="分类名称" />}</AppField>
  );
}

/**
 * Full-page flow-category management: the category tree with inline
 * create/update/delete. Deleting a category does not cascade — flows keep
 * their category id.
 */
export function ApprovalCategoryPage({
  permissions,
  tenantId = "default",
  columnStorageKey = "approval.category",
  title
}: ApprovalCategoryPageProps) {
  const api = useCategoryApi();
  const perms = { ...APPROVAL_PERMISSIONS.category, ...permissions };

  return (
    <CrudPage<FlowCategory, CategorySearch, CategorySceneValues>
      basicSearch={<CategorySearchFields />}
      columnSettings={{ storageKey: columnStorageKey }}
      deleteMutationFn={api.remove}
      isPaginated={false}
      queryFn={api.findTree}
      renderForm={() => <CategoryFormWithTree />}
      rowKey="id"
      tableColumns={categoryColumns}
      title={title}
      formMutationFns={{
        create: api.create,
        update: api.update
      }}
      operationColumn={{
        width: 150,
        render(row) {
          return (
            <CategoryOperationButtonGroup selector={s => [s.openForm, s.delete, s.refetchQuery] as const}>
              {([openForm, deleteRow, refetchQuery]) => (
                <>
                  <OperationButton
                    color="primary"
                    icon={<Icon component={EditIcon} />}
                    requiredPermissions={perms.update}
                    onClick={() => openForm({ scene: "update", values: categoryToFormValues(row) })}
                  >
                    编辑
                  </OperationButton>

                  <OperationButton
                    confirmable
                    color="danger"
                    confirmDescription="确定删除该分类？该分类下的流程不会被删除。"
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
            </CategoryOperationButtonGroup>
          );
        }
      }}
      sceneDefaultFormValues={{
        create: {
          tenantId,
          sortOrder: 0,
          isActive: true
        }
      }}
      toolbarActions={(
        <CategoryActionButtonGroup selector={s => [s.openForm] as const}>
          {([openForm]) => (
            <PermissionGate requiredPermissions={perms.create}>
              <ActionButton icon={<Icon component={PlusIcon} />} type="primary" onClick={() => openForm({ scene: "create" })}>
                新增分类
              </ActionButton>
            </PermissionGate>
          )}
        </CategoryActionButtonGroup>
      )}
    />
  );
}

/**
 * The form body wired to the live tree data, so the parent selector excludes
 * the node being edited (a category can never become its own descendant).
 * The edited id is read through a headless `AppField` subscription.
 */
function CategoryFormWithTree() {
  const { AppField } = useFormContext<CategoryParams>();

  return (
    <AppField name="id">
      {field => <CategoryFormLoader editedId={field.state.value} />}
    </AppField>
  );
}

function CategoryFormLoader({ editedId }: { editedId?: string }) {
  const api = useCategoryApi();

  const { data } = useQuery({ queryFn: api.findTree, queryKey: [api.findTree.key, {}] });
  const treeOptions = useMemo(() => buildCategoryTreeOptions(data ?? [], editedId), [data, editedId]);

  return <CategoryForm treeOptions={treeOptions} />;
}
