import type { Awaitable, MaybeArray } from "@vef-framework-react/shared";
import type { AxiosError, AxiosInstance, AxiosProgressEvent, AxiosRequestConfig, AxiosResponse, GenericAbortSignal, InternalAxiosRequestConfig } from "axios";

import type { ApiResult, BodyEncoding, HttpClientOptions, HttpFileResponse, RequestOptions } from "./types";

import { encodeQueryString, isArray, isFunction, isNullish, isNumber, isString } from "@vef-framework-react/shared";
import axios, { CanceledError } from "axios";

import { encodeRequestBody } from "./body-encoding";
import {
  BODY_ENCODING_HEADER,
  CONTENT_DISPOSITION_FILENAME_REGEX,
  DEFAULT_TIMEOUT,
  PATH_PARAM_REGEX,
  SKIP_AUTH_HEADER,
  SKIP_AUTH_VALUE
} from "./constants";
import { BusinessError } from "./errors";

const RESPONSE_MODE_KEY = "__vefResponseMode";
const MAX_ERROR_BODY_BYTES = 1024 * 1024;
const DEFAULT_DOWNLOAD_FILENAME = "download";

type ResponseMode = "envelope" | "raw";

type HttpAxiosRequestConfig<D = unknown> = AxiosRequestConfig<D> & {
  [RESPONSE_MODE_KEY]?: ResponseMode;
};

interface ObservableAbortSignal extends GenericAbortSignal {
  addEventListener: NonNullable<GenericAbortSignal["addEventListener"]>;
  removeEventListener: NonNullable<GenericAbortSignal["removeEventListener"]>;
}

interface RefreshCycle {
  failureHandled: Promise<void>;
  promise: Promise<boolean>;
}

interface RefreshCycleStart {
  cycle: RefreshCycle;
  owner: boolean;
}

type RefreshFailureHandler = () => Awaitable<void>;

type RefreshWaiter = (success: boolean) => void;

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

/**
 * Whether a request body is a JSON payload the client may transport-encode;
 * binary and multipart bodies are always sent as-is.
 */
function isEncodableBody(data: unknown): boolean {
  return !isNullish(data)
    && !(data instanceof FormData)
    && !(data instanceof Blob)
    && !isArrayBuffer(data)
    && !ArrayBuffer.isView(data);
}

function isObservableAbortSignal(signal: GenericAbortSignal): signal is ObservableAbortSignal {
  return typeof signal.addEventListener === "function" && typeof signal.removeEventListener === "function";
}

/**
 * The HTTP client.
 */
export class HttpClient {
  /**
   * The axios instance.
   */
  readonly #axiosInstance: AxiosInstance;
  /**
   * The http client options.
   */
  readonly #options: HttpClientOptions;

  /**
   * The shared token refresh operation, when one is in progress.
   */
  #refreshCycle?: RefreshCycle;
  /**
   * Request-scoped waiters for the active refresh operation.
   */
  #refreshWaiters = new Set<RefreshWaiter>();

