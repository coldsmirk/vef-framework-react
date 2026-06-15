import type { AnyObject } from "@vef-framework-react/shared";
import type { AuditLog, AuditLogSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export const {
  useCrudStore: useAuditLogPageStore,
  useSearchValues: useAuditLogSearchValues,
  useSelectedRows: useAuditLogSelectedRows,
  OperationButtonGroup: AuditLogOperationButtonGroup,
  ActionButtonGroup: AuditLogActionButtonGroup
} = createCrudKit<AuditLog, AuditLogSearch, AnyObject>();
