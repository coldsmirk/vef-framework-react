import { createTreeMock } from "../helpers/tree";

interface OrganizationRow {
  id: string;
  parentId?: string | null;
  type: string;
  code: string;
  name: string;
  shortName: string;
  introduction?: string | null;
  logo?: string | null;
  hospitalLevel?: string | null;
  isActive: boolean;
  sortOrder: number;
  remark?: string | null;
}

const seeds: OrganizationRow[] = [
  {
    id: "org-root",
    parentId: null,
    type: "GENERAL",
    code: "ORG-001",
    name: "演示集团总部",
    shortName: "总部",
    hospitalLevel: "TIER_3A",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "org-east",
    parentId: "org-root",
    type: "GENERAL",
    code: "ORG-002",
    name: "东区分院",
    shortName: "东区",
    hospitalLevel: "TIER_3B",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "org-west",
    parentId: "org-root",
    type: "GENERAL",
    code: "ORG-003",
    name: "西区分院",
    shortName: "西区",
    hospitalLevel: "TIER_3B",
    isActive: true,
    sortOrder: 2
  },
  {
    id: "org-south",
    parentId: "org-root",
    type: "SPECIALTY",
    code: "ORG-004",
    name: "南区专科",
    shortName: "南区",
    hospitalLevel: "TIER_2A",
    isActive: true,
    sortOrder: 3
  },
  {
    id: "org-community",
    parentId: "org-west",
    type: "COMMUNITY",
    code: "ORG-005",
    name: "社区门诊",
    shortName: "社区",
    hospitalLevel: null,
    isActive: true,
    sortOrder: 1
  }
];

createTreeMock<OrganizationRow>({
  resource: "md/organization",
  seed: seeds.length,
  searchField: "name",
  factory: i => seeds[i]!
});
