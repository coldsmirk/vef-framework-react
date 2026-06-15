import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig
} from "axios";

import type { ApiResult, AuthTokens, HttpClientOptions } from "./types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "./client";
import { SKIP_AUTH_HEADER, SKIP_AUTH_VALUE } from "./constants";
import { BusinessError } from "./errors";

// ──────────────────────────────────────────────────────────────────────────
// Module-level mock infrastructure
// ──────────────────────────────────────────────────────────────────────────

// `vi.hoisted` makes the mock instance available inside the `vi.mock("axios")`
// factory (which Vitest hoists to the top of the file) and in tests. We need a
// shared reference so the spec can observe interceptor registration and inject
// responses through the same mock that HttpClient sees.

const mocks = vi.hoisted(() => {
  return {
    instance: {
      get: vi.fn(),
      post: vi.fn(),
      postForm: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      // Invoked when HttpClient does `this.#axiosInstance(config)` (retryRequest).
      call: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    }
  };
});

vi.mock("axios", () => {
  class CanceledError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = "CanceledError";
    }
  }

  // axios.create() must return a callable that also exposes get/post/.../interceptors.
  const create = vi.fn(() => {
    const fn = mocks.instance.call as unknown as Record<string, unknown>;
    Object.assign(fn, {
      get: mocks.instance.get,
      post: mocks.instance.post,
      postForm: mocks.instance.postForm,
      put: mocks.instance.put,
      delete: mocks.instance.delete,
      interceptors: mocks.instance.interceptors
    });
    return fn;
  });

  return {
    default: { create, CanceledError },
    CanceledError
  };
});

// ──────────────────────────────────────────────────────────────────────────
// Shared helpers and stubs (module scope to satisfy lint and to keep tests
// focused on the behavior being verified rather than callback wiring).
// ──────────────────────────────────────────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject
  };
}

const oldTokens: Readonly<AuthTokens> = { accessToken: "OLD", refreshToken: "RT" };
const renewedTokens: Readonly<AuthTokens> = { accessToken: "NEW", refreshToken: "RT2" };

function getOldTokens(): Readonly<AuthTokens> {
  return oldTokens;
}

function getRenewedTokens(): Readonly<AuthTokens> {
  return renewedTokens;
}

function rejectRefresh(): never {
  throw new Error("refresh failed");
}

// Function.prototype is a no-op function — useful for silencing console without
// running into `@typescript-eslint/no-empty-function`.
const silence = Function.prototype as () => void;

function silenceConsole(method: "warn" | "info" | "error"): void {
  vi.spyOn(console, method).mockImplementation(silence);
}

