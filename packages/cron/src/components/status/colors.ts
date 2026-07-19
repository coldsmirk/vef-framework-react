import type { RunStatus } from "../../types";

/**
 * Run-status colors, expressed as antd Tag color tokens so they resolve through
 * the framework theme (and flip with the dark algorithm) with no hardcoding.
 */
export const RUN_STATUS_COLORS: Record<RunStatus, string> = {
  running: "processing",
  succeeded: "success",
  failed: "error",
  missed: "orange",
  skipped: "default",
  abandoned: "volcano",
  canceled: "default"
};
