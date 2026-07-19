import type { Schedule } from "../../types";
import type { ScheduleFormValues } from "./model";

import { describe, expect, it } from "vitest";

import { jsonParamsError, parseJsonParams, SCHEDULE_FORM_DEFAULTS, scheduleToFormValues, scheduleToParams } from "./model";

const SAMPLE_ROW: Schedule = {
  id: "sched-1",
  name: "nightly-sync",
  jobName: "sync-job",
  kind: "interval",
  expr: "",
  timezone: "",
  everyMs: 300_000,
  misfirePolicy: "skip",
  concurrencyPolicy: "allow",
  recover: true,
  timeoutMs: 30_000,
  isEnabled: true
};

describe("schedule model", () => {
  describe("parseJsonParams", () => {
    it("treats empty text as no params", () => {
      expect(parseJsonParams(" ".repeat(3)), "blank omits params").toEqual({ ok: true, value: undefined });
    });

    it("parses a JSON object", () => {
      expect(parseJsonParams("{\"a\":1}"), "object is accepted").toEqual({ ok: true, value: { a: 1 } });
    });

    it("rejects malformed JSON", () => {
      const result = parseJsonParams("{not json}");

      expect(result.ok, "malformed JSON fails").toBe(false);
    });

    it("rejects a non-object JSON value", () => {
      const result = parseJsonParams("[1,2,3]");

      expect(result.ok, "an array is not an object").toBe(false);
    });
  });

  describe("jsonParamsError", () => {
    it("returns undefined for valid params", () => {
      expect(jsonParamsError("{\"a\":1}"), "valid params have no error").toBeUndefined();
    });

    it("returns a message for invalid params", () => {
      expect(jsonParamsError("[1]"), "invalid params report an error").toBe("任务参数必须是 JSON 对象");
    });
  });

  describe("scheduleToFormValues", () => {
    it("captures the addressing name and splits the timeout", () => {
      const values = scheduleToFormValues(SAMPLE_ROW);

      expect(values.originalName, "originalName is the row name").toBe("nightly-sync");
      expect(values.timeoutValue, "30000ms is 30 seconds").toBe(30);
      expect(values.timeoutUnit, "timeout unit is second").toBe("second");
      expect(values.trigger.intervalValue, "300000ms is 5 minutes").toBe(5);
    });

    it("serializes params to pretty JSON text", () => {
      const values = scheduleToFormValues({ ...SAMPLE_ROW, params: { retries: 3 } });

      expect(values.paramsText, "params become JSON text").toBe(JSON.stringify({ retries: 3 }, null, 2));
    });

    it("defaults the timeout unit to seconds when timeout is zero", () => {
      const values = scheduleToFormValues({ ...SAMPLE_ROW, timeoutMs: 0 });

      expect(values.timeoutValue, "zero timeout value").toBe(0);
      expect(values.timeoutUnit, "zero timeout still shows seconds").toBe("second");
    });
  });

  describe("scheduleToParams", () => {
    it("addresses by name without a rename when unchanged", () => {
      const params = scheduleToParams({ ...scheduleToFormValues(SAMPLE_ROW) });

      expect(params.name, "addresses by the original name").toBe("nightly-sync");
      expect(params.newName, "no rename when unchanged").toBeUndefined();
    });

    it("sends newName when the name changed on an edit", () => {
      const params = scheduleToParams({ ...scheduleToFormValues(SAMPLE_ROW), name: "renamed" });

      expect(params.name, "addresses by the original name").toBe("nightly-sync");
      expect(params.newName, "renames via newName").toBe("renamed");
    });

    it("has no newName on create (no original name)", () => {
      const params = scheduleToParams({
        ...SCHEDULE_FORM_DEFAULTS,
        name: "fresh",
        jobName: "job"
      });

      expect(params.name, "uses the entered name").toBe("fresh");
      expect(params.newName, "create never renames").toBeUndefined();
    });

    it("collapses the interval trigger to everyMs", () => {
      const values: ScheduleFormValues = {
        ...SCHEDULE_FORM_DEFAULTS,
        name: "job",
        jobName: "job",
        trigger: {
          ...SCHEDULE_FORM_DEFAULTS.trigger,
          kind: "interval",
          intervalValue: 10,
          intervalUnit: "second"
        }
      };

      expect(scheduleToParams(values).trigger, "interval trigger carries everyMs").toEqual({ kind: "interval", everyMs: 10_000 });
    });

    it("converts the timeout value+unit back to milliseconds", () => {
      const params = scheduleToParams({
        ...SCHEDULE_FORM_DEFAULTS,
        name: "job",
        jobName: "job",
        timeoutValue: 2,
        timeoutUnit: "minute"
      });

      expect(params.timeoutMs, "2 minutes is 120000ms").toBe(120_000);
    });

    it("omits params for empty text and parses them otherwise", () => {
      const empty = scheduleToParams({
        ...SCHEDULE_FORM_DEFAULTS,
        name: "job",
        jobName: "job",
        paramsText: ""
      });
      const filled = scheduleToParams({
        ...SCHEDULE_FORM_DEFAULTS,
        name: "job",
        jobName: "job",
        paramsText: "{\"a\":1}"
      });

      expect(empty.params, "empty params are omitted").toBeUndefined();
      expect(filled.params, "filled params are parsed").toEqual({ a: 1 });
    });

    it("normalizes blank effective-window bounds to undefined", () => {
      const params = scheduleToParams({
        ...SCHEDULE_FORM_DEFAULTS,
        name: "job",
        jobName: "job",
        startsAt: "",
        endsAt: ""
      });

      expect(params.startsAt, "blank startsAt is omitted").toBeUndefined();
      expect(params.endsAt, "blank endsAt is omitted").toBeUndefined();
    });
  });
});
