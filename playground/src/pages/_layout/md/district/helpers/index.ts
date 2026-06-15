import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { District, DistrictParams, DistrictSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export const {
  useCrudStore: useDistrictPageStore,
  useSearchValues: useDistrictSearchValues,
  useSelectedRows: useDistrictSelectedRows,
  OperationButtonGroup: DistrictOperationButtonGroup,
  ActionButtonGroup: DistrictActionButtonGroup
} = createCrudKit<District, DistrictSearch, CrudBasicSceneFormValues<DistrictParams, DistrictParams>>();
