import type { Awaitable, MaybeArray, MaybeUndefined } from "@vef-framework-react/shared";
import type { AxiosProgressEvent, GenericAbortSignal, RawAxiosRequestHeaders } from "axios";

export type ProgressEvent = AxiosProgressEvent;

/**
 * The result of the API.
 */
export interface ApiResult<T = unknown> {
  /**
   * The code of the API.
   */
  readonly code: number;
  /**
   * The message of the API.
   */
  readonly message: string;
  /**
   * The data of the API.
   */
  readonly data: T;
}

/**
 * How a request body is transport-encoded so a code-shaped payload survives
 * middleboxes (WAF / proxy) that false-positive on it; the server's
 * body-encoding middleware reverses it before parsing.
 *
 * - `none` — send the body verbatim (also opts a single request out of a
 * client-wide `defaultBodyEncoding`).
 * - `base64` — base64 of the UTF-8 JSON body.
 * - `gzip+base64` — base64 of a gzip stream of the UTF-8 JSON body; smaller on
 * the wire and still text-shaped.
 */
export type BodyEncoding = "none" | "base64" | "gzip+base64";

/**
 * The authenticated tokens.
 */
export interface AuthTokens {
  /**
   * The access token
   */
  accessToken: string;
  /**
   * The refresh token. Absent when the backend issues stateful opaque-token
   * sessions (server-side sliding expiration, no refresh round-trip) — only
   * JWT-mode backends return one.
   */
  refreshToken?: string;
}

/**
 * The options for the HTTP client.
 */
export interface HttpClientOptions {
  /**
   * The base URL of the API.
   */
  baseUrl: string;
  /**
   * The timeout of the request.
   */
  timeout?: number;
  /**
   * The function to get the authentication tokens.
   */
  getAuthTokens?: () => Awaitable<MaybeUndefined<Readonly<AuthTokens>>>;
  /**
   * The function to set the authentication tokens.
   */
  setAuthTokens?: (tokens: Readonly<AuthTokens>) => Awaitable<void>;
  /**
   * The function to refresh the authentication tokens.
   * Receives the current tokens and should return new tokens.
   * If refresh fails, the promise should reject.
   */
  refreshToken?: (tokens: Readonly<AuthTokens>) => Awaitable<Readonly<AuthTokens>>;
  /**
   * The codes that are considered as successful.
   */
  okCode?: MaybeArray<number>;
  /**
   * The codes that are considered as authentication token expired.
   */
  tokenExpiredCode?: MaybeArray<number>;
  /**
   * The function to handle the unauthenticated error.
   */
  onUnauthenticated?: () => Awaitable<void>;
  /**
   * The function to handle the access denied error.
   */
  onAccessDenied?: () => Awaitable<void>;
  /**
   * The function to show the info message.
   */
  showInfoMessage?: (message: string) => void;
  /**
   * The function to show the warning message.
   */
  showWarningMessage?: (message: string) => void;
  /**
   * The function to show the error message.
   */
  showErrorMessage?: (message: string) => void;
  /**
   * The transport encoding applied to every request body by default. Individual
   * requests override it (including `"none"` to opt out); absent means the body
   * is sent verbatim.
   */
  defaultBodyEncoding?: BodyEncoding;
}

/**
 * A file fetched through the HTTP client.
 */
export interface HttpFileResponse {
  /**
   * The file content.
   */
  blob: Blob;
  /**
   * The filename parsed from the `Content-Disposition` response header,
   * absent when the server does not send one.
   */
  filename?: string;
}

/**
 * The options for the request.
 */
export interface RequestOptions {
  /**
   * The signal for the request.
   */
  signal?: GenericAbortSignal;
  /**
   * The headers for the request.
   */
  headers?: RawAxiosRequestHeaders;
}
