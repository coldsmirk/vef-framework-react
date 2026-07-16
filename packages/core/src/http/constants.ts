/**
 * The key for the HTTP client in dependency injection.
 */
export const HTTP_CLIENT_KEY = "__vef_http_client_key";

/**
 * The regex for path parameters in URLs (e.g., /users/:id). A parameter only
 * counts at the start of a path segment (after a `/`) and must begin with a
 * letter or underscore, so the port in an absolute URL (`https://host:9000`)
 * or a colon inside a segment (`/time/12:30`) is never treated as one.
 */
export const PATH_PARAM_REGEX = /(?<=\/):(?<key>[A-Z_]\w*)/gi;

/**
 * The regex for extracting filename from Content-Disposition header.
 */
export const CONTENT_DISPOSITION_FILENAME_REGEX = /(?:^|;)\s*filename\s*=(?<name>(?<quote>['"]).*?\2|[^;\n]*)/i;

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
