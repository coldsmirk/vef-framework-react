import type { DataOption } from "@vef-framework-react/core";

import { faker } from "@faker-js/faker";

import { defineMock } from "../define-mock";
import { createTreeMock, flattenTree, nestTree } from "../helpers/tree";

// Seed roots (level=root) and a few items so the tree renders something.
// Each top-level dictionary maps to one of the keys consumed via
// `sys/dictionary_item.find_items` below.
const DICTIONARY_TYPES = [
  {
    id: "dict-common-gender",
    key: "common.gender",
    name: "通用性别"
  },
  {
    id: "dict-md-staff-status",
    key: "md.staff.status",
    name: "员工状态"
  },
  {
    id: "dict-md-organization-type",
    key: "md.organization.type",
    name: "机构类型"
  },
  {
    id: "dict-md-department-level",
    key: "md.department.level",
    name: "科室级别"
  },
  {
    id: "dict-md-district-level",
    key: "md.district.level",
    name: "行政区级别"
  },
  {
    id: "dict-sys-menu-type",
    key: "sys.menu.type",
    name: "菜单类型"
  },
  {
    id: "dict-sys-config-value-type",
    key: "sys.config_definition.value_type",
    name: "配置值类型"
  },
  {
    id: "dict-sys-config-category",
    key: "sys.config_definition.category",
    name: "配置分类"
  },
  {
    id: "dict-sys-serial-date-format",
    key: "sys.serial_no_rule.date_format",
    name: "流水号日期格式"
  },
  {
    id: "dict-sys-serial-reset-cycle",
    key: "sys.serial_no_rule.reset_cycle",
    name: "流水号重置周期"
  }
];

createTreeMock<{
  id: string;
  parentId?: string | null;
  name: string;
  key: string;
  type: string;
  typeName?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}>({
  resource: "sys/dictionary",
  seed: DICTIONARY_TYPES.length,
  searchField: "name",
  factory: i => {
    const d = DICTIONARY_TYPES[i]!;
    return {
      id: d.id,
      parentId: null,
      type: d.key,
      typeName: d.name,
      name: d.name,
      key: d.key,
      isSystem: i < 2,
      isActive: true,
      sortOrder: i + 1
    };
  }
});

// Mirror the same seed data into `find_tree_options` so dictionary item
// forms can pick a parent. (createTreeMock already registers the action,
// but we override-noop here would override; we instead reuse what's
// registered.)

