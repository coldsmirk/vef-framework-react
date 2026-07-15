import type { UploadFile } from "antd";

import type { FilePreviewTarget } from "../file-preview";
import type { UploadedFileMeta } from "./props";

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".dpg",
  ".gif",
  ".heic",
  ".heif",
  ".ico",
  ".jfif",
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp"
]);

const EXTENSION_REGEX = /\.[^./\\]*$/;

/**
 * Extract the dot-prefixed extension from a URL or filename, ignoring the
 * query string and hash.
 */
function getUrlExtension(url: string): string {
  const filename = url.split("/").pop() ?? "";
  const bareFilename = filename.split(/[#?]/, 1)[0] ?? "";

  return EXTENSION_REGEX.exec(bareFilename)?.[0] ?? "";
}

/**
 * Decide whether an AntD `UploadFile` is an image, mirroring AntD's own
 * thumbnail heuristic (`isImageUrl`) so the preview branch and the list
 * thumbnails agree: MIME type first, then the URL/filename extension.
 */
export function isImageFile(file: UploadFile): boolean {
  if (file.type && !file.thumbUrl) {
    return file.type.startsWith("image/");
  }

  const url = file.thumbUrl || file.url || "";
  const extension = getUrlExtension(url || file.name).toLowerCase();

  if (url.startsWith("data:image/") || IMAGE_EXTENSIONS.has(extension)) {
    return true;
  }

  if (url.startsWith("data:")) {
    return false;
  }

  return !extension;
}

/**
 * Normalize an AntD `UploadFile` into the framework's preview contract.
 * This is the single place that knows where the upload family stores its
 * metadata — `UploadedFileMeta` on the list entry, local bytes on
 * `originFileObj` — so preview hosts never inspect `UploadFile` themselves.
 */
export function toFilePreviewTarget(file: UploadFile): FilePreviewTarget {
  const { key, fileName } = file as UploadFile & Partial<UploadedFileMeta>;

  return {
    filename: fileName ?? file.name,
    contentType: file.type,
    size: file.size,
    file: file.originFileObj,
    key,
    url: file.url
  };
}
