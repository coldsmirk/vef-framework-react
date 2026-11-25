import { faker } from "@faker-js/faker";

import { defineMock, MockBusinessError } from "../define-mock";
import { createCrudMock } from "../helpers/crud";
import { enrichWithDictNames } from "../helpers/dict-enrich";

interface StaffRow {
  id: string;
  number: string;
  name: string;
  gender: string;
  phoneNumber?: string | null;
  email?: string | null;
  avatar?: string | null;
  ethnicity?: string | null;
  birthDate?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  category?: string | null;
  professionalTitle?: string | null;
  position?: string | null;
  professionalRole?: string | null;
  status: "ON_JOB" | "LEAVE" | "RETIRE";
  remark?: string | null;
}

const decorateStaff = enrichWithDictNames<StaffRow>({
  category: "md.staff.category",
  gender: "md.staff.gender",
  idType: "md.staff.id_type",
  position: "md.staff.position",
  professionalRole: "md.staff.professional_role",
  professionalTitle: "md.staff.professional_title",
  status: "md.staff.status"
});

const staffCrud = createCrudMock<StaffRow>({
  resource: "md/staff",
  seed: 32,
  searchFields: ["number", "name", "phoneNumber", "email"],
  decorate: decorateStaff,
  factory: i => {
    return {
      id: faker.string.uuid(),
      number: `S${String(10_001 + i).padStart(6, "0")}`,
      name: faker.person.fullName(),
      gender: i % 2 === 0 ? "M" : "F",
      phoneNumber: faker.phone.number(),
      email: faker.internet.email(),
      avatar: null,
      ethnicity: "汉族",
      birthDate: faker.date.between({ from: "1960-01-01", to: "2000-12-31" }).toISOString().slice(0, 10),
      idType: "ID_CARD",
      idNumber: faker.string.numeric(18),
      category: faker.helpers.arrayElement(["DOCTOR", "NURSE", "ADMIN", "TECHNICIAN"]),
      professionalTitle: faker.helpers.arrayElement(["CHIEF_PHYSICIAN", "ATTENDING", "RESIDENT"]),
      position: faker.helpers.arrayElement(["DIRECTOR", "DEPUTY", "LEADER"]),
      professionalRole: faker.helpers.arrayElement(["PHYSICIAN", "NURSE_PRO", "PHARMACIST"]),
      status: faker.helpers.weightedArrayElement([
        { weight: 80, value: "ON_JOB" as const },
        { weight: 15, value: "LEAVE" as const },
        { weight: 5, value: "RETIRE" as const }
      ]),
      remark: null
    };
  }
});

interface StaffDepartmentRow {
  deptId: string;
  deptName?: string;
  isDefault: boolean;
  isMedicalDirector: boolean;
  isNursingDirector: boolean;
}

const staffDepartments = new Map<string, StaffDepartmentRow[]>();

defineMock<{ staffId: string; orgId?: string }, StaffDepartmentRow[]>(
  "md/staff",
  "find_departments",
  ({ params }) => staffDepartments.get(params.staffId) ?? []
);

defineMock<
  { orgId: string; staffId: string; departments: Record<string, { deptId: string; isDefault: boolean; isMedicalDirector: boolean; isNursingDirector: boolean }> },
  null
>("md/staff", "save_departments", ({ params }) => {
  const rows: StaffDepartmentRow[] = Object.values(params.departments).map(d => {
    return {
      deptId: d.deptId,
      isDefault: d.isDefault,
      isMedicalDirector: d.isMedicalDirector,
      isNursingDirector: d.isNursingDirector
    };
  });
  staffDepartments.set(params.staffId, rows);
  return null;
});

/**
 * Record-lookup endpoint for form action sequences (`api_call` → `select_record`
 * → `set_fields`). Exercises 0 / 1 / multiple matches against the seeded staff
 * store (e.g. `S010001` → 1, `S0100` → multiple, `S999999` → 0), throws a
 * business error on `ERROR` / `FAIL`, and adds a short async delay so busy
 * indicators and rapid-change superseding are observable in preview.
 */
defineMock<{ keyword?: string }, StaffRow[]>(
  "md/staff",
  "lookup",
  async ({ params }) => {
    await new Promise(resolve => {
      setTimeout(resolve, 120);
    });

    const keyword = typeof params?.keyword === "string" ? params.keyword.trim() : "";

    if (keyword.length === 0) {
      return [];
    }

    const upper = keyword.toUpperCase();

    if (upper === "ERROR" || upper === "FAIL") {
      throw new MockBusinessError(500, "职员查询服务暂不可用");
    }

    const needle = keyword.toLowerCase();

    return staffCrud.store
      .filter(row => [row.number, row.name, row.phoneNumber, row.email].some(
        value => typeof value === "string" && value.toLowerCase().includes(needle)
      ))
      .map(row => decorateStaff(row));
  }
);
