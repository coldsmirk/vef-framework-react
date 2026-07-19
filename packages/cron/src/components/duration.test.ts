import { describe, expect, it } from "vitest";

import { combineDurationMs, INTERVAL_UNITS, splitDurationMs, TIMEOUT_UNITS } from "./duration";

describe("duration", () => {
  describe("combineDurationMs", () => {
    it("multiplies the value by the interval unit size", () => {
      expect(combineDurationMs(5, "minute", INTERVAL_UNITS), "5 minutes is 300000ms").toBe(300_000);
    });

    it("multiplies the value by the timeout unit size", () => {
      expect(combineDurationMs(30, "second", TIMEOUT_UNITS), "30 seconds is 30000ms").toBe(30_000);
    });

    it("falls back to the smallest unit for an unknown unit", () => {
      expect(combineDurationMs(7, "fortnight", INTERVAL_UNITS), "unknown unit uses seconds").toBe(7000);
    });

    it("clamps a negative value to zero", () => {
      expect(combineDurationMs(-3, "minute", INTERVAL_UNITS), "negative clamps to 0").toBe(0);
    });

    it("rounds a fractional value before scaling", () => {
      expect(combineDurationMs(2.6, "second", INTERVAL_UNITS), "2.6 rounds to 3 seconds").toBe(3000);
    });
  });

  describe("splitDurationMs", () => {
    it("picks the coarsest interval unit that divides evenly", () => {
      expect(splitDurationMs(3_600_000, INTERVAL_UNITS), "one hour").toEqual({ value: 1, unit: "hour" });
    });

    it("stays on seconds when minutes do not divide evenly", () => {
      expect(splitDurationMs(90_000, INTERVAL_UNITS), "90s is not whole minutes").toEqual({ value: 90, unit: "second" });
    });

    it("round-trips a value+unit through combine and split", () => {
      const ms = combineDurationMs(3, "day", INTERVAL_UNITS);

      expect(splitDurationMs(ms, INTERVAL_UNITS), "3 days survives the round trip").toEqual({ value: 3, unit: "day" });
    });

    it("falls back to the smallest timeout unit for an indivisible value", () => {
      expect(splitDurationMs(1500, TIMEOUT_UNITS), "1500ms is not whole seconds").toEqual({ value: 1500, unit: "ms" });
    });

    it("maps zero to the smallest unit with a zero value", () => {
      expect(splitDurationMs(0, TIMEOUT_UNITS), "zero timeout").toEqual({ value: 0, unit: "ms" });
    });

    it("prefers minutes over seconds for whole minutes", () => {
      expect(splitDurationMs(120_000, TIMEOUT_UNITS), "120s is 2 minutes").toEqual({ value: 2, unit: "minute" });
    });
  });
});
