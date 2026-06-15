import type { AppItem } from "@vef-framework-react/starter";

/**
 * Mocked application registry. A real project fetches the apps the
 * authenticated user can access (e.g. on login) as plain JSON — note `icon` is
 * a `DynamicIcon` name, never a node, so the list survives the API round-trip.
 * Shared by the select-app page and the in-shell app switcher.
 */
export const APPS: AppItem[] = [
  {
    id: "admin",
    name: "Admin",
    description: "系统管理后台",
    icon: "layout-dashboard"
  },
  {
    id: "ops",
    name: "Ops",
    description: "运维监控平台",
    icon: "server-cog"
  },
  {
    id: "his",
    name: "HIS 医院信息",
    description: "门诊住院一体化",
    icon: "heart-pulse"
  },
  {
    id: "lis",
    name: "LIS 检验",
    description: "实验室信息系统",
    icon: "microscope"
  },
  {
    id: "pharmacy",
    name: "药品管理",
    description: "药房与库存",
    icon: "pill"
  },
  {
    id: "clinic",
    name: "门诊工作站",
    description: "医生工作站",
    icon: "stethoscope"
  },
  {
    id: "finance",
    name: "财务结算",
    description: "收费与结算",
    icon: "wallet"
  },
  {
    id: "hr",
    name: "人力资源",
    description: "员工与排班",
    icon: "briefcase"
  },
  {
    id: "assets",
    name: "资产管理",
    description: "设备与耗材",
    icon: "building-2"
  },
  {
    id: "training",
    name: "教学科研",
    description: "培训与课题",
    icon: "graduation-cap"
  },
  {
    id: "report",
    name: "运营分析",
    description: "运营数据大盘",
    icon: "activity"
  }
];
