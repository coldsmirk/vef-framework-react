import { defineMock } from "../define-mock";
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
    sortOrder: 1,
    remark: "日常门诊综合服务"
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
    sortOrder: 1,
    remark: "综合内科单元"
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
    sortOrder: 2,
    remark: "综合外科单元"
  },
  {
    id: "dept-legacy",
    parentId: "dept-outpatient",
    orgId: "org-root",
    name: "历史归档分部",
    shortName: "归档",
    level: "L2",
    type: "OUTPATIENT",
    isActive: false,
    sortOrder: 3,
    remark: "已停用，仅历史记录展示"
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
    sortOrder: 2,
    remark: "综合病区管理"
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
    sortOrder: 1,
    remark: "专科中心"
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
    sortOrder: 3,
    remark: "24 小时应急值守"
  }
];

const departmentTree = createTreeMock<DepartmentRow>({
  resource: "md/department",
  seed: seeds.length,
  searchField: "name",
  descriptionField: "remark",
  disabledWhen: row => !row.isActive,
  where: (items, params) => {
    const orgId = typeof params.orgId === "string" ? params.orgId : undefined;
    return orgId ? items.filter(item => item.orgId === orgId) : items;
  },
  factory: i => seeds[i]!
});

interface FlatDepartmentOption {
  id: string;
  parentId: string | null;
  name: string;
  inactive: boolean;
  remark?: string;
}

defineMock<Record<string, unknown>, FlatDepartmentOption[]>(
  "md/department",
  "find_flat_options",
  ({ params }) => {
    const orgId = typeof params?.orgId === "string" ? params.orgId : undefined;
    const rows = orgId
      ? departmentTree.store.filter(item => item.orgId === orgId)
      : departmentTree.store;

    return rows.map(row => {
      return {
        id: row.id,
        parentId: row.parentId ?? null,
        name: row.name,
        inactive: !row.isActive,
        ...typeof row.remark === "string" && row.remark.length > 0 && { remark: row.remark }
      };
    });
  }
);
