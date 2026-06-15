import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { ConfigDefinition, ConfigDefinitionParams, ConfigDefinitionSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

type ConfigDefinitionFormValues = CrudBasicSceneFormValues<ConfigDefinitionParams, ConfigDefinitionParams>;

export const {
  useCrudStore: useConfigDefinitionPageStore,
  useSearchValues: useConfigDefinitionSearchValues,
  useSelectedRows: useConfigDefinitionSelectedRows,
  OperationButtonGroup: ConfigDefinitionOperationButtonGroup,
  ActionButtonGroup: ConfigDefinitionActionButtonGroup
} = createCrudKit<ConfigDefinition, ConfigDefinitionSearch, ConfigDefinitionFormValues>();
