export { HttpClient } from "./client";
export {
  CONTENT_DISPOSITION_FILENAME_REGEX,
  DEFAULT_TIMEOUT,
  HTTP_CLIENT_KEY,
  PATH_PARAM_REGEX,
  SKIP_AUTH_HEADER,
  SKIP_AUTH_VALUE,
  // Backward compatibility aliases
  SKIP_AUTH_HEADER as skipAuthenticationHeader,
  SKIP_AUTH_VALUE as skipAuthenticationValue
} from "./constants";
export { BusinessError } from "./errors";
export { createHttpClient, isBusinessError } from "./helpers";
export type * from "./types";
