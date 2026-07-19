import type { ConcurrencyPolicy, MisfirePolicy, RunStatus, TriggerKind } from "../../types";

import { CONCURRENCY_POLICIES, MISFIRE_POLICIES, RUN_STATUSES, TRIGGER_KINDS } from "../../types";

/**
 * Display labels for the shared vocabularies, one place so every view agrees.
 */

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  missed: "错过",
  skipped: "跳过",
  abandoned: "已放弃",
  canceled: "已取消"
};

export const RUN_STATUS_OPTIONS: Array<{ label: string; value: RunStatus }> = RUN_STATUSES.map(status => {
  return { label: RUN_STATUS_LABELS[status], value: status };
});

export const TRIGGER_KIND_LABELS: Record<TriggerKind, string> = {
  cron: "Cron 表达式",
  interval: "固定间隔",
  once: "单次"
};

export const TRIGGER_KIND_OPTIONS: Array<{ label: string; value: TriggerKind }> = TRIGGER_KINDS.map(kind => {
  return { label: TRIGGER_KIND_LABELS[kind], value: kind };
});

export const MISFIRE_POLICY_LABELS: Record<MisfirePolicy, string> = {
  fire_now: "立即补跑",
  skip: "跳过错过"
};

export const MISFIRE_POLICY_OPTIONS: Array<{ label: string; value: MisfirePolicy }> = MISFIRE_POLICIES.map(policy => {
  return { label: MISFIRE_POLICY_LABELS[policy], value: policy };
});

export const CONCURRENCY_POLICY_LABELS: Record<ConcurrencyPolicy, string> = {
  forbid: "禁止并发",
  allow: "允许并发"
};

export const CONCURRENCY_POLICY_OPTIONS: Array<{ label: string; value: ConcurrencyPolicy }> = CONCURRENCY_POLICIES.map(policy => {
  return { label: CONCURRENCY_POLICY_LABELS[policy], value: policy };
});
