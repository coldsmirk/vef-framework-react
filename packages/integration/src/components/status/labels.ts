import type { Direction, FailureKind, RouteFindingKind } from "../../types";

import { DIRECTIONS } from "../../types";

/**
 * Display labels for the shared vocabularies, one place so every view agrees.
 */

export const DIRECTION_LABELS: Record<Direction, string> = {
  outbound: "出站",
  inbound: "入站"
};

/**
 * Select/segmented options for the two flow directions, derived from the
 * labels so every direction picker stays in lockstep.
 */
export const DIRECTION_OPTIONS: Array<{ label: string; value: Direction }> = DIRECTIONS.map(direction => {
  return { label: DIRECTION_LABELS[direction], value: direction };
});

export const FAILURE_KIND_LABELS: Record<FailureKind, string> = {
  input_invalid: "入参校验失败",
  output_invalid: "出参校验失败",
  upstream: "上游报错",
  transport: "传输失败",
  timeout: "超时",
  canceled: "已取消",
  script: "脚本错误",
  config: "配置错误",
  auth: "认证失败",
  handler: "业务处理失败"
};

export const ROUTE_FINDING_KIND_LABELS: Record<RouteFindingKind, string> = {
  dangling_adapter: "悬空适配器",
  wildcard_gap: "通配缺口",
  disabled_system: "目标系统已停用",
  disabled_contract: "目标契约已停用",
  uncovered_contract: "契约未覆盖"
};

export const OUTBOUND_AUTH_SCHEME_LABELS: Record<string, string> = {
  none: "无",
  http_basic: "HTTP Basic",
  bearer: "Bearer",
  header: "自定义 Header",
  query: "查询参数",
  signature: "签名",
  script: "脚本自定义"
};

export const INBOUND_AUTH_SCHEME_LABELS: Record<string, string> = {
  none: "无（公开）",
  ip: "IP 白名单",
  http_basic: "HTTP Basic",
  bearer: "Bearer",
  header: "自定义 Header",
  query: "查询参数",
  signature: "签名",
  script: "脚本自定义"
};
