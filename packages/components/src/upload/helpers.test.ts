import type { UploadFile } from "antd";

import type { UploadedFileMeta } from "./props";

import { isImageFile, toFilePreviewTarget } from "./helpers";

function makeFile(overrides: Partial<UploadFile> = {}): UploadFile {
  return {
    uid: "-1",
    name: "file.bin",
    ...overrides
  };
}

describe("upload/helpers", () => {
  describe("isImageFile", () => {
    it("detects an image by MIME type", () => {
      expect(isImageFile(makeFile({ type: "image/png", name: "photo" }))).toBe(true);
    });

    it("rejects a non-image MIME type", () => {
      expect(isImageFile(makeFile({ type: "application/pdf", name: "doc.pdf" }))).toBe(false);
    });

    it("detects an image by URL extension ignoring case and query string", () => {
      expect(isImageFile(makeFile({ url: "https://files.test/pic.PNG?v=1" }))).toBe(true);
    });

    it("detects an image by filename extension when no URL is present", () => {
      expect(isImageFile(makeFile({ name: "avatar.webp" }))).toBe(true);
    });

    it("rejects a non-image extension", () => {
      expect(isImageFile(makeFile({ name: "report.docx" }))).toBe(false);
    });

    it("detects an image data URL", () => {
      expect(isImageFile(makeFile({ url: "data:image/png;base64,AAAA" }))).toBe(true);
    });

    it("rejects a non-image data URL", () => {
      expect(isImageFile(makeFile({ url: "data:application/pdf;base64,AAAA" }))).toBe(false);
    });

    it("treats an extension-less entry as an image, matching AntD's heuristic", () => {
      expect(isImageFile(makeFile({ name: "unknown" }))).toBe(true);
    });
  });

  describe("toFilePreviewTarget", () => {
    it("maps stamped storage metadata and AntD fields onto the target", () => {
      const origin = new File(["content"], "report.docx", { type: "application/msword" });
      const file = makeFile({
        name: "report.docx",
        size: 7,
        type: "application/msword",
        url: "https://files.test/priv/report.docx",
        originFileObj: origin as UploadFile["originFileObj"]
      }) as UploadFile & Partial<UploadedFileMeta>;
      file.key = "priv/2026/07/report.docx";
      file.fileName = "original-report.docx";

      expect(toFilePreviewTarget(file)).toEqual({
        filename: "original-report.docx",
        contentType: "application/msword",
        size: 7,
        file: origin,
        key: "priv/2026/07/report.docx",
        url: "https://files.test/priv/report.docx"
      });
    });

    it("falls back to the display name when no fileName meta is stamped", () => {
      const target = toFilePreviewTarget(makeFile({ name: "plain.pdf" }));

      expect(target.filename).toBe("plain.pdf");
      expect(target.key).toBeUndefined();
      expect(target.file).toBeUndefined();
    });
  });
});
