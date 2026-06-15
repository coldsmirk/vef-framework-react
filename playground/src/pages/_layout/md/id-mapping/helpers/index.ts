import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { IdMapping, IdMappingParams, IdMappingSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

type IdMappingFormValues = CrudBasicSceneFormValues<IdMappingParams, IdMappingParams>;

export const {
  useCrudStore: useIdMappingPageStore,
  useSearchValues: useIdMappingSearchValues,
  useSelectedRows: useIdMappingSelectedRows,
  OperationButtonGroup: IdMappingOperationButtonGroup,
  ActionButtonGroup: IdMappingActionButtonGroup
} = createCrudKit<IdMapping, IdMappingSearch, IdMappingFormValues>();
