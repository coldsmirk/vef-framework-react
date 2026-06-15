/**
 * The key for the HTTP client in dependency injection.
 */
export const HTTP_CLIENT_KEY = "__vef_http_client_key";

/**
 * The regex for path parameters in URLs (e.g., /users/:id).
 */
export const PATH_PARAM_REGEX = /:(?<key>\w+)/g;

/**
 * The regex for extracting filename from Content-Disposition header.
 */
export const CONTENT_DISPOSITION_FILENAME_REGEX = /filename[^;=\n]*=(?<name>(?<quote>['"]).*?\2|[^;\n]*)/;

/**
 * The header name for skipping authentication.
 */
export const SKIP_AUTH_HEADER = "X-Skip-Authentication";

/**
 * The header value for skipping authentication.
 */
export const SKIP_AUTH_VALUE = "1";

/**
 * Default request timeout in milliseconds (30 seconds).
 */
export const DEFAULT_TIMEOUT = 30_000;
