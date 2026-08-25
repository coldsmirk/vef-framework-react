import type { UploadFile } from "antd";

import { getUploadSourceUrl, isImageFile } from "../upload/helpers";

const DOUBLE_SLASH_REGEX = /(?<!https?:)\/\//g;

export function resolveStoredFileUrl(
  key: string,
  fileBaseUrl: string | undefined,
  resolveFileUrl: ((key: string) => string) | undefined
): string {
  if (resolveFileUrl) {
    return resolveFileUrl(key);
  }

  if (!fileBaseUrl) {
    return key;
  }

  return `${fileBaseUrl}/${key}`.replaceAll(DOUBLE_SLASH_REGEX, "/");
}

/**
 * Give a publicly readable image the thumbnail AntD would otherwise not draw.
 *
 * The upload family keeps source URLs off `UploadFile.url` so authenticated
 * objects are never exposed as native list links, but AntD's picture lists
 * render a thumbnail — and offer the preview action — only when `thumbUrl` or
 * `url` is set. An object uploaded with `public` lands under `pub/` and is
 * served without credentials, so its source URL is safe to hand back as a
 * presentation thumbnail. Private objects keep the generic icon.
 *
 * An explicit `thumbUrl` always wins: it is the application's own approved
 * presentation thumbnail.
 */
export function withPublicThumbnail(file: UploadFile, isPublic: boolean | undefined): UploadFile {
  if (!isPublic || file.thumbUrl || !isImageFile(file)) {
    return file;
  }

  const sourceUrl = getUploadSourceUrl(file);

  if (!sourceUrl) {
    return file;
  }

  return { ...file, thumbUrl: sourceUrl };
}
