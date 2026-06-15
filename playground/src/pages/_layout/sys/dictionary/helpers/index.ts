import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { Dictionary, DictionaryParams, DictionarySearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export type DictionaryFormValues = CrudBasicSceneFormValues<DictionaryParams, DictionaryParams>;

export const {
  useCrudStore: useDictionaryPageStore,
  useSearchValues: useDictionarySearchValues,
  useSelectedRows: useDictionarySelectedRows,
  OperationButtonGroup: DictionaryOperationButtonGroup,
  ActionButtonGroup: DictionaryActionButtonGroup
} = createCrudKit<Dictionary, DictionarySearch, DictionaryFormValues>();
