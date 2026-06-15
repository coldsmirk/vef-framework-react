import { getAppConfig } from "./config";

const DOUBLE_SLASH_REGEX = /(?<!https?:)\/\//g;

/**
 * Base URL the framework appends storage object keys onto. Fed into
 * `appContext.fileBaseUrl` so components like `<FileUpload>` and the
 * `UploadField` form field can render previews without extra wiring.
 */
export const FILE_BASE_URL = `${getAppConfig("apiBaseUrl")}/storage/files/`.replaceAll(DOUBLE_SLASH_REGEX, "/");
