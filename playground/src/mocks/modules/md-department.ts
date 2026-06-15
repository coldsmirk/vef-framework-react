import { createTreeMock } from "../helpers/tree";

interface DepartmentRow {
  id: string;
  parentId?: string | null;
  orgId: string;
  name: string;
  shortName: string;
  level: string;
  type: string;
  introduction?: string | null;
  location?: string | null;
  isActive: boolean;
  sortOrder: number;
  remark?: string | null;
}

const seeds: DepartmentRow[] = [
  {
    id: "dept-outpatient",
    parentId: null,
    orgId: "org-root",
    name: "门诊部",
    shortName: "门诊",
    level: "L1",
    type: "OUTPATIENT",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "dept-internal",
    parentId: "dept-outpatient",
    orgId: "org-root",
    name: "内科",
    shortName: "内科",
    level: "L2",
    type: "OUTPATIENT",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "dept-surgery",
    parentId: "dept-outpatient",
    orgId: "org-root",
    name: "外科",
    shortName: "外科",
    level: "L2",
    type: "OUTPATIENT",
    isActive: true,
    sortOrder: 2
  },
  {
    id: "dept-inpatient",
    parentId: null,
    orgId: "org-root",
    name: "住院部",
    shortName: "住院",
    level: "L1",
    type: "INPATIENT",
    isActive: true,
    sortOrder: 2
  },
  {
    id: "dept-cardio",
    parentId: "dept-inpatient",
    orgId: "org-root",
    name: "心血管科",
    shortName: "心血管",
    level: "L2",
    type: "INPATIENT",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "dept-emergency",
    parentId: null,
    orgId: "org-root",
    name: "急诊科",
    shortName: "急诊",
    level: "L1",
    type: "EMERGENCY",
    isActive: true,
    sortOrder: 3
  }
];

createTreeMock<DepartmentRow>({
  resource: "md/department",
  seed: seeds.length,
  searchField: "name",
  where: (items, params) => {
    const orgId = typeof params.orgId === "string" ? params.orgId : undefined;
    return orgId ? items.filter(item => item.orgId === orgId) : items;
  },
  factory: i => seeds[i]!
});
