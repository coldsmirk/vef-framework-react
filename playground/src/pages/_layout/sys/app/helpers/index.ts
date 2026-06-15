import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { App, AppParams, AppSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

type AppSceneFormValues = CrudBasicSceneFormValues<AppParams, AppParams>;

export const {
  useCrudStore: useAppCrudStore,
  useSearchValues: useAppSearchValues,
  useSelectedRows: useAppSelectedRows,
  OperationButtonGroup: AppOperationButtonGroup,
  ActionButtonGroup: AppActionButtonGroup
} = createCrudKit<App, AppSearch, AppSceneFormValues>();
