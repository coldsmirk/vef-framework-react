import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { Role, RoleParams, RolePermissionParams, RoleSearch, RoleUserParams } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export interface RoleFormSceneValues extends CrudBasicSceneFormValues<RoleParams, RoleParams> {
  authorize: RolePermissionParams;
  assignUsers: RoleUserParams;
  viewUsers: { roleId: string };
}

export const {
  useCrudStore: useRolePageStore,
  OperationButtonGroup: RoleOperationButtonGroup,
  ActionButtonGroup: RoleActionButtonGroup
} = createCrudKit<Role, RoleSearch, RoleFormSceneValues>();
