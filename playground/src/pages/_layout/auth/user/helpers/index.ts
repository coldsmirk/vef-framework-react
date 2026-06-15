import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { User, UserCreateParams, UserSearch, UserUpdateParams } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export type UserFormSceneValues = CrudBasicSceneFormValues<UserCreateParams, UserUpdateParams>;

export const {
  useCrudStore: useUserPageStore,
  useSearchValues: useUserSearchValues,
  useSelectedRows: useUserSelectedRows,
  OperationButtonGroup: UserOperationButtonGroup,
  ActionButtonGroup: UserActionButtonGroup
} = createCrudKit<User, UserSearch, UserFormSceneValues>();
