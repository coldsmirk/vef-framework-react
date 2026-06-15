import { enrichWithDictNames } from "../helpers/dict-enrich";
import { createTreeMock } from "../helpers/tree";

interface DistrictRow {
  id: string;
  parentId?: string | null;
  code: string;
  name: string;
  shortName?: string | null;
  level: number;
  spellCode?: string | null;
  strokeCode?: string | null;
  postcode?: string | null;
  sortOrder: number;
  isActive: boolean;
  remark?: string | null;
}

const seeds: DistrictRow[] = [
  {
    id: "d-110000",
    parentId: null,
    code: "110000",
    name: "北京市",
    shortName: "京",
    level: 1,
    postcode: "100000",
    sortOrder: 1,
    isActive: true
  },
  {
    id: "d-110100",
    parentId: "d-110000",
    code: "110100",
    name: "市辖区",
    level: 2,
    sortOrder: 1,
    isActive: true
  },
  {
    id: "d-110101",
    parentId: "d-110100",
    code: "110101",
    name: "东城区",
    level: 3,
    sortOrder: 1,
    isActive: true
  },
  {
    id: "d-110102",
    parentId: "d-110100",
    code: "110102",
    name: "西城区",
    level: 3,
    sortOrder: 2,
    isActive: true
  },
  {
    id: "d-310000",
    parentId: null,
    code: "310000",
    name: "上海市",
    shortName: "沪",
    level: 1,
    postcode: "200000",
    sortOrder: 2,
    isActive: true
  },
  {
    id: "d-310100",
    parentId: "d-310000",
    code: "310100",
    name: "市辖区",
    level: 2,
    sortOrder: 1,
    isActive: true
  },
  {
    id: "d-310101",
    parentId: "d-310100",
    code: "310101",
    name: "黄浦区",
    level: 3,
    sortOrder: 1,
    isActive: true
  },
  {
    id: "d-440000",
    parentId: null,
    code: "440000",
    name: "广东省",
    shortName: "粤",
    level: 1,
    sortOrder: 3,
    isActive: true
  },
  {
    id: "d-440100",
    parentId: "d-440000",
    code: "440100",
    name: "广州市",
    level: 2,
    sortOrder: 1,
    isActive: true
  },
  {
    id: "d-440300",
    parentId: "d-440000",
    code: "440300",
    name: "深圳市",
    level: 2,
    sortOrder: 2,
    isActive: true
  }
];

createTreeMock<DistrictRow>({
  resource: "md/district",
  seed: seeds.length,
  searchField: "name",
  decorate: enrichWithDictNames({ level: "md.district.level" }),
  factory: i => seeds[i]!
});
