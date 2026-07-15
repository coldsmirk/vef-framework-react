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