type RequestHandler = (config: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>;

type ResponseHandler = (response: AxiosResponse<ApiResult>) => AxiosResponse<ApiResult>;

type ResponseErrorHandler = (error: AxiosError<ApiResult>) => Promise<unknown>;

interface Handlers {
  request: RequestHandler;
  responseSuccess: ResponseHandler;
  responseError: ResponseErrorHandler;
}

function buildHttpClient(options?: Partial<HttpClientOptions>): {
  client: HttpClient;
  handlers: Handlers;
} {
  const client = new HttpClient({ baseUrl: "http://test", ...options } as HttpClientOptions);

  const lastRequestUse = mocks.instance.interceptors.request.use.mock.calls.at(-1);
  const lastResponseUse = mocks.instance.interceptors.response.use.mock.calls.at(-1);

  if (!lastRequestUse || !lastResponseUse) {
    throw new Error("HttpClient did not register interceptors");
  }

  return {
    client,
    handlers: {
      request: lastRequestUse[0] as RequestHandler,
      responseSuccess: lastResponseUse[0] as ResponseHandler,
      responseError: lastResponseUse[1] as ResponseErrorHandler
    }
  };
}

function makeConfig(overrides: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig {
  return {
    url: "/test",
    method: "get",
    headers: {} as InternalAxiosRequestConfig["headers"],
    ...overrides
  } as InternalAxiosRequestConfig;
}

function makeOkResponse<T>(data: T, code = 0, message = "ok"): AxiosResponse<ApiResult<T>> {
  return {
    data: {
      code,
      message,
      data
    },
    status: 200,
    statusText: "OK",
    headers: {},
    config: makeConfig()
  } as AxiosResponse<ApiResult<T>>;
}

function emptyJson(): Record<string, unknown> {
  return {};
}

function makeAxiosError(
  status: number,
  body: ApiResult,
  config?: Partial<InternalAxiosRequestConfig>
): AxiosError<ApiResult> {
  const fullConfig = makeConfig(config);
  return {
    name: "AxiosError",
    message: `Request failed with status code ${status}`,
    isAxiosError: true,
    toJSON: emptyJson,
    response: {
      data: body,
      status,
      statusText: "",
      headers: {},
      config: fullConfig
    },
    config: fullConfig
  } as AxiosError<ApiResult>;
}

const EXPIRED_CODE = 10_086;
const NON_EXPIRED_AUTH_CODE = 99_999;

const EXPIRED_BODY: ApiResult = {
  code: EXPIRED_CODE,
  message: "expired",
  data: null
};

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe("http/HttpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("request interceptor", () => {
    describe("path parameter replacement", () => {
      it("replaces a single :param with its value from params", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/users/:id", params: { id: 123 } });
        const result = await handlers.request(config);

        expect(result.url).toBe("/users/123");
      });

      it("replaces multiple :params from params", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig({
          url: "/orgs/:orgId/users/:userId",
          params: { orgId: "acme", userId: 7 }
        });
        const result = await handlers.request(config);

        expect(result.url).toBe("/orgs/acme/users/7");
      });

      it("substitutes 'unknown' when the params object lacks the key", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(silence);
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/users/:id", params: {} });
        const result = await handlers.request(config);

        expect(result.url).toBe("/users/unknown");
        expect(warnSpy).toHaveBeenCalled();
      });

      it("substitutes 'unknown' when the param value is null", async () => {
        silenceConsole("warn");
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/users/:id", params: { id: null } });
        const result = await handlers.request(config);

        expect(result.url).toBe("/users/unknown");
      });

      it("leaves the URL untouched when there are no :params", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/health", params: { foo: "bar" } });
        const result = await handlers.request(config);

        expect(result.url).toBe("/health");
      });
    });

    describe("auth token injection", () => {
      it("injects a Bearer Authorization header from getAuthTokens", async () => {
        const getAuthTokens = vi.fn(getOldTokens);
        const { handlers } = buildHttpClient({ getAuthTokens });

        const config = makeConfig();
        const result = await handlers.request(config);

        expect(result.headers.Authorization).toBe("Bearer OLD");
      });

      it("does not set Authorization when getAuthTokens is not configured", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig();
        const result = await handlers.request(config);

        expect(result.headers.Authorization).toBeUndefined();
      });

      it("skips auth and strips the skip-auth header when SKIP_AUTH_HEADER is set", async () => {
        const getAuthTokens = vi.fn(getOldTokens);
        const { handlers } = buildHttpClient({ getAuthTokens });

        const config = makeConfig({
          headers: { [SKIP_AUTH_HEADER]: SKIP_AUTH_VALUE } as unknown as InternalAxiosRequestConfig["headers"]
        });
        const result = await handlers.request(config);

        expect(getAuthTokens).not.toHaveBeenCalled();
        expect(result.headers[SKIP_AUTH_HEADER]).toBeUndefined();
        expect(result.headers.Authorization).toBeUndefined();
      });
    });
  });

  describe("response interceptor (business code)", () => {
    it("returns the response when the business code matches the default okCode (0)", () => {
      const { handlers } = buildHttpClient();
      const response = makeOkResponse({ id: 1 });

      const result = handlers.responseSuccess(response);

      expect(result).toBe(response);
    });

    it("throws BusinessError when the business code does not match okCode", () => {
      silenceConsole("warn");
      const { handlers } = buildHttpClient();
      const response = makeOkResponse(null, 1001, "validation failed");

      function trigger() {
        handlers.responseSuccess(response);
      }

      expect(trigger).toThrow(BusinessError);
      expect(trigger).toThrow("validation failed");
    });

    it("accepts an array of okCodes", () => {
      const { handlers } = buildHttpClient({ okCode: [0, 200] });

      const responseA = makeOkResponse(null, 0);
      const responseB = makeOkResponse(null, 200);

      expect(handlers.responseSuccess(responseA)).toBe(responseA);
      expect(handlers.responseSuccess(responseB)).toBe(responseB);
    });
  });

  describe("response error handling", () => {
    it("invokes onAccessDenied on 403 and rethrows", async () => {
      const onAccessDenied = vi.fn();
      silenceConsole("warn");
      const { handlers } = buildHttpClient({ onAccessDenied });

      const error = makeAxiosError(403, {
        code: 403,
        message: "forbidden",
        data: null
      });

      await expect(handlers.responseError(error)).rejects.toBe(error);
      expect(onAccessDenied).toHaveBeenCalledTimes(1);
    });

    it("logs and rethrows on non-handled status codes (500)", async () => {
      silenceConsole("error");
      const { handlers } = buildHttpClient();

      const error = makeAxiosError(500, {
        code: 500,
        message: "server error",
        data: null
      });

      await expect(handlers.responseError(error)).rejects.toBe(error);
    });

    it("rethrows network errors that have no response", async () => {
      silenceConsole("error");
      const { handlers } = buildHttpClient();

      const error = {
        name: "Error",
        message: "Network Error",
        isAxiosError: true,
        toJSON: emptyJson
      } as AxiosError<ApiResult>;

      await expect(handlers.responseError(error)).rejects.toBe(error);
    });
  });

  describe("401 token refresh queue", () => {
    it("invokes refreshToken exactly once when multiple requests fail concurrently with a token-expired 401", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      const getAuthTokens = vi.fn(getOldTokens);
      const setAuthTokens = vi.fn();
      const refreshToken = vi.fn(() => refreshDeferred.promise);
      mocks.instance.call.mockResolvedValue(makeOkResponse(null));

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens,
        setAuthTokens,
        refreshToken
      });

      const p1 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));
      const p2 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));
      const p3 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));

      // Let microtasks settle so the refresh kicks off.
      await Promise.resolve();
      await Promise.resolve();

      expect(refreshToken).toHaveBeenCalledTimes(1);

      refreshDeferred.resolve(renewedTokens);
      await Promise.allSettled([p1, p2, p3]);

      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(setAuthTokens).toHaveBeenCalledTimes(1);
      expect(setAuthTokens).toHaveBeenCalledWith(renewedTokens);
    });

    it("invokes onUnauthenticated for queued requests when the refresh fails", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      const onUnauthenticated = vi.fn();
      silenceConsole("error");
      silenceConsole("info");

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens: getOldTokens,
        setAuthTokens: silence,
        refreshToken: () => refreshDeferred.promise,
        onUnauthenticated
      });

      const p1 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));

      await Promise.resolve();
      await Promise.resolve();

      refreshDeferred.reject(new Error("refresh failed"));
      await expect(p1).rejects.toThrow();

      expect(onUnauthenticated).toHaveBeenCalled();
    });

    it("queues new requests during refresh and dispatches them with the refreshed token", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      let currentTokens: Readonly<AuthTokens> = oldTokens;
      silenceConsole("error");
      mocks.instance.call.mockResolvedValue(makeOkResponse(null));

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens: () => currentTokens,
        setAuthTokens: tokens => {
          currentTokens = tokens;
        },
        refreshToken: () => refreshDeferred.promise
      });

      // p1 triggers the refresh path. handleResponseError always rethrows the
      // original error after handleUnauthorized completes, so swallow it — we
      // only care about how queued requests are dispatched.
      const p1 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY))
        .catch(silence);
      await Promise.resolve();
      await Promise.resolve();

      // A new request arriving while #isRefreshing=true must queue in the
      // request interceptor and resume once the refresh resolves.
      const queuedRequest = handlers.request(makeConfig({ url: "/queued" }));

      refreshDeferred.resolve(renewedTokens);
      const queuedConfig = await queuedRequest;
      await p1;

      expect(queuedConfig.headers.Authorization).toBe("Bearer NEW");
    });

    it("rejects queued requests with '登录已过期' when refresh fails", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      silenceConsole("error");
      silenceConsole("info");

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens: getOldTokens,
        setAuthTokens: silence,
        refreshToken: () => refreshDeferred.promise
      });

      const p1 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY))
        .catch(silence);
      await Promise.resolve();
      await Promise.resolve();

      const queuedRequest = handlers.request(makeConfig({ url: "/queued" }));

      refreshDeferred.reject(new Error("refresh failed"));

      await expect(queuedRequest).rejects.toThrow("登录已过期");
      await p1;
    });

    it("calls onUnauthenticated immediately for a non-expired 401", async () => {
      const onUnauthenticated = vi.fn();
      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        onUnauthenticated
      });

      const error = makeAxiosError(401, {
        code: NON_EXPIRED_AUTH_CODE,
        message: "auth required",
        data: null
      });

      await expect(handlers.responseError(error)).rejects.toBe(error);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });
  });

  describe("ensureTokenRefreshed (public)", () => {
    it("returns true and persists new tokens when refresh succeeds", async () => {
      const setAuthTokens = vi.fn();
      const { client } = buildHttpClient({
        getAuthTokens: getOldTokens,
        setAuthTokens,
        refreshToken: getRenewedTokens
      });

      const success = await client.ensureTokenRefreshed();

      expect(success).toBe(true);
      expect(setAuthTokens).toHaveBeenCalledWith(renewedTokens);
    });

    it("returns false and triggers onUnauthenticated when refresh fails", async () => {
      const onUnauthenticated = vi.fn();
      silenceConsole("error");
      const { client } = buildHttpClient({
        getAuthTokens: getOldTokens,
        setAuthTokens: silence,
        refreshToken: rejectRefresh,
        onUnauthenticated
      });

      const success = await client.ensureTokenRefreshed();

      expect(success).toBe(false);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });

    it("returns false without triggering onUnauthenticated when refresh callbacks are missing", async () => {
      const onUnauthenticated = vi.fn();
      const { client } = buildHttpClient({ onUnauthenticated });

      const success = await client.ensureTokenRefreshed();

      expect(success).toBe(false);
    });
  });

  describe("public HTTP methods", () => {
    it("get() unwraps the response.data field from axios's response envelope", async () => {
      mocks.instance.get.mockResolvedValue({
        data: {
          code: 0,
          message: "ok",
          data: { id: 1 }
        }
      });
      const { client } = buildHttpClient();

      const result = await client.get<{ id: number }>("/users/1");

      expect(result).toEqual({
        code: 0,
        message: "ok",
        data: { id: 1 }
      });
      expect(mocks.instance.get).toHaveBeenCalledWith("/users/1", undefined);
    });

    it("post() passes data and options separately to axios.post", async () => {
      mocks.instance.post.mockResolvedValue({
        data: {
          code: 0,
          message: "ok",
          data: null
        }
      });
      const { client } = buildHttpClient();

      await client.post("/users", { data: { name: "alice" }, headers: { "X-Trace": "t1" } });

      expect(mocks.instance.post).toHaveBeenCalledWith(
        "/users",
        { name: "alice" },
        expect.objectContaining({ headers: { "X-Trace": "t1" } })
      );
    });
  });
});
