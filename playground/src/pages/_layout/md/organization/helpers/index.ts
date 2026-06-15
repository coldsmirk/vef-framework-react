import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { Organization, OrganizationParams, OrganizationSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

type OrganizationFormValues = CrudBasicSceneFormValues<OrganizationParams, OrganizationParams>;

export const {
  useCrudStore: useOrganizationPageStore,
  useSearchValues: useOrganizationSearchValues,
  useSelectedRows: useOrganizationSelectedRows,
  OperationButtonGroup: OrganizationOperationButtonGroup,
  ActionButtonGroup: OrganizationActionButtonGroup
} = createCrudKit<Organization, OrganizationSearch, OrganizationFormValues>();
