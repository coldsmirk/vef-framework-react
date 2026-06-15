import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { Menu, MenuParams, MenuSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export const {
  useCrudStore: useMenuPageStore,
  useSearchValues: useMenuSearchValues,
  useSelectedRows: useMenuSelectedRows,
  OperationButtonGroup: MenuOperationButtonGroup,
  ActionButtonGroup: MenuActionButtonGroup
} = createCrudKit<Menu, MenuSearch, CrudBasicSceneFormValues<MenuParams, MenuParams>>();
