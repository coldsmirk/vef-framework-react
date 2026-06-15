import { describe, expect, it } from "vitest";

import { formatBytes } from "..";

describe("utils/format", () => {
  describe("formatBytes", () => {
    describe("basic conversions", () => {
      it("formats 0 bytes", () => {
        const result = formatBytes(0);

        expect(result).toBe("0 B");
      });

      it("formats bytes (B)", () => {
        const result = formatBytes(500);

        expect(result).toBe("500 B");
      });

      it("formats kilobytes (KB)", () => {
        const result = formatBytes(1024);

        expect(result).toBe("1 KB");
      });

      it("formats megabytes (MB)", () => {
        const result = formatBytes(1_048_576);

        expect(result).toBe("1 MB");
      });

      it("formats gigabytes (GB)", () => {
        const result = formatBytes(1_073_741_824);

        expect(result).toBe("1 GB");
      });

      it("formats terabytes (TB)", () => {
        const result = formatBytes(1_099_511_627_776);

        expect(result).toBe("1 TB");
      });

      it("formats petabytes (PB)", () => {
        const result = formatBytes(1_125_899_906_842_624);

        expect(result).toBe("1 PB");
      });
    });

    describe("decimal precision", () => {
      it("formats with default 2 decimal places", () => {
        const result = formatBytes(1536);

        expect(result).toBe("1.5 KB");
      });

      it("formats with 0 decimal places", () => {
        const result = formatBytes(1536, 0);

        expect(result).toBe("2 KB");
      });

      it("formats with 1 decimal place", () => {
        const result = formatBytes(1536, 1);

        expect(result).toBe("1.5 KB");
      });

      it("formats with 3 decimal places", () => {
        const result = formatBytes(1_234_567, 3);

        expect(result).toBe("1.177 MB");
      });

      it("handles negative decimal parameter (treated as 0)", () => {
        const result = formatBytes(1536, -1);

        expect(result).toBe("2 KB");
      });
    });

    describe("fractional values", () => {
      it("handles fractional kilobytes", () => {
        const result = formatBytes(2048);

        expect(result).toBe("2 KB");
      });

      it("handles fractional megabytes", () => {
        const result = formatBytes(1_572_864);

        expect(result).toBe("1.5 MB");
      });

      it("handles fractional gigabytes", () => {
        const result = formatBytes(5_368_709_120);

        expect(result).toBe("5 GB");
      });

      it("rounds properly", () => {
        const result = formatBytes(1126, 2);

        expect(result).toBe("1.1 KB");
      });
    });

    describe("edge cases", () => {
      it("handles very small non-zero values", () => {
        const result = formatBytes(1);

        expect(result).toBe("1 B");
      });

      it("handles very large values", () => {
        const result = formatBytes(Number.MAX_SAFE_INTEGER);

        // MAX_SAFE_INTEGER is approximately 8 PB
        expect(result).toContain("PB");
      });

      it("handles values just below unit boundary", () => {
        const result = formatBytes(1023);

        expect(result).toBe("1023 B");
      });

      it("handles values just above unit boundary", () => {
        const result = formatBytes(1025);

        expect(result).toBe("1 KB");
      });

      it("handles exact power of 1024", () => {
        const result = formatBytes(1024 ** 3);

        expect(result).toBe("1 GB");
      });
    });

    describe("real-world scenarios", () => {
      it("formats file size (small file)", () => {
        const result = formatBytes(4096);

        expect(result).toBe("4 KB");
      });

      it("formats file size (document)", () => {
        const result = formatBytes(524_288);

        expect(result).toBe("512 KB");
      });

      it("formats file size (image)", () => {
        const result = formatBytes(2_097_152);

        expect(result).toBe("2 MB");
      });

      it("formats file size (video)", () => {
        const result = formatBytes(1_610_612_736);

        expect(result).toBe("1.5 GB");
      });

      it("formats disk space", () => {
        const result = formatBytes(500_107_862_016, 1);

        expect(result).toBe("465.8 GB");
      });

      it("formats database size", () => {
        const result = formatBytes(5_497_558_138_880);

        expect(result).toBe("5 TB");
      });
    });

    describe("precision edge cases", () => {
      it("truncates trailing zeros", () => {
        const result = formatBytes(1_024_000, 2);

        expect(result).toBe("1000 KB");
      });

      it("handles very high precision", () => {
        const result = formatBytes(1234, 10);

        expect(result).toBe("1.205078125 KB");
      });

      it("handles exact divisions", () => {
        const result = formatBytes(1024 * 3);

        expect(result).toBe("3 KB");
      });
    });
  });
});
