import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { Department, DepartmentParams, DepartmentSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export const {
  useCrudStore: useDepartmentPageStore,
  useSearchValues: useDepartmentSearchValues,
  useSelectedRows: useDepartmentSelectedRows,
  OperationButtonGroup: DepartmentOperationButtonGroup,
  ActionButtonGroup: DepartmentActionButtonGroup
} = createCrudKit<Department, DepartmentSearch, CrudBasicSceneFormValues<DepartmentParams, DepartmentParams>>();
