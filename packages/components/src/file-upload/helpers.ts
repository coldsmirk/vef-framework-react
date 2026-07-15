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
