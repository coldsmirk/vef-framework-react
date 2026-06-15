import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { SerialNoRule, SerialNoRuleParams, SerialNoRuleSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export const {
  useCrudStore: useSerialNoRulePageStore,
  useSearchValues: useSerialNoRuleSearchValues,
  useSelectedRows: useSerialNoRuleSelectedRows,
  OperationButtonGroup: SerialNoRuleOperationButtonGroup,
  ActionButtonGroup: SerialNoRuleActionButtonGroup
} = createCrudKit<SerialNoRule, SerialNoRuleSearch, CrudBasicSceneFormValues<SerialNoRuleParams, SerialNoRuleParams>>();
