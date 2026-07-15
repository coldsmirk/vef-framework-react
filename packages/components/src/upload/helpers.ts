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

const ORIGINAL_UPLOAD_FILE_URL = Symbol.for("@vef-framework-react/components/upload/original-file-url");

interface UploadFileView extends UploadFile {
  [ORIGINAL_UPLOAD_FILE_URL]?: string;
}

function getOriginalUploadFileUrl(file: UploadFile): string | undefined {
  return (file as UploadFileView)[ORIGINAL_UPLOAD_FILE_URL] ?? file.url;
}

/**
 * Read the URL a preview host should use without exposing it to AntD's list
 * renderer. Framework-owned files use `sourceUrl`; ordinary UploadFiles keep
 * their original `url` behind the internal view-model marker.
 */
export function getUploadSourceUrl(file: UploadFile): string | undefined {
  const { sourceUrl } = file as UploadFile & Partial<UploadedFileMeta>;

  return sourceUrl ?? getOriginalUploadFileUrl(file);
}

/**
 * Build the safe view-model passed to AntD. AntD renders `UploadFile.url` as a
 * native link and uses it in its default download fallback, so source URLs
 * must not be present on that object.
 */
export function toAntdUploadFile(file: UploadFile): UploadFile {
  if (!file.url) {
    return file;
  }

  const viewFile: UploadFileView = {
    ...file,
    url: undefined,
    [ORIGINAL_UPLOAD_FILE_URL]: file.url
  };

  return viewFile;
}

/**
 * Restore an ordinary UploadFile's original URL at explicit callback
 * boundaries. Framework-owned files continue to expose `sourceUrl` instead.
 */
export function toPublicUploadFile(file: UploadFile): UploadFile {
  const viewFile = file as UploadFileView;
  const originalUrl = viewFile[ORIGINAL_UPLOAD_FILE_URL];

  if (originalUrl === undefined) {
    return file;
  }

  const publicFile: UploadFileView = {
    ...file,
    url: originalUrl
  };
  delete publicFile[ORIGINAL_UPLOAD_FILE_URL];

  return publicFile;
}

/**
 * Keep a URL added by a custom request readable to its owner while preventing
 * AntD's success-path object spread from copying it into the list view-model.
 */
export function isolateUploadRequestFileUrl(file: unknown): void {
  if (!file || typeof file !== "object" || !("url" in file)) {
    return;
  }

  const requestFile = file as { url?: unknown } & Partial<UploadFileView>;

  if (typeof requestFile.url !== "string") {
    return;
  }

  requestFile[ORIGINAL_UPLOAD_FILE_URL] = requestFile.url;
  Object.defineProperty(requestFile, "url", {
    configurable: true,
    enumerable: false,
    value: requestFile.url,
    writable: true
  });
}

/**
 * Extract the dot-prefixed extension from a URL or filename, ignoring the
 * query string and hash.
 */
function getExtension(value: string): string {
  const filename = value.split("/").pop() ?? "";
  const bareFilename = filename.split(/[#?]/, 1)[0] ?? "";

  return EXTENSION_REGEX.exec(bareFilename)?.[0] ?? "";
}

function isImageExtension(value: string): boolean | undefined {
  const extension = getExtension(value);

  return extension ? IMAGE_EXTENSIONS.has(extension.toLowerCase()) : undefined;
}

/**
 * Decide whether an AntD `UploadFile` represents an image from its actual
 * file metadata. AntD's generated thumbnail is deliberately ignored because
 * non-image files may also have image thumbnails.
 */
export function isImageFile(file: UploadFile): boolean {
  if (file.type) {
    return file.type.startsWith("image/");
  }

  const { fileName } = file as UploadFile & Partial<UploadedFileMeta>;
  const filenameResult = isImageExtension(fileName ?? file.name);

  if (filenameResult !== undefined) {
    return filenameResult;
  }

  const url = getUploadSourceUrl(file) ?? "";

  if (url.startsWith("data:image/")) {
    return true;
  }

  if (url.startsWith("data:")) {
    return false;
  }

  return isImageExtension(url) ?? false;
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
    url: getUploadSourceUrl(file)
  };
}
