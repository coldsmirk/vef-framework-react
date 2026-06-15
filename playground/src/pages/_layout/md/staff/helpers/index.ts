import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";
import type { Staff, StaffDepartmentParams, StaffParams, StaffSearch } from "~apis";

import { createCrudKit } from "@vef-framework-react/components";

export interface StaffFormSceneValues extends CrudBasicSceneFormValues<StaffParams, StaffParams> {
  assignDepartment: StaffDepartmentParams;
}

const staffCrudKit = createCrudKit<Staff, StaffSearch, StaffFormSceneValues>();

export const useStaffCrudPageStore = staffCrudKit.useCrudStore;
export const useStaffSearchValues = staffCrudKit.useSearchValues;
export const useStaffSelectedRows = staffCrudKit.useSelectedRows;
export const StaffOperationButtonGroup = staffCrudKit.OperationButtonGroup;
export const StaffActionButtonGroup = staffCrudKit.ActionButtonGroup;
