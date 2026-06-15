import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { DictionaryItem, DictionaryItemParams, DictionaryItemSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export type DictionaryItemFormValues = CrudBasicSceneFormValues<DictionaryItemParams, DictionaryItemParams>;

export const {
  useCrudStore: useDictionaryItemCrudStore,
  useSearchValues: useDictionaryItemSearchValues,
  useSelectedRows: useDictionaryItemSelectedRows,
  OperationButtonGroup: DictionaryItemOperationButtonGroup,
  ActionButtonGroup: DictionaryItemActionButtonGroup
} = createCrudKit<DictionaryItem, DictionaryItemSearch, DictionaryItemFormValues>();
