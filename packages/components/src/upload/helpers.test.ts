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

    it("uses a non-image MIME type even when an image thumbnail is present", () => {
      expect(isImageFile(makeFile({
        type: "application/pdf",
        name: "report.pdf",
        thumbUrl: "data:image/png;base64,AAAA"
      }))).toBe(false);
    });

    it("uses an image MIME type even when a non-image thumbnail URL is present", () => {
      expect(isImageFile(makeFile({
        type: "image/png",
        name: "photo",
        thumbUrl: "https://files.test/thumbnail.pdf"
      }))).toBe(true);
    });

    it("detects an image by URL extension ignoring case and query string", () => {
      expect(isImageFile(makeFile({ name: "opaque", url: "https://files.test/pic.PNG?v=1" }))).toBe(true);
    });

    it("detects an image by filename extension when no URL is present", () => {
      expect(isImageFile(makeFile({ name: "avatar.webp" }))).toBe(true);
    });

    it("rejects a non-image extension", () => {
      expect(isImageFile(makeFile({ name: "report.docx" }))).toBe(false);
    });

    it("uses the filename extension before the URL extension", () => {
      expect(isImageFile(makeFile({ name: "report.pdf", url: "https://files.test/photo.png" }))).toBe(false);
    });

    it("uses the stored original filename before the URL extension", () => {
      const file = makeFile({ name: "opaque", url: "https://files.test/photo.png" }) as UploadFile & Partial<UploadedFileMeta>;
      file.fileName = "report.pdf";

      expect(isImageFile(file)).toBe(false);
    });

    it("detects an image data URL", () => {
      expect(isImageFile(makeFile({ name: "opaque", url: "data:image/png;base64,AAAA" }))).toBe(true);
    });

    it("rejects a non-image data URL", () => {
      expect(isImageFile(makeFile({ name: "opaque", url: "data:application/pdf;base64,AAAA" }))).toBe(false);
    });

    it("rejects an extension-less entry with an opaque URL", () => {
      expect(isImageFile(makeFile({ name: "unknown", url: "https://files.test/object/42" }))).toBe(false);
    });
  });

  describe("toFilePreviewTarget", () => {
    it("maps stamped storage metadata and AntD fields onto the target", () => {
      const origin = new File(["content"], "report.docx", { type: "application/msword" });
      const file = makeFile({
        name: "report.docx",
        size: 7,
        type: "application/msword",
        originFileObj: origin as UploadFile["originFileObj"]
      }) as UploadFile & Partial<UploadedFileMeta>;
      file.key = "priv/2026/07/report.docx";
      file.fileName = "original-report.docx";
      file.sourceUrl = "https://files.test/priv/report.docx";

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