// Sample dictionary items registry used by both `find_items` (the batch
// lookup consumed across the UI) and the dictionary-item CRUD store.
export const DICTIONARY_ITEMS: Record<string, DataOption[]> = {
  "common.gender": [
    { label: "男", value: "male" },
    { label: "女", value: "female" },
    { label: "未知", value: "unknown" }
  ],
  "md.staff.gender": [
    { label: "男", value: "M" },
    { label: "女", value: "F" }
  ],
  "sys.user.gender": [
    { label: "男", value: "male" },
    { label: "女", value: "female" }
  ],
  "md.staff.status": [
    { label: "在职", value: "ON_JOB" },
    { label: "休假", value: "LEAVE" },
    { label: "退休", value: "RETIRE" }
  ],
  "md.staff.id_type": [
    { label: "居民身份证", value: "ID_CARD" },
    { label: "护照", value: "PASSPORT" },
    { label: "港澳通行证", value: "HK_MO_PASS" }
  ],
  "md.staff.category": [
    { label: "医生", value: "DOCTOR" },
    { label: "护士", value: "NURSE" },
    { label: "管理", value: "ADMIN" },
    { label: "技师", value: "TECHNICIAN" }
  ],
  "md.staff.position": [
    { label: "主任", value: "DIRECTOR" },
    { label: "副主任", value: "DEPUTY" },
    { label: "组长", value: "LEADER" }
  ],
  "md.staff.professional_title": [
    { label: "主任医师", value: "CHIEF_PHYSICIAN" },
    { label: "主治医师", value: "ATTENDING" },
    { label: "住院医师", value: "RESIDENT" }
  ],
  "md.staff.professional_role": [
    { label: "医师", value: "PHYSICIAN" },
    { label: "护师", value: "NURSE_PRO" },
    { label: "药师", value: "PHARMACIST" }
  ],
  "md.gender_limit": [
    { label: "不限", value: "ANY" },
    { label: "仅男性", value: "MALE_ONLY" },
    { label: "仅女性", value: "FEMALE_ONLY" }
  ],
  "md.id_mapping.external_app": [
    { label: "HIS", value: "HIS" },
    { label: "LIS", value: "LIS" },
    { label: "PACS", value: "PACS" }
  ],
  "md.organization.type": [
    { label: "综合医院", value: "GENERAL" },
    { label: "专科医院", value: "SPECIALTY" },
    { label: "社区卫生", value: "COMMUNITY" }
  ],
  "md.organization.hospital_level": [
    { label: "三级甲等", value: "TIER_3A" },
    { label: "三级乙等", value: "TIER_3B" },
    { label: "二级甲等", value: "TIER_2A" }
  ],
  "md.department.level": [
    { label: "一级", value: "L1" },
    { label: "二级", value: "L2" },
    { label: "三级", value: "L3" }
  ],
  "md.department.type": [
    { label: "门诊", value: "OUTPATIENT" },
    { label: "住院", value: "INPATIENT" },
    { label: "急诊", value: "EMERGENCY" }
  ],
  "md.district.level": [
    { label: "省", value: "1" },
    { label: "市", value: "2" },
    { label: "县/区", value: "3" },
    { label: "镇/街", value: "4" },
    { label: "村/居", value: "5" }
  ],
  "sys.config_definition.category": [
    { label: "系统", value: "SYSTEM" },
    { label: "业务", value: "BUSINESS" },
    { label: "界面", value: "UI" }
  ],
  "sys.config_definition.value_type": [
    { label: "字符串", value: "STRING" },
    { label: "数字", value: "NUMBER" },
    { label: "布尔", value: "BOOLEAN" },
    { label: "JSON", value: "JSON" }
  ],
  "sys.data_source.type": [
    { label: "MySQL", value: "MYSQL" },
    { label: "PostgreSQL", value: "POSTGRES" },
    { label: "SQLServer", value: "MSSQL" }
  ],
  "sys.menu.type": [
    { label: "目录", value: "D" },
    { label: "菜单", value: "M" },
    { label: "视图", value: "V" },
    { label: "权限", value: "P" },
    { label: "报表", value: "R" }
  ],
  "sys.serial_no_rule.date_format": [
    { label: "YYYY", value: "YYYY" },
    { label: "YYYYMM", value: "YYYYMM" },
    { label: "YYYYMMDD", value: "YYYYMMDD" }
  ],
  "sys.serial_no_rule.reset_cycle": [
    { label: "永不重置", value: "NEVER" },
    { label: "每日重置", value: "DAILY" },
    { label: "每月重置", value: "MONTHLY" },
    { label: "每年重置", value: "YEARLY" }
  ]
};

defineMock<{ keys: string[] }, Record<string, DataOption[]>>(
  "sys/dictionary_item",
  "find_items",
  ({ params }) => Object.fromEntries(
    params.keys.map(key => [key, DICTIONARY_ITEMS[key] ?? []])
  )
);

// Helper to expose the seeded dictionary type registry for FK resolution
// from other mock modules.
export function dictionaryTypeIdByKey(key: string): string | undefined {
  return DICTIONARY_TYPES.find(d => d.key === key)?.id;
}

export { DICTIONARY_TYPES };

// Silence unused-import warnings — the tree helpers are re-exported so
// consumers can compose them if needed.
void faker;
void flattenTree;
void nestTree;
