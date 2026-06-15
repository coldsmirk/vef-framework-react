import type { PaginatedQueryParams } from "@vef-framework-react/components";
import type { DataOption, PaginationResult } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";
import type { FullAuditedEntity } from "@vef-framework-react/starter";

import { extractQueryParams } from "@vef-framework-react/starter";
import { API_PATH, apiClient, createApiRequest } from "~api";

export type StaffStatus = "ON_JOB" | "LEAVE" | "RETIRE";

export interface Staff extends FullAuditedEntity {
  number: string;
  name: string;
  gender: string;
  genderName?: MaybeNull<string>;
  phoneNumber?: MaybeNull<string>;
  email?: MaybeNull<string>;
  avatar?: MaybeNull<string>;
  ethnicity?: MaybeNull<string>;
  birthDate?: MaybeNull<string>;
  idType?: MaybeNull<string>;
  idTypeName?: MaybeNull<string>;
  idNumber?: MaybeNull<string>;
  category?: MaybeNull<string>;
  categoryName?: MaybeNull<string>;
  professionalTitle?: MaybeNull<string>;
  professionalTitleName?: MaybeNull<string>;
  position?: MaybeNull<string>;
  positionName?: MaybeNull<string>;
  professionalRole?: MaybeNull<string>;
  professionalRoleName?: MaybeNull<string>;
  status: StaffStatus;
  statusName?: MaybeNull<string>;
  remark?: MaybeNull<string>;
  meta?: MaybeNull<Record<string, any>>;
}

export interface StaffSearch {
  orgId?: string;
  deptId?: string;
  keyword?: string;
}

export type StaffParams = Omit<Staff, "genderName" | "idTypeName" | "categoryName" | "professionalTitleName" | "positionName" | "professionalRoleName" | "statusName" | "defaultDept" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "createdByName" | "updatedByName">;

export interface StaffDepartmentSearch {
  orgId?: string;
  staffId: string;
}

export interface StaffDepartment {
  deptId: string;
  deptName?: string;
  isDefault: boolean;
  isMedicalDirector: boolean;
  isNursingDirector: boolean;
}

export interface StaffDepartmentItem {
  deptId: string;
  isDefault: boolean;
  isMedicalDirector: boolean;
  isNursingDirector: boolean;
}

export interface StaffDepartmentParams {
  orgId: string;
  staffId: string;
  departments: Record<string, StaffDepartmentItem>;
}

export const findStaffOptions = apiClient.createQueryFn(
  "find_staff_options",
  ({ post }) => async (params: StaffSearch) => {
    const result = await post<DataOption[]>(
      API_PATH,
      { data: createApiRequest("md/staff", "find_options", params) }
    );
    return result.data;
  }
);

export const findStaffPage = apiClient.createQueryFn(
  "find_staff_page",
  ({ post }) => async (queryParams: PaginatedQueryParams<StaffSearch>) => {
    const { params, pagination } = extractQueryParams(queryParams);
    const result = await post<PaginationResult<Staff>>(
      API_PATH,
      { data: createApiRequest("md/staff", "find_page", params, pagination) }
    );
    return result.data;
  }
);

export const createStaff = apiClient.createMutationFn(
  "create_staff",
  ({ post }) => (params: StaffParams) => post(
    API_PATH,
    { data: createApiRequest("md/staff", "create", params) }
  )
);

export const updateStaff = apiClient.createMutationFn(
  "update_staff",
  ({ post }) => (params: StaffParams) => post(
    API_PATH,
    { data: createApiRequest("md/staff", "update", params) }
  )
);

export const deleteStaff = apiClient.createMutationFn(
  "delete_staff",
  ({ post }) => (row: Staff) => post(
    API_PATH,
    { data: createApiRequest("md/staff", "delete", { id: row.id }) }
  )
);

export const findStaffDepartments = apiClient.createQueryFn(
  "find_staff_departments",
  ({ post }) => async (params: StaffDepartmentSearch) => {
    const result = await post<StaffDepartment[]>(
      API_PATH,
      { data: createApiRequest("md/staff", "find_departments", params) }
    );
    return result.data;
  }
);

export const saveStaffDepartments = apiClient.createMutationFn(
  "save_staff_departments",
  ({ post }) => (params: StaffDepartmentParams) => post(
    API_PATH,
    {
      data: createApiRequest("md/staff", "save_departments", {
        orgId: params.orgId,
        staffId: params.staffId,
        departments: Object.values(params.departments)
      })
    }
  )
);