  constructor(options: HttpClientOptions) {
    this.#options = options;

    const { baseUrl, timeout = DEFAULT_TIMEOUT } = options;

    this.#axiosInstance = axios.create({
      baseURL: baseUrl,
      allowAbsoluteUrls: true,
      timeout,
      headers: { "Content-Type": "application/json" },
      paramsSerializer: params => encodeQueryString(params, {
        arrayFormat: "repeat",
        skipNulls: true,
        charset: "utf-8"
      }),
      responseType: "json",
      responseEncoding: "utf-8",
      validateStatus: status => status >= 200 && status < 300,
      withCredentials: false,
      timeoutErrorMessage: "请求超时"
    });

    this.initInterceptors();
  }

  private initInterceptors(): void {
    this.#axiosInstance.interceptors.request.use(
      this.handleRequest.bind(this),
      this.handleRequestError.bind(this)
    );

    this.#axiosInstance.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this)
    );
  }

  /**
   * Check if the code matches the target code(s).
   */
  private matchesCode(code: number, target: MaybeArray<number>): boolean {
    return isArray(target) ? target.includes(code) : code === target;
  }

  /**
   * Handle the request interceptor.
   */
  private async handleRequest(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    const skipAuth = config.headers[SKIP_AUTH_HEADER] === SKIP_AUTH_VALUE;

    const refreshPromise = this.#refreshCycle?.promise;

    if (refreshPromise && !skipAuth) {
      const success = await this.waitForTokenRefresh(refreshPromise, config);

      if (!success) {
        throw new Error("登录已过期, 请重新登录");
      }
    }

    if (skipAuth) {
      delete config.headers[SKIP_AUTH_HEADER];
    } else {
      await this.injectAccessToken(config);
    }

    this.replacePathParams(config);
    return config;
  }

  /**
   * Handle the request error interceptor.
   */
  private handleRequestError(error: unknown): Promise<never> {
    const { showErrorMessage } = this.#options;
    const message = error instanceof Error ? error.message : String(error);
    const errorText = `发起请求失败: ${message || "未知错误"}`;

    if (showErrorMessage) {
      showErrorMessage(errorText);
    } else {
      console.error(`[HttpClient] ${errorText}`);
    }

    return Promise.reject(error);
  }

  /**
   * Handle the response interceptor.
   */
  private handleResponse(response: AxiosResponse<unknown>): AxiosResponse<unknown> {
    if (this.getResponseMode(response.config) === "raw") {
      return response;
    }

    if (!this.isApiResult(response.data)) {
      throw new TypeError("Invalid API response envelope");
    }

    this.assertBusinessSuccess(response.data, response.config);
    return response;
  }

  /**
   * Handle the response error interceptor.
   */
  private async handleResponseError(error: AxiosError<unknown>): Promise<AxiosResponse<unknown>> {
    if (error instanceof CanceledError) {
      if (error.response) {
        const { method, url } = error.response.config;
        console.warn(`[HttpClient] [${method}: ${url}] 被取消`);
      }

      throw error;
    }

    const { response } = error;

    if (!response) {
      this.logError(`请求失败: ${error.message || "未知错误"}`);
      throw error;
    }

    const {
      status,
      config,
      data
    } = response;
    const result = await this.readApiResult(data);
    const code = result?.code;
    const message = result?.message ?? error.message ?? "未知错误";
    const requestInfo = `[${config.method}: ${config.url}]`;

    switch (status) {
      case 400: {
        this.logWarning(message, `${requestInfo} 参数错误: ${message}`);
        break;
      }

      case 401: {
        // A successful silent refresh returns the retried response — resolve the
        // original request with it instead of falling through to `throw error`,
        // which would surface the stale 401 even though the retry succeeded.
        const retriedResponse = await this.handleUnauthorized(error, code);

        if (retriedResponse) {
          return retriedResponse;
        }

        break;
      }

      case 403: {
        this.#options.showWarningMessage?.(`${message}, 请联系管理员为您开通`);
        console.warn(`[HttpClient] ${requestInfo} 访问被拒绝: ${message}`);
        await this.#options.onAccessDenied?.();
        break;
      }

      default: {
        this.logError(message, `${requestInfo} 返回错误: ${message}`);
      }
    }

    throw error;
  }

  /**
   * Handle 401 unauthorized response.
   */
  private async handleUnauthorized(
    error: AxiosError<unknown>,
    code: number | undefined
  ): Promise<AxiosResponse<unknown> | void> {
    const { tokenExpiredCode = [] } = this.#options;

    if (code === undefined || !this.matchesCode(code, tokenExpiredCode)) {
      await this.#options.onUnauthenticated?.();
      return;
    }

    // If already refreshing token and received 401, the refresh request itself failed.
    // Throw immediately to avoid deadlock.
    if (this.#refreshCycle) {
      throw error;
    }

    const { cycle } = this.tryRefreshToken(async () => {
      const expiredMessage = "登录已过期, 请重新登录";
      this.logInfo(expiredMessage);
      await this.#options.onUnauthenticated?.();
    });
    const success = await this.waitForTokenRefresh(cycle.promise, error.response!.config);

    if (success) {
      return this.retryRequest(error.response!.config);
    }

    await cycle.failureHandled;
  }

  /**
   * Log info message using configured handler or console.
   */
  private logInfo(message: string): void {
    if (this.#options.showInfoMessage) {
      this.#options.showInfoMessage(message);
    } else {
      console.info(`[HttpClient] ${message}`);
    }
  }

  /**
   * Log warning message using configured handler or console.
   */
  private logWarning(userMessage: string, consoleMessage?: string): void {
    if (this.#options.showWarningMessage) {
      this.#options.showWarningMessage(userMessage);
    } else {
      console.warn(`[HttpClient] ${consoleMessage ?? userMessage}`);
    }
  }

  /**
   * Log error message using configured handler or console.
   */
  private logError(userMessage: string, consoleMessage?: string): void {
    if (this.#options.showErrorMessage) {
      this.#options.showErrorMessage(userMessage);
    } else {
      console.error(`[HttpClient] ${consoleMessage ?? userMessage}`);
    }
  }

  /**
   * Inject access token into request Authorization header.
   */
  private async injectAccessToken(config: InternalAxiosRequestConfig): Promise<void> {
    const { getAuthTokens } = this.#options;

    if (!getAuthTokens) {
      return;
    }

    const tokens = await getAuthTokens();

    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
  }

  /**
   * Replace path parameters in the URL (e.g., /users/:id -> /users/123).
   */
  private replacePathParams(config: InternalAxiosRequestConfig): void {
    const { url, params = {} } = config;

    if (!url || !PATH_PARAM_REGEX.test(url)) {
      return;
    }

    // Reset regex lastIndex since it's global
    PATH_PARAM_REGEX.lastIndex = 0;

    config.url = url.replaceAll(PATH_PARAM_REGEX, (_, key: string) => {
      if (!Object.hasOwn(params, key)) {
        console.warn(`[HttpClient] 接口: ${url} 路径参数 ${key} 未在查询参数中定义, 请检查`);
        return "unknown";
      }

      const value = params[key];

      if (isNullish(value)) {
        console.warn(`[HttpClient] 接口: ${url} 路径参数 ${key} 在查询参数中为空, 请检查`);
        return "unknown";
      }

      return String(value);
    });
  }

  /**
   * Get the active token refresh or start a shared refresh operation.
   */
  private tryRefreshToken(onFailure?: RefreshFailureHandler): RefreshCycleStart {
    if (this.#refreshCycle) {
      return {
        cycle: this.#refreshCycle,
        owner: false
      };
    }

    const {
      getAuthTokens,
      refreshToken,
      setAuthTokens
    } = this.#options;

    if (!getAuthTokens || !refreshToken || !setAuthTokens) {
      return {
        cycle: this.createRefreshCycle(Promise.resolve(false), onFailure, false),
        owner: true
      };
    }

    // Publish the shared promise before invoking user callbacks so a
    // synchronous callback cannot re-enter and start a second refresh.
    const refresh = Promise.withResolvers<boolean>();
    const refreshPromise = refresh.promise;
    const cycle = this.createRefreshCycle(refreshPromise, onFailure, true);

    void this.performTokenRefresh(getAuthTokens, refreshToken, setAuthTokens).then(refresh.resolve, refresh.reject);

    return {
      cycle,
      owner: true
    };
  }

  /**
   * Create a refresh cycle and bind its owner-selected failure policy.
   */
  private createRefreshCycle(
    refreshPromise: Promise<boolean>,
    onFailure: RefreshFailureHandler | undefined,
    active: boolean
  ): RefreshCycle {
    const failure = Promise.withResolvers<void>();
    const cycle: RefreshCycle = {
      failureHandled: failure.promise,
      promise: refreshPromise
    };

    if (active) {
      this.#refreshCycle = cycle;
    }

    void refreshPromise.then(
      success => {
        if (active) {
          this.finishTokenRefresh(cycle, success);
        }

        const failureHandling = success ? Promise.resolve() : this.handleRefreshFailure(onFailure);
        void failureHandling.then(failure.resolve, failure.reject);
      },
      error => {
        if (active) {
          this.finishTokenRefresh(cycle, false);
        }

        void this.handleRefreshFailure(onFailure).then(
          () => failure.reject(error),
          failure.reject
        );
      }
    );
    // A canceled owner no longer awaits this promise, so retain a rejection
    // observer without changing what a live owner receives.
    void failure.promise.catch(() => undefined);

    return cycle;
  }

  /**
   * Run the failure policy selected by the refresh cycle owner.
   */
  private async handleRefreshFailure(onFailure?: RefreshFailureHandler): Promise<void> {
    await onFailure?.();
  }

  /**
   * Refresh the token using the configured callbacks.
   */
  private async performTokenRefresh(
    getAuthTokens: NonNullable<HttpClientOptions["getAuthTokens"]>,
    refreshToken: NonNullable<HttpClientOptions["refreshToken"]>,
    setAuthTokens: NonNullable<HttpClientOptions["setAuthTokens"]>
  ): Promise<boolean> {
    try {
      const currentTokens = await getAuthTokens();

      if (!currentTokens) {
        return false;
      }

      const newTokens = await refreshToken(currentTokens);
      await setAuthTokens(Object.freeze(newTokens));
      return true;
    } catch (error) {
      console.error(`[HttpClient] 刷新令牌失败: ${error}`);
      return false;
    }
  }

  /**
   * Finish the active refresh and release its remaining request waiters.
   */
  private finishTokenRefresh(cycle: RefreshCycle, success: boolean): void {
    if (this.#refreshCycle !== cycle) {
      return;
    }

    for (const waiter of this.#refreshWaiters) {
      waiter(success);
    }

    this.#refreshWaiters.clear();
    this.#refreshCycle = undefined;
  }

  /**
   * Wait for a shared refresh while retaining this request's cancellation.
   */
  private waitForTokenRefresh(
    refreshPromise: Promise<boolean>,
    config: InternalAxiosRequestConfig
  ): Promise<boolean> {
    if (this.#refreshCycle?.promise !== refreshPromise) {
      return refreshPromise;
    }

    const { signal } = config;

    if (signal?.aborted) {
      return Promise.reject(new CanceledError(undefined, config));
    }

    return new Promise<boolean>((resolve, reject) => {
      const observableSignal = signal && isObservableAbortSignal(signal) ? signal : undefined;
      let settle: RefreshWaiter | undefined;

      const abort = () => {
        const waiter = settle;

        if (!waiter) {
          return;
        }

        settle = undefined;
        this.#refreshWaiters.delete(waiter);
        observableSignal?.removeEventListener("abort", abort);
        reject(new CanceledError(undefined, config));
      };

      settle = success => {
        const waiter = settle;

        if (!waiter) {
          return;
        }

        settle = undefined;
        this.#refreshWaiters.delete(waiter);
        observableSignal?.removeEventListener("abort", abort);
        resolve(success);
      };

      this.#refreshWaiters.add(settle);
      observableSignal?.addEventListener("abort", abort, { once: true });

      // Close the gap between the initial check and listener registration.
      if (signal?.aborted) {
        abort();
      }
    });
  }

  /**
   * Retry the request with refreshed token.
   */
  private async retryRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse<unknown>> {
    const newConfig = {
      ...config,
      [RESPONSE_MODE_KEY]: this.getResponseMode(config)
    };
    await this.injectAccessToken(newConfig);
    return this.#axiosInstance(newConfig);
  }

  /**
   * Get the response handling mode from an Axios request config.
   */
  private getResponseMode(config: InternalAxiosRequestConfig): ResponseMode {
    return Reflect.get(config, RESPONSE_MODE_KEY) === "raw" ? "raw" : "envelope";
  }

  /**
   * Check whether a value is an API response envelope.
   */
  private isApiResult(value: unknown): value is ApiResult {
    return typeof value === "object"
      && value !== null
      && isNumber(Reflect.get(value, "code"))
      && isString(Reflect.get(value, "message"))
      && Object.hasOwn(value, "data");
  }

  /**
   * Apply the configured business-code handling to an API response envelope.
   */
  private assertBusinessSuccess(result: ApiResult, config: AxiosRequestConfig): void {
    const { showWarningMessage, okCode = 0 } = this.#options;
    const {
      code,
      message,
      data
    } = result;

    if (this.matchesCode(code, okCode)) {
      return;
    }

    if (showWarningMessage) {
      showWarningMessage(message);
    } else {
      console.warn(`[HttpClient] [${config.method}: ${config.url}] 返回错误: ${message}`);
    }

    throw new BusinessError(code, message, data);
  }

  /**
   * Read a small API response envelope from an error payload.
   */
  private async readApiResult(data: unknown): Promise<ApiResult | undefined> {
    if (this.isApiResult(data)) {
      return data;
    }

    if (isString(data)) {
      if (data.length > MAX_ERROR_BODY_BYTES || new Blob([data]).size > MAX_ERROR_BODY_BYTES) {
        return;
      }

      try {
        const parsed: unknown = JSON.parse(data);
        return this.isApiResult(parsed) ? parsed : undefined;
      } catch {
        return;
      }
    }

    if ((isArrayBuffer(data) || ArrayBuffer.isView(data)) && data.byteLength > MAX_ERROR_BODY_BYTES) {
      return;
    }

    let blob: Blob;

    try {
      blob = this.toBlob(data);
    } catch {
      return;
    }

    if (blob.size > MAX_ERROR_BODY_BYTES) {
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await blob.text());
      return this.isApiResult(parsed) ? parsed : undefined;
    } catch {}
  }

  /**
   * Normalize Axios browser and Node binary response bodies to a Blob.
   */
  private toBlob(data: unknown, contentType?: unknown): Blob {
    if (data instanceof Blob) {
      return data;
    }

    const options = isString(contentType) ? { type: contentType } : undefined;

    if (isArrayBuffer(data)) {
      return new Blob([data], options);
    }

    if (ArrayBuffer.isView(data)) {
      if (isArrayBuffer(data.buffer)) {
        return new Blob([new Uint8Array(data.buffer, data.byteOffset, data.byteLength)], options);
      }

      const copy = new Uint8Array(data.byteLength);
      copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      return new Blob([copy], options);
    }

    throw new TypeError("Invalid file response body");
  }

  /**
   * Extract a filename from Content-Disposition.
   */
  private getResponseFilename(contentDisposition: unknown): string | undefined {
    if (!isString(contentDisposition)) {
      return;
    }

    const extendedParameter = contentDisposition.split(";").find(parameter => {
      const separatorIndex = parameter.indexOf("=");
      return separatorIndex !== -1 && parameter.slice(0, separatorIndex).trim().toLowerCase() === "filename*";
    });
    const extendedRawValue = extendedParameter?.slice(extendedParameter.indexOf("=") + 1).trim();
    const firstQuoteIndex = extendedRawValue?.indexOf("'") ?? -1;
    const secondQuoteIndex = firstQuoteIndex >= 0 ? extendedRawValue?.indexOf("'", firstQuoteIndex + 1) ?? -1 : -1;
    const extendedValue = secondQuoteIndex >= 0 ? extendedRawValue?.slice(secondQuoteIndex + 1) : undefined;
    const charset = firstQuoteIndex >= 0 ? extendedRawValue?.slice(0, firstQuoteIndex).trim().toLowerCase() : undefined;

    if (extendedValue && (!charset || charset === "utf-8")) {
      try {
        return decodeURIComponent(extendedValue);
      } catch {
        // Fall back to the regular filename parameter.
      }
    }

    const match = CONTENT_DISPOSITION_FILENAME_REGEX.exec(contentDisposition);
    const value = match?.groups?.name?.trim();

    if (!value) {
      return;
    }

    const quote = match?.groups?.quote;
    return quote ? value.slice(1, -1) : value;
  }

  /**
   * Apply the resolved transport body encoding to a request, adding the
   * `X-Body-Encoding` header for the server to reverse. A non-JSON body or a
   * resolved `none` encoding passes through untouched.
   */
  private async encodeRequestData<D, O extends RequestOptions>(
    data: D | undefined,
    bodyEncoding: BodyEncoding | undefined,
    options: O
  ): Promise<{ data: unknown; options: O }> {
    const encoding = bodyEncoding ?? this.#options.defaultBodyEncoding ?? "none";

    if (encoding === "none" || !isEncodableBody(data)) {
      return { data, options };
    }

    const payload = isString(data) ? data : JSON.stringify(data);
    const encoded = await encodeRequestBody(payload, encoding);

    return {
      data: encoded.body,
      options: {
        ...options,
        headers: {
          ...options.headers,
          [BODY_ENCODING_HEADER]: encoded.encoding
        }
      }
    };
  }

  /**
   * Ensure the token is refreshed. Can be called proactively by external code
   * (e.g., fetch-based SSE) to refresh token before/after request.
   *
   * @param triggerCallback - Whether to trigger onUnauthenticated callback on failure.
   * @returns True if token refresh succeeded, false otherwise.
   */
  public async ensureTokenRefreshed(triggerCallback = true): Promise<boolean> {
    const onFailure = triggerCallback
      ? () => this.#options.onUnauthenticated?.()
      : undefined;
    const { cycle, owner } = this.tryRefreshToken(onFailure);
    const success = await cycle.promise;

    if (owner) {
      await cycle.failureHandled;
    }

    return success;
  }

  /**
   * GET request.
   */
  public async get<R = unknown, P = unknown>(
    url: string,
    options?: RequestOptions & { params?: P }
  ): Promise<ApiResult<R>> {
    const response = await this.#axiosInstance.get<ApiResult<R>>(url, options);
    return response.data;
  }

  /**
   * POST request.
   */
  public async post<R = unknown, D = unknown, P = unknown>(
    url: string,
    options?: RequestOptions & { data?: D; params?: P; bodyEncoding?: BodyEncoding }
  ): Promise<ApiResult<R>> {
    const {
      data,
      bodyEncoding,
      ...restOptions
    } = options ?? {};
    const request = await this.encodeRequestData(data, bodyEncoding, restOptions);
    const response = await this.#axiosInstance.post<ApiResult<R>>(url, request.data, request.options);
    return response.data;
  }

  /**
   * PUT request.
   */
  public async put<R = unknown, D = unknown, P = unknown>(
    url: string,
    options?: RequestOptions & { data?: D; params?: P; bodyEncoding?: BodyEncoding }
  ): Promise<ApiResult<R>> {
    const {
      data,
      bodyEncoding,
      ...restOptions
    } = options ?? {};
    const request = await this.encodeRequestData(data, bodyEncoding, restOptions);
    const response = await this.#axiosInstance.put<ApiResult<R>>(url, request.data, request.options);
    return response.data;
  }

  /**
   * DELETE request.
   */
  public async delete<R = unknown, P = unknown>(
    url: string,
    options?: RequestOptions & { params?: P }
  ): Promise<ApiResult<R>> {
    const response = await this.#axiosInstance.delete<ApiResult<R>>(url, options);
    return response.data;
  }

  /**
   * Upload file via multipart/form-data.
   */
  public async upload<R = unknown, P = unknown>(
    url: string,
    options?: RequestOptions & {
      params?: P;
      data: FormData;
      onProgress?: (event: AxiosProgressEvent) => void;
    }
  ): Promise<ApiResult<R>> {
    const {
      data,
      onProgress,
      ...restOptions
    } = options ?? {};
    const response = await this.#axiosInstance.postForm<ApiResult<R>>(url, data, {
      ...restOptions,
      onUploadProgress: isFunction(onProgress) ? onProgress : undefined
    });
    return response.data;
  }

  /**
   * Fetch a file as a blob, with the full request semantics of the client
   * (Bearer injection, 401 refresh, path parameters, abort signal). A
   * response carrying the backend's JSON business envelope is surfaced as a
   * BusinessError instead of being returned as file content.
   */
  public async requestFile<D = unknown, P = unknown>(
    url: string,
    options?: RequestOptions & {
      method?: "get" | "post";
      data?: D;
      params?: P;
      onProgress?: (progress: AxiosProgressEvent) => void;
    }
  ): Promise<HttpFileResponse> {
    const {
      method = "get",
      data: requestData,
      onProgress,
      ...restOptions
    } = options ?? {};
    const requestConfig: HttpAxiosRequestConfig<D> = {
      ...restOptions,
      [RESPONSE_MODE_KEY]: "raw",
      responseType: "arraybuffer",
      responseEncoding: "binary",
      onDownloadProgress: isFunction(onProgress) ? onProgress : undefined
    };
    const {
      config,
      data,
      headers
    } = method === "post"
      ? await this.#axiosInstance.post<unknown>(url, requestData, requestConfig)
      : await this.#axiosInstance.get<unknown>(url, requestConfig);
    const blob = this.toBlob(data, headers["content-type"]);

    const errorResult = await this.readApiResult(blob);

    if (errorResult) {
      this.assertBusinessSuccess(errorResult, config);
    }

    return {
      blob,
      filename: this.getResponseFilename(headers["content-disposition"])
    };
  }

  /**
   * Download file as blob and trigger browser download.
   */
  public async download<D = unknown, P = unknown>(
    url: string,
    options?: RequestOptions & {
      method?: "get" | "post";
      data?: D;
      params?: P;
      onProgress?: (progress: AxiosProgressEvent) => void;
      filename?: string | ((filename: string) => string);
    }
  ): Promise<void> {
    const { filename, ...requestOptions } = options ?? {};
    const { blob, filename: responseFilename } = await this.requestFile<D, P>(url, requestOptions);

    const originalFilename = responseFilename ?? DEFAULT_DOWNLOAD_FILENAME;
    const objectUrl = URL.createObjectURL(blob);

    try {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = isFunction(filename) ? filename(originalFilename) : filename ?? originalFilename;
      anchor.click();
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  }
}
