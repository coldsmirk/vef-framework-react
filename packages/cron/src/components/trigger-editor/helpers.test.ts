import type { TriggerFields } from "./helpers";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRIGGER,
  formatTriggerSummary,
  isTriggerComplete,
  triggerFormToParams,
  triggerToFormValues
} from "./helpers";

function fields(overrides: Partial<TriggerFields>): TriggerFields {
  return {
    kind: "cron",
    expr: "",
    timezone: "",
    everyMs: 0,
    fireAt: undefined,
    ...overrides
  };
}

describe("trigger helpers", () => {
  describe("triggerToFormValues", () => {
    it("splits everyMs into a value+unit for an interval schedule", () => {
      const values = triggerToFormValues(fields({ kind: "interval", everyMs: 300_000 }));

      expect(values.intervalValue, "300000ms is 5 minutes").toBe(5);
      expect(values.intervalUnit, "unit is minute").toBe("minute");
    });

    it("uses the default interval when everyMs is zero", () => {
      const values = triggerToFormValues(fields({ kind: "cron", expr: "0 9 * * *" }));

      expect(values.intervalValue, "falls back to default value").toBe(DEFAULT_TRIGGER.intervalValue);
      expect(values.intervalUnit, "falls back to default unit").toBe(DEFAULT_TRIGGER.intervalUnit);
    });

    it("carries the once fire time into `at`", () => {
      const values = triggerToFormValues(fields({ kind: "once", fireAt: "2026-07-20 09:00:00" }));

      expect(values.at, "fireAt becomes at").toBe("2026-07-20 09:00:00");
    });
  });

  describe("triggerFormToParams", () => {
    it("trims the cron expression and omits a blank timezone", () => {
      const params = triggerFormToParams({
        ...DEFAULT_TRIGGER,
        kind: "cron",
        expr: "  0 9 * * *  ",
        timezone: ""
      });

      expect(params, "cron params keep only the trimmed expression").toEqual({
        kind: "cron",
        expr: "0 9 * * *",
        timezone: undefined
      });
    });

    it("keeps a non-blank timezone for cron", () => {
      const params = triggerFormToParams({
        ...DEFAULT_TRIGGER,
        kind: "cron",
        expr: "@daily",
        timezone: "Asia/Shanghai"
      });

      expect(params.timezone, "timezone is preserved").toBe("Asia/Shanghai");
    });

    it("converts an interval value+unit into everyMs", () => {
      const params = triggerFormToParams({
        ...DEFAULT_TRIGGER,
        kind: "interval",
        intervalValue: 2,
        intervalUnit: "hour"
      });

      expect(params, "interval params carry everyMs only").toEqual({ kind: "interval", everyMs: 7_200_000 });
    });

    it("passes the once time through as `at`", () => {
      const params = triggerFormToParams({
        ...DEFAULT_TRIGGER,
        kind: "once",
        at: "2026-07-20 09:00:00"
      });

      expect(params, "once params carry at only").toEqual({ kind: "once", at: "2026-07-20 09:00:00" });
    });
  });

  describe("isTriggerComplete", () => {
    it("requires a non-blank cron expression", () => {
      expect(isTriggerComplete({
        ...DEFAULT_TRIGGER,
        kind: "cron",
        expr: " ".repeat(3)
      }), "blank cron is incomplete").toBe(false);
      expect(isTriggerComplete({
        ...DEFAULT_TRIGGER,
        kind: "cron",
        expr: "@daily"
      }), "filled cron is complete").toBe(true);
    });

    it("requires the interval to reach the 1000ms floor", () => {
      const shortUnit = {
        ...DEFAULT_TRIGGER,
        kind: "interval" as const,
        intervalValue: 1,
        intervalUnit: "second"
      };

      expect(isTriggerComplete(shortUnit), "1 second meets the floor").toBe(true);
    });

    it("requires a chosen once time", () => {
      expect(isTriggerComplete({
        ...DEFAULT_TRIGGER,
        kind: "once",
        at: ""
      }), "no time is incomplete").toBe(false);
      expect(isTriggerComplete({
        ...DEFAULT_TRIGGER,
        kind: "once",
        at: "2026-07-20 09:00:00"
      }), "a time is complete").toBe(true);
    });
  });

  describe("formatTriggerSummary", () => {
    it("shows the cron expression with its timezone", () => {
      const summary = formatTriggerSummary(fields({
        kind: "cron",
        expr: "0 9 * * *",
        timezone: "Asia/Shanghai"
      }));

      expect(summary, "cron summary includes the timezone").toBe("0 9 * * *（Asia/Shanghai）");
    });

    it("shows a bare cron expression when there is no timezone", () => {
      const summary = formatTriggerSummary(fields({ kind: "cron", expr: "@daily" }));

      expect(summary, "cron summary is just the expression").toBe("@daily");
    });

    it("humanizes an interval rate", () => {
      const summary = formatTriggerSummary(fields({ kind: "interval", everyMs: 60_000 }));

      expect(summary, "interval summary reads as a rate").toBe("每 1 分钟");
    });

    it("shows the single fire time for a once schedule", () => {
      const summary = formatTriggerSummary(fields({ kind: "once", fireAt: "2026-07-20 09:00:00" }));

      expect(summary, "once summary carries the fire time").toBe("单次 · 2026-07-20 09:00:00");
    });
  });
});
