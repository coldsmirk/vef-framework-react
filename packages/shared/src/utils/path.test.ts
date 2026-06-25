import { describe, expect, it } from "vitest";

import {
  formatPath,
  getBaseName,
  getDirName,
  getExtName,
  getRelativePath,
  isAbsolutePath,
  joinPaths,
  normalizePath,
  parsePath,
  pathSeparator,
  resolvePath
} from "./path";

describe("shared/utils/path", () => {
  describe("getBaseName", () => {
    it("returns the file name with extension when keepExt is true (default)", () => {
      expect(getBaseName("/tmp/data/report.csv")).toBe("report.csv");
    });

    it("strips the extension when keepExt is false", () => {
      expect(getBaseName("/tmp/data/report.csv", false)).toBe("report");
    });

    it("returns the directory name for a trailing-slash-free path", () => {
      expect(getBaseName("/tmp/data")).toBe("data");
    });
  });

  describe("getExtName", () => {
    it("returns the file extension including the dot", () => {
      expect(getExtName("notes.txt")).toBe(".txt");
    });

    it("returns an empty string when the file has no extension", () => {
      expect(getExtName("README")).toBe("");
    });
  });

  describe("getDirName", () => {
    it("returns the directory portion of a path", () => {
      expect(getDirName("/tmp/data/report.csv")).toBe("/tmp/data");
    });
  });

  describe("joinPaths", () => {
    it("joins multiple segments with the path separator", () => {
      expect(joinPaths("a", "b", "c")).toBe("a/b/c");
    });

    it("collapses redundant separators", () => {
      expect(joinPaths("a/", "/b/", "/c")).toBe("a/b/c");
    });
  });

  describe("isAbsolutePath", () => {
    it("reports absolute paths as absolute", () => {
      expect(isAbsolutePath("/etc/hosts")).toBe(true);
    });

    it("reports relative paths as non-absolute", () => {
      expect(isAbsolutePath("etc/hosts")).toBe(false);
    });
  });

  describe("normalizePath", () => {
    it("collapses .. and . segments", () => {
      expect(normalizePath("/a/b/../c")).toBe("/a/c");
    });
  });

  describe("parsePath / formatPath round trip", () => {
    it("round-trips through parsePath and formatPath", () => {
      const original = "/a/b/c/file.txt";
      const parsed = parsePath(original);

      expect(formatPath(parsed)).toBe(original);
    });
  });

  describe("getRelativePath", () => {
    it("computes the relative path between two locations", () => {
      expect(getRelativePath("/a/b", "/a/c")).toBe("../c");
    });
  });

  describe("resolvePath", () => {
    it("resolves segments into a normalized path", () => {
      expect(resolvePath("/a", "b", "c")).toBe("/a/b/c");
    });
  });

  describe("pathSeparator", () => {
    it("is the forward slash on the path-browserify backend", () => {
      expect(pathSeparator).toBe("/");
    });
  });
});
