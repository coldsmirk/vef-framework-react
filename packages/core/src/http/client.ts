import type { MaybeArray } from "@vef-framework-react/shared";
import type { AxiosError, AxiosInstance, AxiosProgressEvent, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import type { ApiResult, HttpClientOptions, RequestOptions } from "./types";

import { encodeQueryString, isArray, isFunction, isNullish, isString } from "@vef-framework-react/shared";
import axios, { CanceledError } from "axios";

import {
  CONTENT_DISPOSITION_FILENAME_REGEX,
  DEFAULT_TIMEOUT,
  PATH_PARAM_REGEX,
  SKIP_AUTH_HEADER,
  SKIP_AUTH_VALUE
} from "./constants";
import { BusinessError } from "./errors";

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
   * Indicates whether a token refresh is in progress.
   */
  #isRefreshing = false;
  /**
   * Queue of pending requests waiting for token refresh to complete.
   */
  #waitingQueue: Array<(success: boolean) => void> = [];

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

    if (this.#isRefreshing && !skipAuth) {
      const success = await new Promise<boolean>(resolve => {
        this.#waitingQueue.push(resolve);
      });

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
  private handleResponse(response: AxiosResponse<ApiResult>): AxiosResponse<ApiResult> {
    const { showWarningMessage, okCode = 0 } = this.#options;
    const {
      code,
      message,
      data
    } = response.data;

    if (this.matchesCode(code, okCode)) {
      return response;
    }

    if (showWarningMessage) {
      showWarningMessage(message);
    } else {
      console.warn(`[HttpClient] [${response.config.method}: ${response.config.url}] 返回错误: ${message}`);
    }

    throw new BusinessError(code, message, data);
  }

  /**
   * Handle the response error interceptor.
   */
  private async handleResponseError(error: AxiosError<ApiResult>): Promise<AxiosResponse<ApiResult> | void> {
    if (error instanceof CanceledError) {
      if (error.response) {
        const { method, url } = error.response.config;
        console.warn(`[HttpClient] [${method}: ${url}] 被取消`);
      }

      return;
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
    const { code, message } = data;
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
        const retriedResponse = await this.handleUnauthorized(error, code, requestInfo);

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
    error: AxiosError<ApiResult>,
    code: number,
    _requestInfo: string
  ): Promise<AxiosResponse<ApiResult> | void> {
    const { tokenExpiredCode = [] } = this.#options;

    if (!this.matchesCode(code, tokenExpiredCode)) {
      await this.#options.onUnauthenticated?.();
      return;
    }

    // If already refreshing token and received 401, the refresh request itself failed.
    // Throw immediately to avoid deadlock.
    if (this.#isRefreshing) {
      throw error;
    }

    const success = await this.tryRefreshToken();

    if (success) {
      return this.retryRequest(error.response!.config);
    }

    const expiredMessage = "登录已过期, 请重新登录";
    this.logInfo(expiredMessage);
    await this.#options.onUnauthenticated?.();
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
   * Ensure the token is refreshed. Can be called proactively by external code
   * (e.g., fetch-based SSE) to refresh token before/after request.
   *
   * @param triggerCallback - Whether to trigger onUnauthenticated callback on failure.
   * @returns True if token refresh succeeded, false otherwise.
   */
  public async ensureTokenRefreshed(triggerCallback = true): Promise<boolean> {
    if (this.#isRefreshing) {
      return new Promise<boolean>(resolve => {
        this.#waitingQueue.push(resolve);
      });
    }

    const success = await this.tryRefreshToken();

    if (!success && triggerCallback) {
      await this.#options.onUnauthenticated?.();
    }

    return success;
  }

  /**
   * Try to refresh the token using the provided refresh callback.
   */
  private async tryRefreshToken(): Promise<boolean> {
    const {
      getAuthTokens,
      refreshToken,
      setAuthTokens
    } = this.#options;

    if (!getAuthTokens || !refreshToken || !setAuthTokens) {
      return false;
    }

    this.#isRefreshing = true;
    let success = false;

    try {
      const currentTokens = await getAuthTokens();

      if (!currentTokens) {
        return false;
      }

      const newTokens = await refreshToken(currentTokens);
      await setAuthTokens(Object.freeze(newTokens));
      success = true;
      return true;
    } catch (error) {
      console.error(`[HttpClient] 刷新令牌失败: ${error}`);
      return false;
    } finally {
      this.#isRefreshing = false;

      for (const resolve of this.#waitingQueue) {
        resolve(success);
      }

      this.#waitingQueue = [];
    }
  }

  /**
   * Retry the request with refreshed token.
   */
  private async retryRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse<ApiResult>> {
    const newConfig = { ...config };
    await this.injectAccessToken(newConfig);
    return this.#axiosInstance(newConfig);
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
    options?: RequestOptions & { data?: D; params?: P }
  ): Promise<ApiResult<R>> {
    const { data, ...restOptions } = options ?? {};
    const response = await this.#axiosInstance.post<ApiResult<R>>(url, data, restOptions);
    return response.data;
  }

  /**
   * PUT request.
   */
  public async put<R = unknown, D = unknown, P = unknown>(
    url: string,
    options?: RequestOptions & { data?: D; params?: P }
  ): Promise<ApiResult<R>> {
    const { data, ...restOptions } = options ?? {};
    const response = await this.#axiosInstance.put<ApiResult<R>>(url, data, restOptions);
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
    const {
      method = "get",
      data: requestData,
      onProgress,
      filename,
      ...restOptions
    } = options ?? {};
    const requestConfig: AxiosRequestConfig<D> = {
      ...restOptions,
      responseType: "blob",
      responseEncoding: "binary",
      onDownloadProgress: isFunction(onProgress) ? onProgress : undefined
    };
    const { data, headers } = method === "post"
      ? await this.#axiosInstance.post<Blob>(url, requestData, requestConfig)
      : await this.#axiosInstance.get<Blob>(url, requestConfig);

    // Check if response is actually an error JSON
    try {
      const result: ApiResult = JSON.parse(await data.text());
      throw new Error(result.message);
    } catch {
      // Expected: blob is not JSON, continue with download
    }

    const contentDisposition = headers["content-disposition"];

    if (!isString(contentDisposition)) {
      return;
    }

    const matches = CONTENT_DISPOSITION_FILENAME_REGEX.exec(contentDisposition);

    if (!matches?.groups?.name) {
      return;
    }

    const originalFilename = decodeURIComponent(matches.groups.name);
    const objectUrl = URL.createObjectURL(data);

    try {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = isFunction(filename) ? filename(originalFilename) : filename ?? originalFilename;
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
