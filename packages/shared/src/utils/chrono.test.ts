import type { Dayjs } from "..";

import { describe, expect, it } from "vitest";

import {
  formatDate,
  getTemporalFormats,
  parseDate,
  tryParseDate,
  tryParseTime

} from "..";

describe("utils/chrono", () => {
  describe("tryParseDate", () => {
    describe("datetime formats", () => {
      it("parses YYYY-MM-DD HH:mm:ss format", () => {
        const result = tryParseDate("2025-11-10 16:30:45");

        expect(result).not.toBeNull();
        expect(result?.year()).toBe(2025);
        // month is 0-indexed
        expect(result?.month()).toBe(10);
        expect(result?.date()).toBe(10);
        expect(result?.hour()).toBe(16);
        expect(result?.minute()).toBe(30);
        expect(result?.second()).toBe(45);
      });

      it("parses YYYY/MM/DD HH:mm:ss format", () => {
        const result = tryParseDate("2025/11/10 16:30:45");

        expect(result).not.toBeNull();
        expect(result?.format("YYYY-MM-DD HH:mm:ss")).toBe("2025-11-10 16:30:45");
      });

      it("parses YYYY.MM.DD HH.mm.ss format", () => {
        const result = tryParseDate("2025.11.10 16.30.45");

        expect(result).not.toBeNull();

        if (result) {
          // Year, month, and day should be correct
          expect(result.year()).toBe(2025);
          expect(result.month()).toBe(10);
          expect(result.date()).toBe(10);
        }
      });

      it("parses YYYYMMDDHHmmss format (compact)", () => {
        const result = tryParseDate("20251110163045");

        expect(result).not.toBeNull();
        expect(result?.format("YYYY-MM-DD HH:mm:ss")).toBe("2025-11-10 16:30:45");
      });
    });

    describe("date formats", () => {
      it("parses YYYY-MM-DD format", () => {
        const result = tryParseDate("2025-11-10");

        expect(result).not.toBeNull();
        expect(result?.year()).toBe(2025);
        expect(result?.month()).toBe(10);
        expect(result?.date()).toBe(10);
      });

      it("parses YYYY/MM/DD format", () => {
        const result = tryParseDate("2025/11/10");

        expect(result).not.toBeNull();
        expect(result?.format("YYYY-MM-DD")).toBe("2025-11-10");
      });

      it("parses YYYY.MM.DD format", () => {
        const result = tryParseDate("2025.11.10");

        expect(result).not.toBeNull();
        expect(result?.format("YYYY-MM-DD")).toBe("2025-11-10");
      });

      it("parses YYYYMMDD format (compact)", () => {
        const result = tryParseDate("20251110");

        expect(result).not.toBeNull();
        expect(result?.format("YYYY-MM-DD")).toBe("2025-11-10");
      });
    });

    describe("fallback parsing", () => {
      it("parses ISO 8601 format using default parser", () => {
        const result = tryParseDate("2025-11-10T16:30:45.000Z");

        expect(result).not.toBeNull();
        expect(result?.isValid()).toBe(true);
      });

      it("parses human-readable dates using default parser", () => {
        const result = tryParseDate("Nov 10, 2025");

        expect(result).not.toBeNull();
        expect(result?.isValid()).toBe(true);
      });
    });

    describe("invalid inputs", () => {
      it("returns null for invalid date strings", () => {
        const result = tryParseDate("invalid date");

        expect(result).toBeNull();
      });

      it("returns null for random text", () => {
        const result = tryParseDate("abc123xyz");

        expect(result).toBeNull();
      });

      it("returns null for empty string", () => {
        const result = tryParseDate("");

        expect(result).toBeNull();
      });

      it("returns null for malformed dates", () => {
        // Completely invalid format
        expect(tryParseDate("13-40-2025")).toBeNull();
      });
    });

    describe("edge cases", () => {
      it("handles leap year dates correctly", () => {
        const result = tryParseDate("2024-02-29");

        expect(result).not.toBeNull();
        expect(result?.format("YYYY-MM-DD")).toBe("2024-02-29");
      });

      it("handles year boundaries", () => {
        const newYear = tryParseDate("2025-01-01 00:00:00");
        const endYear = tryParseDate("2025-12-31 23:59:59");

        expect(newYear).not.toBeNull();
        expect(endYear).not.toBeNull();
        expect(newYear?.month()).toBe(0);
        expect(endYear?.month()).toBe(11);
      });
    });
  });

  describe("tryParseTime", () => {
    describe("time formats", () => {
      it("parses HH:mm:ss format", () => {
        const result = tryParseTime("08:08:00");

        expect(result).not.toBeNull();
        expect(result?.hour()).toBe(8);
        expect(result?.minute()).toBe(8);
        expect(result?.second()).toBe(0);
      });

      it("parses HH.mm.ss format", () => {
        const result = tryParseTime("16.30.45");

        expect(result).not.toBeNull();
        expect(result?.hour()).toBe(16);
        expect(result?.minute()).toBe(30);
        expect(result?.second()).toBe(45);
      });

      it("parses HHmmss compact format", () => {
        const result = tryParseTime("163045");

        expect(result).not.toBeNull();
        expect(result?.hour()).toBe(16);
        expect(result?.minute()).toBe(30);
        expect(result?.second()).toBe(45);
      });
    });

    describe("minute formats", () => {
      it("parses HH:mm format", () => {
        const result = tryParseTime("08:08");

        expect(result).not.toBeNull();
        expect(result?.hour()).toBe(8);
        expect(result?.minute()).toBe(8);
        expect(result?.second()).toBe(0);
      });

      it("parses HHmm compact format", () => {
        const result = tryParseTime("0808");

        expect(result).not.toBeNull();
        expect(result?.hour()).toBe(8);
        expect(result?.minute()).toBe(8);
      });
    });

    describe("hour formats", () => {
      it("parses HH format", () => {
        const result = tryParseTime("08");

        expect(result).not.toBeNull();
        expect(result?.hour()).toBe(8);
      });
    });

    describe("invalid inputs", () => {
      it("returns null for empty string", () => {
        expect(tryParseTime("")).toBeNull();
      });

      it("returns null for out-of-range time", () => {
        expect(tryParseTime("25:00:00")).toBeNull();
      });

      it("returns null for non-time text", () => {
        expect(tryParseTime("not a time")).toBeNull();
      });

      it("returns null for date-shaped strings", () => {
        expect(tryParseTime("2025-11-10")).toBeNull();
      });

      it("does not fall back to dayjs default parser", () => {
        expect(tryParseTime("2025-11-10T16:30:45.000Z")).toBeNull();
      });
    });
  });

  describe("parseDate", () => {
    describe("default behavior (no format)", () => {
      it("parses YYYY-MM-DD HH:mm:ss", () => {
        const result = parseDate("2025-11-10 16:30:45");

        expect(result.isValid()).toBe(true);
        expect(result.format("YYYY-MM-DD HH:mm:ss")).toBe("2025-11-10 16:30:45");
      });

      it("parses YYYY-MM-DD (date-only)", () => {
        const result = parseDate("2025-11-10");

        expect(result.isValid()).toBe(true);
        expect(result.format("YYYY-MM-DD")).toBe("2025-11-10");
        expect(result.hour()).toBe(0);
        expect(result.minute()).toBe(0);
        expect(result.second()).toBe(0);
      });

      it("parses ISO 8601 with T separator", () => {
        const result = parseDate("2025-11-10T16:30:45");

        expect(result.isValid()).toBe(true);
        expect(result.format("YYYY-MM-DD HH:mm:ss")).toBe("2025-11-10 16:30:45");
      });

      it("parses ISO 8601 with Z timezone", () => {
        const result = parseDate("2025-11-10T16:30:45.000Z");

        expect(result.isValid()).toBe(true);
      });

      it("parses YYYY/MM/DD with slash separator", () => {
        const result = parseDate("2025/11/10");

        expect(result.isValid()).toBe(true);
        expect(result.format("YYYY-MM-DD")).toBe("2025-11-10");
      });
    });

    describe("explicit format", () => {
      it("parses with custom format DD/MM/YYYY", () => {
        const result = parseDate("15/03/2025", "DD/MM/YYYY");

        expect(result.isValid()).toBe(true);
        expect(result.date()).toBe(15);
        // March (0-indexed)
        expect(result.month()).toBe(2);
        expect(result.year()).toBe(2025);
      });

      it("parses compact YYYYMMDD with explicit format", () => {
        const result = parseDate("20251110", "YYYYMMDD");

        expect(result.isValid()).toBe(true);
        expect(result.format("YYYY-MM-DD")).toBe("2025-11-10");
      });

      it("parses with dot separator YYYY.MM.DD", () => {
        const result = parseDate("2025.11.10", "YYYY.MM.DD");

        expect(result.isValid()).toBe(true);
        expect(result.format("YYYY-MM-DD")).toBe("2025-11-10");
      });

      it("parses time-only string with explicit format", () => {
        const result = parseDate("16:30:45", "HH:mm:ss");

        expect(result.isValid()).toBe(true);
        expect(result.hour()).toBe(16);
        expect(result.minute()).toBe(30);
        expect(result.second()).toBe(45);
      });
    });

    describe("Date object input", () => {
      it("parses Date object preserving full timestamp", () => {
        const dateObj = new Date(2025, 10, 10, 16, 30, 45);
        const result = parseDate(dateObj);

        expect(result.isValid()).toBe(true);
        expect(result.year()).toBe(2025);
        // November (0-indexed)
        expect(result.month()).toBe(10);
        expect(result.date()).toBe(10);
        expect(result.hour()).toBe(16);
        expect(result.minute()).toBe(30);
        expect(result.second()).toBe(45);
      });

      it("ignores format parameter when input is a Date object", () => {
        const dateObj = new Date(2025, 0, 1);
        const result = parseDate(dateObj, "YYYYMMDD");

        expect(result.isValid()).toBe(true);
        expect(result.year()).toBe(2025);
        expect(result.month()).toBe(0);
        expect(result.date()).toBe(1);
      });
    });

    describe("edge cases", () => {
      it("handles leap year date", () => {
        const result = parseDate("2024-02-29");

        expect(result.isValid()).toBe(true);
        expect(result.format("YYYY-MM-DD")).toBe("2024-02-29");
      });

      it("handles year boundary", () => {
        const newYear = parseDate("2025-01-01");
        const endYear = parseDate("2025-12-31");

        expect(newYear.isValid()).toBe(true);
        expect(endYear.isValid()).toBe(true);
        expect(newYear.month()).toBe(0);
        expect(endYear.month()).toBe(11);
      });

      it("returns invalid Dayjs for empty string", () => {
        const result = parseDate("");

        expect(result.isValid()).toBe(false);
      });

      it("returns invalid Dayjs for non-date string", () => {
        const result = parseDate("not-a-date");

        expect(result.isValid()).toBe(false);
      });
    });
  });

  describe("formatDate", () => {
    let testDate: Dayjs;

    beforeEach(() => {
      testDate = parseDate("2025-11-10 16:30:45");
    });

    it("formats with default format (YYYY-MM-DD HH:mm:ss)", () => {
      const result = formatDate(testDate);

      expect(result).toBe("2025-11-10 16:30:45");
    });

    it("formats with custom date format", () => {
      const result = formatDate(testDate, "YYYY-MM-DD");

      expect(result).toBe("2025-11-10");
    });

    it("formats with custom time format", () => {
      const result = formatDate(testDate, "HH:mm:ss");

      expect(result).toBe("16:30:45");
    });

    it("formats with slash separators", () => {
      const result = formatDate(testDate, "YYYY/MM/DD");

      expect(result).toBe("2025/11/10");
    });

    it("formats with dot separators", () => {
      const result = formatDate(testDate, "YYYY.MM.DD HH.mm.ss");

      expect(result).toBe("2025.11.10 16.30.45");
    });

    it("formats with compact format", () => {
      const result = formatDate(testDate, "YYYYMMDDHHmmss");

      expect(result).toBe("20251110163045");
    });

    it("formats with localized format", () => {
      const result = formatDate(testDate, "LLLL");

      // Should contain year in localized format
      expect(result).toContain("2025");
    });

    it("handles 2-digit year format", () => {
      const result = formatDate(testDate, "YY-MM-DD");

      expect(result).toBe("25-11-10");
    });
  });

  describe("getTemporalFormats", () => {
    it("returns year formats", () => {
      const formats = getTemporalFormats("year");

      expect(formats).toEqual(["YYYY"]);
    });

    it("returns quarter formats", () => {
      const formats = getTemporalFormats("quarter");

      expect(formats).toEqual(["YYYY-Q季度"]);
    });

    it("returns month formats", () => {
      const formats = getTemporalFormats("month");

      expect(formats).toContain("YYYY-MM");
      expect(formats).toContain("YYYY/MM");
      expect(formats).toContain("YYYY.MM");
      expect(formats).toContain("YYYYMM");
      expect(formats.length).toBe(4);
    });

    it("returns week formats", () => {
      const formats = getTemporalFormats("week");

      expect(formats).toEqual(["YYYY-wo"]);
    });

    it("returns date formats", () => {
      const formats = getTemporalFormats("date");

      expect(formats).toContain("YYYY-MM-DD");
      expect(formats).toContain("YYYY/MM/DD");
      expect(formats).toContain("YYYY.MM.DD");
      expect(formats).toContain("YYYYMMDD");
      expect(formats).toContain("YY/MM/DD");
      expect(formats).toContain("YY.MM.DD");
      expect(formats).toContain("YYMMDD");
      expect(formats.length).toBe(7);
    });

    it("returns time formats", () => {
      const formats = getTemporalFormats("time");

      expect(formats).toContain("HH:mm:ss");
      expect(formats).toContain("HH.mm.ss");
      expect(formats).toContain("HHmmss");
      expect(formats.length).toBe(3);
    });

    it("returns hour formats", () => {
      const formats = getTemporalFormats("hour");

      expect(formats).toEqual(["HH"]);
    });

    it("returns minute formats", () => {
      const formats = getTemporalFormats("minute");

      expect(formats).toContain("HH:mm");
      expect(formats).toContain("HH.mm");
      expect(formats).toContain("HHmm");
      expect(formats.length).toBe(3);
    });

    it("returns datetime formats", () => {
      const formats = getTemporalFormats("datetime");

      expect(formats).toContain("YYYY-MM-DD HH:mm:ss");
      expect(formats).toContain("YYYY/MM/DD HH:mm:ss");
      expect(formats).toContain("YYYY.MM.DD HH.mm.ss");
      expect(formats).toContain("YYYYMMDDHHmmss");
      expect(formats).toContain("YY/MM/DD HH:mm:ss");
      expect(formats).toContain("YY.MM.DD HH:mm:ss");
      expect(formats).toContain("YY.MM.DD HH.mm.ss");
      expect(formats).toContain("YYMMDDHHmmss");
      expect(formats.length).toBe(8);
    });

    it("returns readonly arrays", () => {
      const formats = getTemporalFormats("date");

      // TypeScript will enforce this at compile time
      // At runtime, we can check that it's an array
      expect(Array.isArray(formats)).toBe(true);
    });
  });
});
